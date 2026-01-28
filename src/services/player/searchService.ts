/**
 * Player Search Service
 * Handles player search, discovery, and filtering operations
 */

import { prisma } from '../../lib/prisma';
import { Role, UserStatus } from "@prisma/client";
import { enrichPlayersWithSkills } from './utils/playerTransformer';
import { buildSearchWhereClause } from './utils/queryHelpers';

/**
 * Get all players with sports and skill ratings
 * Original: playerController.ts lines 46-136
 */
export async function getAllPlayers(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const take = Math.min(limit, 100); // Max 100 items

  const [players, total] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: Role.USER,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take,
    }),
    prisma.user.count({
      where: {
        role: Role.USER,
      },
    }),
  ]);

  if (players.length === 0) {
    return {
      data: [],
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  const playerIds = players.map(p => p.id);

  // Batch queries for counts (run in parallel for performance)
  const [seasonMemberships, leagueMatchCounts, friendlyMatchCounts] = await Promise.all([
    // Get all season memberships with their seasons and leagues
    prisma.seasonMembership.findMany({
      where: { userId: { in: playerIds } },
      select: {
        userId: true,
        seasonId: true,
        season: {
          select: {
            leagues: {
              select: { id: true }
            }
          }
        }
      }
    }),
    // League match counts (completed, non-friendly matches)
    prisma.matchParticipant.groupBy({
      by: ['userId'],
      where: {
        userId: { in: playerIds },
        match: { status: 'COMPLETED', isFriendly: false }
      },
      _count: { matchId: true }
    }),
    // Friendly match counts (completed friendly matches)
    prisma.matchParticipant.groupBy({
      by: ['userId'],
      where: {
        userId: { in: playerIds },
        match: { status: 'COMPLETED', isFriendly: true }
      },
      _count: { matchId: true }
    })
  ]);

  // Process season memberships to get season and league counts per player
  const seasonCountMap = new Map<string, number>();
  const leagueCountMap = new Map<string, Set<string>>();

  for (const membership of seasonMemberships) {
    // Count seasons
    seasonCountMap.set(
      membership.userId,
      (seasonCountMap.get(membership.userId) ?? 0) + 1
    );

    // Collect unique league IDs
    if (!leagueCountMap.has(membership.userId)) {
      leagueCountMap.set(membership.userId, new Set());
    }
    for (const league of membership.season.leagues) {
      leagueCountMap.get(membership.userId)!.add(league.id);
    }
  }

  // Create match count maps
  const leagueMatchCountMap = new Map(leagueMatchCounts.map(m => [m.userId, m._count.matchId]));
  const friendlyMatchCountMap = new Map(friendlyMatchCounts.map(m => [m.userId, m._count.matchId]));

  // Enrich all players with sports and skills using batch operation
  const transformedPlayers = await enrichPlayersWithSkills(players);

  // Add additional fields for getAllPlayers response
  const data = transformedPlayers.map(player => ({
    ...player,
    registeredDate: player.createdAt,
    lastLoginDate: player.lastLogin,
    leagueCount: leagueCountMap.get(player.id)?.size ?? 0,
    seasonCount: seasonCountMap.get(player.id) ?? 0,
    leagueMatchesPlayed: leagueMatchCountMap.get(player.id) ?? 0,
    friendlyMatchesPlayed: friendlyMatchCountMap.get(player.id) ?? 0,
  }));

  return {
    data,
    pagination: {
      page,
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
}

/**
 * Search players by query string and optional sport filter
 * Original: playerController.ts lines 1074-1155
 */
export async function searchPlayers(
  query?: string,
  sport?: string,
  excludeUserId?: string
) {
  // Build where clause using helper
  const whereClause = buildSearchWhereClause(query, sport, excludeUserId);

  const players = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      username: true,
      displayUsername: true,
      image: true,
      bio: true,
      area: true,
      gender: true,
      createdAt: true,
      lastLogin: true,
      status: true,
    },
    take: 20,
  });

  // Enrich players with sports and ratings
  const playersWithDetails = await enrichPlayersWithSkills(players);

  // Filter by sport if provided
  const filteredPlayers = sport
    ? playersWithDetails.filter((p) => p.sports.includes((sport).toLowerCase()))
    : playersWithDetails;

  return filteredPlayers;
}

/**
 * Get available players for doubles pairing in a season
 * Requirements:
 * 1. Must be friends with current user (friendship.status === 'ACCEPTED')
 * 2. For MIXED doubles: Must be opposite gender
 * 3. NO league/season join requirement
 * 4. Fallback: If no friends available, show all eligible players (non-friends)
 *
 * Original: playerController.ts lines 1166-1372
 */
export async function getAvailablePlayersForSeason(
  seasonId: string,
  currentUserId: string,
  searchQuery?: string
) {
  const isSearching = searchQuery && searchQuery.trim().length > 0;
  console.log(`🔍 Search mode: ${isSearching ? 'YES' : 'NO'} | Query: "${searchQuery || ''}"`);

  // Get current user's gender
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { gender: true },
  });

  if (!currentUser) {
    throw new Error('User not found');
  }

  // Get season with category info to check if it's mixed doubles and get sport type
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      leagues: {
        select: {
          id: true,
          sportType: true
        }
      }
    },
  });

  if (!season) {
    throw new Error('Season not found');
  }

  // Get category separately since we need to fetch it by categoryId
  let category: { genderRestriction?: any; genderCategory?: any } | null = null;
  if ((season as any).categoryId) {
    const categoryData = await prisma.category.findUnique({
      where: { id: (season as any).categoryId },
      select: {
        genderRestriction: true,
        genderCategory: true
      }
    });
    category = categoryData;
  }

  // Check if season is MIXED doubles or OPEN
  // Note: Category gender values are enums (uppercase), but normalize for comparison
  const categoryGender = category?.genderCategory || category?.genderRestriction;
  const categoryGenderUpper = categoryGender?.toUpperCase();
  const isMixedDoubles = categoryGenderUpper === 'MIXED';
  const isOpenCategory = categoryGenderUpper === 'OPEN';
  console.log('🔍 Season:', season.name, '| Category:', categoryGender, '| Mixed:', isMixedDoubles, '| Open:', isOpenCategory);

  // Get user's ACCEPTED friendships (both as requester and recipient)
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: currentUserId, status: 'ACCEPTED' },
        { recipientId: currentUserId, status: 'ACCEPTED' }
      ]
    },
    select: {
      requesterId: true,
      recipientId: true,
    }
  });

  // Extract friend IDs
  const friendIds = friendships.map(f =>
    f.requesterId === currentUserId ? f.recipientId : f.requesterId
  );
  console.log(`🔍 User has ${friendIds.length} friends`);

  // Get players in ACTIVE partnerships for this season (exclude them)
  const activePairs = await prisma.partnership.findMany({
    where: {
      seasonId,
      status: 'ACTIVE',
      dissolvedAt: null
    },
    select: { captainId: true, partnerId: true },
  });

  const activelyPairedPlayerIds = [
    ...activePairs.map((p) => p.captainId),
    ...activePairs.map((p) => p.partnerId),
  ];
  console.log(`🔍 ${activelyPairedPlayerIds.length} players already in active partnerships`);

  // Get players with INCOMPLETE partnerships for this season (to mark them in results)
  const incompletePairs = await prisma.partnership.findMany({
    where: {
      seasonId,
      status: 'INCOMPLETE',
    },
    select: { captainId: true },
  });
  const incompletePartnershipCaptainIds = incompletePairs.map((p) => p.captainId);
  console.log(`🔍 ${incompletePartnershipCaptainIds.length} players with INCOMPLETE partnerships`);

  // Build gender filter based on category
  // Note: User gender is stored as lowercase ('male', 'female') in the database
  // Category gender is stored as uppercase ('MALE', 'FEMALE', 'MIXED', 'OPEN') as enum values
  const genderFilter: any = {};
  if (currentUser.gender) {
    // Normalize user gender to lowercase for comparison
    const userGender = currentUser.gender.toLowerCase();
    
    if (isMixedDoubles) {
      // Mixed doubles: opposite gender only
      // If user is female, filter for male partners; if male, filter for female partners
      genderFilter.gender = userGender === 'male' ? 'female' : 'male';
      console.log(`🔍 Mixed doubles: User is ${userGender}, filtering for ${genderFilter.gender} partners`);
    } else if (isOpenCategory) {
      // OPEN category: no gender restriction, all genders allowed
      console.log(`🔍 OPEN category: No gender filtering applied`);
      // Don't set genderFilter.gender - allow all genders
    } else if (categoryGenderUpper === 'MALE') {
      // Men's doubles: only MALE players
      genderFilter.gender = 'male';
      console.log(`🔍 Men's doubles: Filtering for male partners only`);
    } else if (categoryGenderUpper === 'FEMALE') {
      // Women's doubles: only FEMALE players
      genderFilter.gender = 'female';
      console.log(`🔍 Women's doubles: Filtering for female partners only`);
    }
  }

  // Try to find friends first
  const friendPlayers = await prisma.user.findMany({
    where: {
      AND: [
        { id: { in: friendIds } },
        { id: { not: currentUserId } },
        { id: { notIn: activelyPairedPlayerIds } },
        { role: Role.USER },
        { status: UserStatus.ACTIVE },
        ...Object.keys(genderFilter).length > 0 ? [genderFilter] : [],
      ]
    },
    select: {
      id: true,
      name: true,
      username: true,
      displayUsername: true,
      image: true,
      bio: true,
      area: true,
      gender: true,
    },
  });

  console.log(`✅ Found ${friendPlayers.length} eligible friends`);

  let playersToReturn = friendPlayers;
  let usedFallback = false;

  // If user is searching, show all eligible NON-FRIEND players (excluding friends)
  if (isSearching) {
    console.log('🔍 User is searching, fetching all eligible non-friend players');

    // Build search filter for name/username
    const searchFilter: any[] = [
      { name: { contains: searchQuery, mode: 'insensitive' } },
      { username: { contains: searchQuery, mode: 'insensitive' } },
      { displayUsername: { contains: searchQuery, mode: 'insensitive' } },
    ];

    const allEligiblePlayers = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },
          { id: { notIn: [...activelyPairedPlayerIds, ...friendIds] } },
          { role: Role.USER },
          { status: UserStatus.ACTIVE },
          { OR: searchFilter },
          ...Object.keys(genderFilter).length > 0 ? [genderFilter] : [],
        ]
      },
      select: {
        id: true,
        name: true,
        username: true,
        displayUsername: true,
        image: true,
        bio: true,
        area: true,
        gender: true,
      },
    });

    console.log(`✅ Found ${allEligiblePlayers.length} eligible non-friend players matching "${searchQuery}"`);
    playersToReturn = allEligiblePlayers;
    usedFallback = true; // Mark as fallback to show proper message
  }
  // If NOT searching and no friends, show fallback message (but return empty list)
  else if (friendPlayers.length === 0) {
    console.log('⚠️  No friends available and not searching - returning empty list');
    playersToReturn = [];
    usedFallback = true;
  }

  // Add sports, ratings, and friendship flag
  const playersWithDetails = await enrichPlayersWithSkills(playersToReturn);

  // Get season sport type (from league sportType or infer from category)
  const seasonSport = season.leagues[0]?.sportType?.toLowerCase() || 
                      (category ? 'pickleball' : null); // Fallback to pickleball if no league sportType

  // Get questionnaire responses for all players to check completion status for season sport
  const playerIds = playersToReturn.map(p => p.id);
  const questionnaireResponses = playerIds.length > 0 && seasonSport
    ? await prisma.questionnaireResponse.findMany({
        where: {
          userId: { in: playerIds },
          sport: { equals: seasonSport, mode: 'insensitive' }
        },
        select: {
          userId: true,
          sport: true,
          completedAt: true,
          startedAt: true
        }
      })
    : [];

  // Create a map of userId -> questionnaire status for the season sport
  const questionnaireStatusMap = new Map();
  questionnaireResponses.forEach(res => {
    questionnaireStatusMap.set(res.userId, {
      hasSelectedSport: true,
      hasCompletedQuestionnaire: !!res.completedAt,
      startedAt: res.startedAt,
      completedAt: res.completedAt
    });
  });

  // Add isFriend flag, questionnaire status, and INCOMPLETE partnership flag to each player
  const playersWithFriendship = playersWithDetails.map(player => {
    const questionnaireStatus = questionnaireStatusMap.get(player.id);
    return {
      ...player,
      isFriend: friendIds.includes(player.id),
      questionnaireStatus: questionnaireStatus || {
        hasSelectedSport: false,
        hasCompletedQuestionnaire: false,
        startedAt: null,
        completedAt: null
      },
      seasonSport: seasonSport, // Include season sport for frontend use
      hasIncompletePartnership: incompletePartnershipCaptainIds.includes(player.id), // Flag for players with INCOMPLETE partnership
    };
  });

  return {
    players: playersWithFriendship,
    usedFallback,
    totalCount: playersWithFriendship.length,
    friendsCount: usedFallback ? 0 : playersWithFriendship.length,
    seasonSport: seasonSport, // Include season sport in response
  };
}
