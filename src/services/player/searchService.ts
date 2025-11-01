/**
 * Player Search Service
 * Handles player search, discovery, and filtering operations
 */

import { prisma } from '../../lib/prisma';
import { Role } from "@prisma/client";
import { enrichPlayersWithSkills } from './utils/playerTransformer';
import { buildSearchWhereClause } from './utils/queryHelpers';

/**
 * Get all players with sports and skill ratings
 * Original: playerController.ts lines 46-136
 */
export async function getAllPlayers() {
  const players = await prisma.user.findMany({
    where: {
      role: Role.USER,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (players.length === 0) {
    return [];
  }

  // Enrich all players with sports and skills using batch operation
  const transformedPlayers = await enrichPlayersWithSkills(players);

  // Add additional fields for getAllPlayers response
  return transformedPlayers.map(player => ({
    ...player,
    registeredDate: player.createdAt,
    lastLoginDate: player.lastLogin,
  }));
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
    take: 20, // Limit results
  });

  // Enrich players with sports and ratings
  const playersWithDetails = await enrichPlayersWithSkills(players);

  // Filter by sport if provided
  const filteredPlayers = sport
    ? playersWithDetails.filter((p) => p.sports.includes((sport as string).toLowerCase()))
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

  // Get season with category info to check if it's mixed doubles
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      name: true,
      categories: {
        select: {
          id: true,
          genderRestriction: true,
          gender_category: true
        }
      }
    },
  });

  if (!season) {
    throw new Error('Season not found');
  }

  // Check if season is MIXED doubles
  const categoryGender = season.categories[0]?.gender_category || season.categories[0]?.genderRestriction;
  const isMixedDoubles = categoryGender === 'MIXED';
  console.log('🔍 Season:', season.name, '| Category:', categoryGender, '| Mixed:', isMixedDoubles);

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

  // Build gender filter based on category
  const genderFilter: any = {};
  if (currentUser.gender) {
    if (isMixedDoubles) {
      // Mixed doubles: opposite gender only
      genderFilter.gender = currentUser.gender === 'MALE' ? 'FEMALE' : 'MALE';
      console.log(`🔍 Mixed doubles: Filtering for ${genderFilter.gender} partners`);
    } else if (categoryGender === 'MALE') {
      // Men's doubles: only MALE players
      genderFilter.gender = 'MALE';
      console.log(`🔍 Men's doubles: Filtering for MALE partners only`);
    } else if (categoryGender === 'FEMALE') {
      // Women's doubles: only FEMALE players
      genderFilter.gender = 'FEMALE';
      console.log(`🔍 Women's doubles: Filtering for FEMALE partners only`);
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
        { status: 'active' },
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
          { id: { notIn: [...activelyPairedPlayerIds, ...friendIds] } }, // Exclude friends and paired players
          { role: Role.USER },
          { status: 'active' },
          { OR: searchFilter }, // Search by name or username
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

  // Add isFriend flag to each player
  const playersWithFriendship = playersWithDetails.map(player => ({
    ...player,
    isFriend: friendIds.includes(player.id),
  }));

  return {
    players: playersWithFriendship,
    usedFallback,
    totalCount: playersWithFriendship.length,
    friendsCount: usedFallback ? 0 : playersWithFriendship.length,
  };
}
