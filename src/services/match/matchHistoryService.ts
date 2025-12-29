/**
 * Match History Service
 * Handles match history retrieval with statistics and filters
 */

import { prisma } from '../../lib/prisma';
import { MatchStatus, MatchType, SportType } from '@prisma/client';

// Types
export interface MatchHistoryFilters {
  userId: string;
  divisionId?: string;
  seasonId?: string;
  status?: MatchStatus;
  matchType?: MatchType;
  sportType?: SportType;
  fromDate?: Date;
  toDate?: Date;
  outcome?: 'win' | 'loss' | 'all';
  page?: number;
  limit?: number;
}

export interface MatchStatsSummary {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  walkoversGiven: number;
  walkoversReceived: number;
}

export class MatchHistoryService {
  /**
   * Get user's match history with pagination and filters
   */
  async getMatchHistory(filters: MatchHistoryFilters) {
    const {
      userId,
      divisionId,
      seasonId,
      status,
      matchType,
      sportType,
      fromDate,
      toDate,
      outcome,
      page = 1,
      limit = 20
    } = filters;

    const where: any = {
      participants: {
        some: { userId }
      }
    };

    if (divisionId) where.divisionId = divisionId;
    if (seasonId) where.seasonId = seasonId;
    if (status) where.status = status;
    if (matchType) where.matchType = matchType;

    // Filter by sport type through division -> league relationship
    if (sportType) {
      where.division = {
        league: {
          sportType: sportType
        }
      };
    }

    if (fromDate || toDate) {
      where.matchDate = {};
      if (fromDate) where.matchDate.gte = fromDate;
      if (toDate) where.matchDate.lte = toDate;
    }

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        include: {
          division: {
            include: {
              season: true,
              league: true
            }
          },
          participants: {
            include: {
              user: {
                select: { id: true, name: true, username: true, image: true }
              }
            }
          },
          scores: { orderBy: { setNumber: 'asc' } },
          createdBy: {
            select: { id: true, name: true, username: true }
          }
        },
        orderBy: { matchDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.match.count({ where })
    ]);

    // Process matches to add user-specific outcome
    const processedMatches = matches.map(match => {
      const userParticipant = match.participants.find(p => p.userId === userId);
      const userTeam = userParticipant?.team;

      // Determine outcome for user
      let userOutcome: 'win' | 'loss' | 'draw' | null = null;

      if (match.status === MatchStatus.COMPLETED && match.outcome) {
        if (match.matchType === MatchType.SINGLES) {
          // For singles, check if user created the match or was opponent
          const isCreator = match.createdById === userId;
          if (match.outcome === 'team1') {
            userOutcome = isCreator ? 'win' : 'loss';
          } else if (match.outcome === 'team2') {
            userOutcome = isCreator ? 'loss' : 'win';
          }
        } else {
          // For doubles, check team
          if (match.outcome === userTeam) {
            userOutcome = 'win';
          } else if (match.outcome && match.outcome !== userTeam) {
            userOutcome = 'loss';
          }
        }
      }

      // Get opponents
      const opponents = match.participants.filter(p => {
        if (match.matchType === MatchType.SINGLES) {
          return p.userId !== userId;
        } else {
          return p.team !== userTeam;
        }
      });

      // Get partner (for doubles)
      const partner = match.matchType === MatchType.DOUBLES
        ? match.participants.find(p => p.team === userTeam && p.userId !== userId)
        : null;

      return {
        id: match.id,
        matchType: match.matchType,
        format: match.format,
        status: match.status,
        matchDate: match.matchDate,
        location: match.location,
        venue: match.venue,
        divisionId: match.divisionId, // Keep raw divisionId for rating lookup
        division: match.division ? {
          id: match.division.id,
          name: match.division.name,
          season: match.division.season?.name
        } : null,
        // Include league info from division or directly from match
        league: match.division?.league ? {
          id: match.division.league.id,
          name: match.division.league.name
        } : null,
        // Include season info separately for clarity
        season: match.division?.season ? {
          id: match.division.season.id,
          name: match.division.season.name
        } : null,
        userOutcome,
        team1Score: match.team1Score,
        team2Score: match.team2Score,
        // Use scores relation if available, otherwise fall back to JSON setScores field
        setScores: match.scores.length > 0
          ? match.scores.map(s => ({
              setNumber: s.setNumber,
              player1Games: s.player1Games,
              player2Games: s.player2Games,
              tiebreak: s.hasTiebreak ? {
                player1: s.player1Tiebreak,
                player2: s.player2Tiebreak
              } : null
            }))
          : (() => {
              // Parse JSON setScores - can be string, object with sets, or array
              if (!match.setScores) return [];
              try {
                const parsedScores = typeof match.setScores === 'string'
                  ? JSON.parse(match.setScores)
                  : match.setScores;

                // Handle both formats:
                // 1. { sets: [...] } - nested structure from seed data
                // 2. [...] - direct array format
                let setsArray: any[] = [];
                if (Array.isArray(parsedScores)) {
                  setsArray = parsedScores;
                } else if (parsedScores?.sets && Array.isArray(parsedScores.sets)) {
                  setsArray = parsedScores.sets;
                }

                return setsArray.map((s: any, index: number) => ({
                  setNumber: s.setNumber ?? s.gameNumber ?? index + 1,
                  // Handle multiple field naming conventions:
                  // Tennis/Padel: player1Games, team1Games
                  // Pickleball: team1Points, player1Points
                  // Seed data: player1
                  player1Games: s.player1Games ?? s.team1Games ?? s.team1Points ?? s.player1Points ?? s.player1 ?? 0,
                  player2Games: s.player2Games ?? s.team2Games ?? s.team2Points ?? s.player2Points ?? s.player2 ?? 0,
                  tiebreak: (s.hasTiebreak || s.tiebreak) ? {
                    player1: s.tiebreak?.player1 ?? s.team1Tiebreak ?? s.player1Tiebreak ?? null,
                    player2: s.tiebreak?.player2 ?? s.team2Tiebreak ?? s.player2Tiebreak ?? null
                  } : null
                }));
              } catch (e) {
                return [];
              }
            })(),
        opponents: opponents.map(p => ({
          id: p.user.id,
          name: p.user.name,
          username: p.user.username,
          image: p.user.image
        })),
        partner: partner ? {
          id: partner.user.id,
          name: partner.user.name,
          username: partner.user.username,
          image: partner.user.image
        } : null,
        isWalkover: match.isWalkover,
        isDisputed: match.isDisputed,
        isFriendly: match.isFriendly,
        sportType: match.division?.league?.sportType || null,
        createdAt: match.createdAt
      };
    });

    // Apply outcome filter if specified
    let filteredMatches = processedMatches;
    if (outcome && outcome !== 'all') {
      filteredMatches = processedMatches.filter(m => m.userOutcome === outcome);
    }

    // Fetch rating changes for each match
    const matchesWithRatingChanges = await Promise.all(
      filteredMatches.map(async (match) => {
        // Get rating change for this specific match and user
        // Only query if match has a divisionId (league matches, not friendly)
        let ratingChange = null;
        if (match.divisionId) {
          // First try to find any rating history for this match and user
          ratingChange = await prisma.ratingHistory.findFirst({
            where: {
              matchId: match.id,
              playerRating: {
                userId,
                divisionId: match.divisionId
              }
            },
            select: {
              ratingBefore: true,
              ratingAfter: true,
              delta: true
            }
          });

          // If not found with division filter, try without it (for legacy data)
          if (!ratingChange) {
            ratingChange = await prisma.ratingHistory.findFirst({
              where: {
                matchId: match.id,
                playerRating: {
                  userId
                }
              },
              select: {
                ratingBefore: true,
                ratingAfter: true,
                delta: true
              }
            });
          }

          console.log(`[MatchHistory] Match ${match.id} - userId: ${userId}, divisionId: ${match.divisionId}, ratingChange:`, ratingChange);
        } else {
          console.log(`[MatchHistory] Match ${match.id} - No divisionId (friendly match)`);
        }

        return {
          ...match,
          ratingChange: ratingChange || null
        };
      })
    );

    return {
      matches: matchesWithRatingChanges,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get user's match statistics summary
   */
  async getMatchStatsSummary(userId: string, seasonId?: string, divisionId?: string): Promise<MatchStatsSummary> {
    const where: any = {
      status: MatchStatus.COMPLETED,
      participants: {
        some: { userId }
      }
    };

    if (seasonId) where.seasonId = seasonId;
    if (divisionId) where.divisionId = divisionId;

    const matches = await prisma.match.findMany({
      where,
      include: {
        participants: true,
        scores: true,
        walkover: true
      }
    });

    let wins = 0;
    let losses = 0;
    let setsWon = 0;
    let setsLost = 0;
    let gamesWon = 0;
    let gamesLost = 0;
    let walkoversGiven = 0;
    let walkoversReceived = 0;

    for (const match of matches) {
      const userParticipant = match.participants.find(p => p.userId === userId);
      const userTeam = userParticipant?.team || 'team1';
      const isTeam1 = userTeam === 'team1' || match.createdById === userId;

      // Count wins/losses
      if (match.outcome === userTeam || (match.matchType === MatchType.SINGLES && isTeam1 && match.outcome === 'team1')) {
        wins++;
      } else if (match.outcome && match.outcome !== userTeam) {
        losses++;
      }

      // Count sets and games
      for (const score of match.scores) {
        const userGames = isTeam1 ? score.player1Games : score.player2Games;
        const oppGames = isTeam1 ? score.player2Games : score.player1Games;

        gamesWon += userGames;
        gamesLost += oppGames;

        if (userGames > oppGames) {
          setsWon++;
        } else if (oppGames > userGames) {
          setsLost++;
        } else if (score.hasTiebreak) {
          const userTiebreak = isTeam1 ? (score.player1Tiebreak || 0) : (score.player2Tiebreak || 0);
          const oppTiebreak = isTeam1 ? (score.player2Tiebreak || 0) : (score.player1Tiebreak || 0);
          if (userTiebreak > oppTiebreak) setsWon++;
          else setsLost++;
        }
      }

      // Count walkovers
      if (match.walkover) {
        if (match.walkover.defaultingPlayerId === userId) {
          walkoversGiven++;
        } else if (match.walkover.winningPlayerId === userId) {
          walkoversReceived++;
        }
      }
    }

    const totalMatches = matches.length;
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

    return {
      totalMatches,
      wins,
      losses,
      winRate: Math.round(winRate * 10) / 10,
      setsWon,
      setsLost,
      gamesWon,
      gamesLost,
      walkoversGiven,
      walkoversReceived
    };
  }

  /**
   * Get head-to-head record against another player
   */
  async getHeadToHead(userId: string, opponentId: string) {
    const matches = await prisma.match.findMany({
      where: {
        status: MatchStatus.COMPLETED,
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: opponentId } } }
        ]
      },
      include: {
        participants: true,
        scores: true,
        division: true
      },
      orderBy: { matchDate: 'desc' }
    });

    let userWins = 0;
    let opponentWins = 0;
    let userSets = 0;
    let opponentSets = 0;
    let userGames = 0;
    let opponentGames = 0;

    const processedMatches = matches.map(match => {
      const userParticipant = match.participants.find(p => p.userId === userId);
      const userTeam = userParticipant?.team || 'team1';
      const isTeam1 = userTeam === 'team1';

      const isUserWin = match.outcome === userTeam;
      if (isUserWin) userWins++;
      else opponentWins++;

      for (const score of match.scores) {
        const uGames = isTeam1 ? score.player1Games : score.player2Games;
        const oGames = isTeam1 ? score.player2Games : score.player1Games;
        userGames += uGames;
        opponentGames += oGames;

        if (uGames > oGames) userSets++;
        else if (oGames > uGames) opponentSets++;
      }

      return {
        id: match.id,
        date: match.matchDate,
        division: match.division?.name,
        userWon: isUserWin,
        scores: match.scores.map(s => ({
          set: s.setNumber,
          user: isTeam1 ? s.player1Games : s.player2Games,
          opponent: isTeam1 ? s.player2Games : s.player1Games
        }))
      };
    });

    return {
      totalMatches: matches.length,
      userWins,
      opponentWins,
      userSets,
      opponentSets,
      userGames,
      opponentGames,
      matches: processedMatches
    };
  }

  /**
   * Get upcoming matches for user
   */
  async getUpcomingMatches(userId: string, limit = 5) {
    return prisma.match.findMany({
      where: {
        participants: {
          some: { userId }
        },
        status: MatchStatus.SCHEDULED,
        matchDate: { gte: new Date() }
      },
      include: {
        division: true,
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        }
      },
      orderBy: [
        { matchDate: 'asc' },
        { createdAt: 'desc' }
      ],
      take: limit
    });
  }

  /**
   * Get recent results for user with rating changes
   */
  async getRecentResults(userId: string, limit = 5) {
    const matches = await prisma.match.findMany({
      where: {
        participants: {
          some: { userId }
        },
        status: MatchStatus.COMPLETED
      },
      include: {
        division: {
          include: {
            playerRatings: {
              where: { userId },
              take: 1
            }
          }
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        },
        scores: { orderBy: { setNumber: 'asc' } }
      },
      orderBy: { matchDate: 'desc' },
      take: limit
    });

    // Fetch rating changes for each match
    const matchesWithRatingChanges = await Promise.all(
      matches.map(async (match) => {
        // Get rating change for this specific match and user
        const ratingChange = await prisma.ratingHistory.findFirst({
          where: {
            matchId: match.id,
            playerRating: {
              userId,
              divisionId: match.divisionId
            }
          },
          select: {
            id: true,
            ratingBefore: true,
            ratingAfter: true,
            delta: true,
            rdBefore: true,
            rdAfter: true
          }
        });

        return {
          ...match,
          ratingChange: ratingChange || null
        };
      })
    );

    return matchesWithRatingChanges;
  }

  /**
   * Get matches pending confirmation for user
   * These are completed matches where result is submitted but not confirmed/disputed
   */
  async getPendingConfirmationMatches(userId: string, limit = 20) {
    return prisma.match.findMany({
      where: {
        participants: {
          some: { userId }
        },
        status: MatchStatus.COMPLETED,
        resultSubmittedAt: { not: null },
        resultConfirmedAt: null,
        isDisputed: false,
        isAutoApproved: false
      },
      include: {
        division: true,
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        },
        scores: { orderBy: { setNumber: 'asc' } },
        resultSubmittedBy: {
          select: { id: true, name: true, username: true }
        }
      },
      orderBy: { resultSubmittedAt: 'desc' },
      take: limit
    });
  }

  /**
   * Get disputed matches for user
   */
  async getDisputedMatches(userId: string, limit = 20) {
    return prisma.match.findMany({
      where: {
        participants: {
          some: { userId }
        },
        isDisputed: true
      },
      include: {
        division: true,
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        },
        scores: { orderBy: { setNumber: 'asc' } },
        disputes: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
          include: {
            raisedByUser: {
              select: { id: true, name: true, username: true }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: limit
    });
  }

  /**
   * Get completed matches for a division (all matches, not user-specific)
   * Used for displaying recent results in standings view
   */
  async getDivisionResults(divisionId: string, seasonId?: string, limit = 3) {
    const where: any = {
      divisionId,
      status: MatchStatus.COMPLETED
    };

    if (seasonId) {
      where.seasonId = seasonId;
    }

    const matches = await prisma.match.findMany({
      where,
      include: {
        division: {
          include: { season: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        },
        scores: { orderBy: { setNumber: 'asc' } },
        pickleballScores: { orderBy: { gameNumber: 'asc' } },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, image: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        createdBy: {
          select: { id: true, name: true, username: true }
        },
        resultSubmittedBy: {
          select: { id: true, name: true, username: true }
        }
      },
      orderBy: { matchDate: 'desc' },
      take: limit
    });

    // Process matches to include formatted data
    return matches.map(match => {
      // Separate players by team
      const team1Players = match.participants.filter(p => p.team === 'team1' || p.team === 'TEAM_A');
      const team2Players = match.participants.filter(p => p.team === 'team2' || p.team === 'TEAM_B');

      // If no team info, split evenly (first half team1, second half team2)
      if (team1Players.length === 0 && team2Players.length === 0) {
        const half = Math.ceil(match.participants.length / 2);
        match.participants.forEach((p, index) => {
          if (index < half) {
            team1Players.push(p);
          } else {
            team2Players.push(p);
          }
        });
      }

      return {
        id: match.id,
        matchType: match.matchType,
        format: match.format,
        status: match.status,
        matchDate: match.matchDate,
        location: match.location,
        venue: match.venue,
        division: match.division ? {
          id: match.division.id,
          name: match.division.name,
          season: match.division.season?.name
        } : null,
        team1Score: match.team1Score,
        team2Score: match.team2Score,
        outcome: match.outcome,
        setScores: match.scores.map(s => ({
          setNumber: s.setNumber,
          team1Games: s.player1Games,
          team2Games: s.player2Games,
          team1Tiebreak: s.player1Tiebreak,
          team2Tiebreak: s.player2Tiebreak,
          hasTiebreak: s.hasTiebreak
        })),
        gameScores: match.pickleballScores.map(g => ({
          gameNumber: g.gameNumber,
          team1Points: g.player1Points,
          team2Points: g.player2Points
        })),
        team1Players: team1Players.map(p => ({
          id: p.user.id,
          name: p.user.name,
          username: p.user.username,
          image: p.user.image
        })),
        team2Players: team2Players.map(p => ({
          id: p.user.id,
          name: p.user.name,
          username: p.user.username,
          image: p.user.image
        })),
        isWalkover: match.isWalkover,
        notes: match.notes,
        comments: match.comments.map(c => ({
          id: c.id,
          userId: c.userId,
          comment: c.comment,
          createdAt: c.createdAt,
          user: {
            id: c.user.id,
            name: c.user.name,
            image: c.user.image
          }
        })),
        resultSubmittedBy: match.resultSubmittedBy ? {
          id: match.resultSubmittedBy.id,
          name: match.resultSubmittedBy.name
        } : null,
        createdAt: match.createdAt
      };
    });
  }
}

// Export singleton instance
let matchHistoryService: MatchHistoryService | null = null;

export function getMatchHistoryService(): MatchHistoryService {
  if (!matchHistoryService) {
    matchHistoryService = new MatchHistoryService();
  }
  return matchHistoryService;
}
