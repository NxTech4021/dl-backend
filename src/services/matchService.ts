/**
 * Match Service
 * Handles match creation with inactivity reactivation
 */

import { prisma } from '../lib/prisma';
import { MatchStatus } from '@prisma/client';
import { getInactivityService } from './inactivityService';
import { NotificationService } from './notificationService';
import { logger } from '../utils/logger';

/**
 * Hook to reactivate players after match creation
 * Call this function after successfully creating a match
 */
export async function handlePostMatchCreation(matchId: string): Promise<void> {
  try {
    // Get all participants from the match
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: {
          select: { userId: true },
        },
      },
    });

    if (!match) {
      logger.warn(`Match ${matchId} not found for reactivation check`);
      return;
    }

    // Reactivate each participant if they were inactive
    const notificationService = new NotificationService();
    const inactivityService = getInactivityService(notificationService);

    for (const participant of match.participants) {
      await inactivityService.reactivateUser(participant.userId);
    }

    logger.info(`Processed reactivation check for ${match.participants.length} participants in match ${matchId}`);
  } catch (error) {
    logger.error(`Error in post-match reactivation for match ${matchId}:`, {}, error as Error);
    // Don't throw - reactivation failure shouldn't block match creation
  }
}

/**
 * Create a FeedPost for a completed match
 * Returns the feedPostId if created successfully, null otherwise
 *
 * @param matchId - The completed match ID
 * @param authorId - The user ID who should be the author (typically result confirmer)
 */
export async function createMatchFeedPost(
  matchId: string,
  authorId: string
): Promise<string | null> {
  try {
    // Fetch match with all required data
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: {
          select: {
            userId: true,
            team: true,
          },
        },
        feedPosts: {
          where: { authorId, isDeleted: false },
          select: { id: true },
        },
      },
    });

    if (!match) {
      logger.warn(`Match ${matchId} not found for feed post creation`);
      return null;
    }

    // Only create for completed matches
    if (match.status !== MatchStatus.COMPLETED) {
      logger.warn(`Match ${matchId} is not completed, skipping feed post creation`);
      return null;
    }

    // Check if author is a participant
    const isParticipant = match.participants.some(p => p.userId === authorId);
    if (!isParticipant) {
      logger.warn(`User ${authorId} is not a participant in match ${matchId}`);
      return null;
    }

    // Check if this author already has a post for this match
    const existingPost = match.feedPosts[0];
    if (existingPost) {
      logger.info(`User ${authorId} already has a feed post for match ${matchId}`);
      return existingPost.id;
    }

    // Determine winning team based on scores
    const team1Score = match.team1Score ?? 0;
    const team2Score = match.team2Score ?? 0;
    const winningTeam = team1Score > team2Score ? 'team1' : 'team2';

    // Extract winner/loser IDs based on team assignment
    const winnerIds = match.participants
      .filter(p => p.team === winningTeam)
      .map(p => p.userId);
    const loserIds = match.participants
      .filter(p => p.team !== winningTeam)
      .map(p => p.userId);

    // Determine game type (league vs friendly)
    const gameType = match.leagueId ? 'league' : 'friendly';

    // Create the feed post
    const feedPost = await prisma.feedPost.create({
      data: {
        matchId,
        authorId,
        caption: null, // User can add caption later via share prompt
        sport: match.sport,
        matchType: match.matchType.toLowerCase(),
        gameType,
        winnerIds,
        loserIds,
        matchDate: match.matchDate,
      },
    });

    logger.info(`Created feed post ${feedPost.id} for match ${matchId} by user ${authorId}`);
    return feedPost.id;
  } catch (error) {
    logger.error(`Error creating feed post for match ${matchId}:`, {}, error as Error);
    // Don't throw - feed post creation failure shouldn't block match completion
    return null;
  }
}
