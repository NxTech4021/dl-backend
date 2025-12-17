/**
 * User Sport Context Service
 * Queries recent sport interactions between users from existing Match/MatchParticipant data
 * Used to determine sport-colored unread indicators in chat list
 */

import { prisma } from '../lib/prisma';
import { SportType } from '@prisma/client';

export interface RecentSportContext {
  sportType: SportType | null;
  lastInteractionAt: Date | null;
  isValid: boolean; // true if within 60 days
}

/**
 * Helper function to get the effective date for a match
 * Priority: resultSubmittedAt > matchDate > createdAt
 */
function getEffectiveDate(match: { resultSubmittedAt: Date | null; matchDate: Date; createdAt: Date }): Date {
  return match.resultSubmittedAt || match.matchDate || match.createdAt;
}

/**
 * Get most recent sport interaction between two users within 60 days
 */
export async function getRecentSportContext(
  userId1: string,
  userId2: string
): Promise<RecentSportContext> {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  // Find matches where both users participated within 60 days
  // We fetch multiple matches and sort them in JS to handle NULL values correctly
  const recentMatches = await prisma.match.findMany({
    where: {
      AND: [
        {
          participants: {
            some: { userId: userId1 }
          }
        },
        {
          participants: {
            some: { userId: userId2 }
          }
        },
        {
          OR: [
            // Matches that were played (result submitted)
            { resultSubmittedAt: { not: null } },
            // Friendly match requests
            { isFriendlyRequest: true },
            // Matches where both users accepted
            {
              AND: [
                {
                  participants: {
                    some: {
                      userId: userId1,
                      invitationStatus: 'ACCEPTED'
                    }
                  }
                },
                {
                  participants: {
                    some: {
                      userId: userId2,
                      invitationStatus: 'ACCEPTED'
                    }
                  }
                }
              ]
            }
          ]
        },
        // Within 60 days - use most recent date field available
        {
          OR: [
            { resultSubmittedAt: { gte: sixtyDaysAgo } },
            { matchDate: { gte: sixtyDaysAgo } },
            { createdAt: { gte: sixtyDaysAgo } }
          ]
        }
      ]
    },
    select: {
      sport: true,
      resultSubmittedAt: true,
      matchDate: true,
      createdAt: true,
      isFriendlyRequest: true,
      requestRecipientId: true,
      createdById: true
    }
  });

  if (recentMatches.length === 0) {
    return {
      sportType: null,
      lastInteractionAt: null,
      isValid: false
    };
  }

  // Sort by effective date (most recent first)
  // This handles NULL resultSubmittedAt correctly by falling back to matchDate/createdAt
  recentMatches.sort((a, b) => {
    const dateA = getEffectiveDate(a);
    const dateB = getEffectiveDate(b);
    return dateB.getTime() - dateA.getTime();
  });

  const recentMatch = recentMatches[0];

  // Determine the most recent interaction date
  const lastInteractionAt = getEffectiveDate(recentMatch);

  // Check if within 60 days
  const isValid = lastInteractionAt >= sixtyDaysAgo;

  return {
    sportType: recentMatch.sport as SportType,
    lastInteractionAt,
    isValid
  };
}

/**
 * Batch query sport contexts for multiple user pairs
 * Optimized for thread list where we need contexts for all direct chat participants
 */
export async function getRecentSportContextsBatch(
  currentUserId: string,
  otherUserIds: string[]
): Promise<Map<string, RecentSportContext>> {
  if (otherUserIds.length === 0) {
    return new Map();
  }

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  // Single query to get recent matches for all pairs
  // Note: We don't rely on orderBy because NULL values sort incorrectly.
  // Instead, we fetch all matches and sort in JS for correct "effective date" comparison.
  const recentMatches = await prisma.match.findMany({
    where: {
      AND: [
        {
          participants: {
            some: { userId: currentUserId }
          }
        },
        {
          participants: {
            some: { userId: { in: otherUserIds } }
          }
        },
        {
          OR: [
            // Matches that were played (result submitted)
            { resultSubmittedAt: { not: null } },
            // Friendly match requests
            { isFriendlyRequest: true },
            // Matches where both users accepted
            {
              AND: [
                {
                  participants: {
                    some: {
                      userId: currentUserId,
                      invitationStatus: 'ACCEPTED'
                    }
                  }
                },
                {
                  participants: {
                    some: {
                      userId: { in: otherUserIds },
                      invitationStatus: 'ACCEPTED'
                    }
                  }
                }
              ]
            }
          ]
        },
        // Within 60 days
        {
          OR: [
            { resultSubmittedAt: { gte: sixtyDaysAgo } },
            { matchDate: { gte: sixtyDaysAgo } },
            { createdAt: { gte: sixtyDaysAgo } }
          ]
        }
      ]
    },
    include: {
      participants: {
        select: { userId: true }
      }
    }
  });

  // Sort all matches by effective date (most recent first)
  // This correctly handles matches where resultSubmittedAt is NULL
  recentMatches.sort((a, b) => {
    const dateA = getEffectiveDate(a);
    const dateB = getEffectiveDate(b);
    return dateB.getTime() - dateA.getTime();
  });

  // Group by user pair and get most recent sport for each pair
  const sportContextsByPair = new Map<string, RecentSportContext>();

  for (const match of recentMatches) {
    const participantIds = match.participants.map(p => p.userId);
    const otherUserId = participantIds.find(
      id => id !== currentUserId && otherUserIds.includes(id)
    );

    if (otherUserId) {
      const key = `${currentUserId}-${otherUserId}`;
      
      // Only add if we haven't seen this pair yet (since results are now correctly sorted by effective date)
      if (!sportContextsByPair.has(key)) {
        const lastInteractionAt = getEffectiveDate(match);
        const isValid = lastInteractionAt >= sixtyDaysAgo;

        sportContextsByPair.set(key, {
          sportType: match.sport as SportType,
          lastInteractionAt,
          isValid
        });
      }
    }
  }

  // Fill in null contexts for user pairs with no recent interactions
  for (const otherUserId of otherUserIds) {
    const key = `${currentUserId}-${otherUserId}`;
    if (!sportContextsByPair.has(key)) {
      sportContextsByPair.set(key, {
        sportType: null,
        lastInteractionAt: null,
        isValid: false
      });
    }
  }

  return sportContextsByPair;
}

