/**
 * Player Data Transformation Utilities
 * Shared logic for enriching player data with sports and skill ratings
 */

import { prisma } from '../../../lib/prisma';
import { SkillRating } from './types';

/**
 * Standard player selection fields
 */
export const PLAYER_SELECT_FIELDS = {
  id: true,
  name: true,
  username: true,
  displayUsername: true,
  image: true,
  bio: true,
  area: true,
  gender: true,
  dateOfBirth: true,
  status: true,
  createdAt: true,
  lastLogin: true,
  completedOnboarding: true,
  email: true,
  emailVerified: true,
};

/**
 * PATTERN A: Fetch questionnaires with embedded result (include join)
 * Used by: getAllPlayers, searchPlayers, getAvailablePlayersForSeason, getFavorites, getPublicPlayerProfile
 */
export async function fetchPlayerQuestionnaires(userId: string | string[]) {
  const whereClause = Array.isArray(userId)
    ? { userId: { in: userId } }
    : { userId };

  return prisma.questionnaireResponse.findMany({
    where: whereClause,
    include: { result: true },
  });
}

/**
 * PATTERN B: Fetch questionnaires with separate result query
 * Used by: getPlayerProfile (more detailed with questionnaireStatus)
 */
export async function fetchPlayerQuestionnairesDetailed(userId: string) {
  const responses = await prisma.questionnaireResponse.findMany({
    where: { userId },
    orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
  });

  const completedIds = responses.filter(r => r.completedAt).map(r => r.id);
  const results = completedIds.length > 0
    ? await prisma.initialRatingResult.findMany({
        where: { responseId: { in: completedIds } }
      })
    : [];

  const resultMap = new Map(results.map(r => [r.responseId, r]));

  return { responses, resultMap };
}

/**
 * Extract sports array from questionnaire responses
 */
export function extractSports(responses: any[]): string[] {
  return Array.from(new Set(responses.map(r => r.sport.toLowerCase())));
}

/**
 * Build skill ratings for Pattern A (with embedded result)
 */
export function buildSkillRatings(responses: any[]): Record<string, SkillRating> {
  const skillRatings: Record<string, SkillRating> = {};

  console.log('🔍 buildSkillRatings - Input:', {
    responseCount: responses.length,
    responses: responses.map(r => ({
      id: r.id,
      sport: r.sport,
      hasResult: !!r.result,
      hasCompletedAt: !!r.completedAt,
      completedAt: r.completedAt,
      result: r.result ? {
        hasSingles: !!r.result.singles,
        hasDoubles: !!r.result.doubles,
        singles: r.result.singles,
        doubles: r.result.doubles,
      } : null,
    })),
  });

  responses.forEach(res => {
    if (res.result && res.completedAt) {
      skillRatings[res.sport.toLowerCase()] = {
        singles: res.result.singles ? res.result.singles / 1000 : null,
        doubles: res.result.doubles ? res.result.doubles / 1000 : null,
        rating: (res.result.doubles ?? res.result.singles ?? 0) / 1000,
        confidence: res.result.confidence ?? 'N/A',
        rd: res.result.rd ?? 0,
      };
    } else {
      console.log('🔍 buildSkillRatings - Skipping response:', {
        id: res.id,
        sport: res.sport,
        reason: !res.result ? 'no result' : 'no completedAt',
        hasResult: !!res.result,
        hasCompletedAt: !!res.completedAt,
      });
    }
  });

  console.log('🔍 buildSkillRatings - Output:', {
    skillRatingsKeys: Object.keys(skillRatings),
    skillRatings,
  });

  return skillRatings;
}

/**
 * Build skill ratings for Pattern B (with separate resultMap and lastUpdated)
 */
export function buildSkillRatingsDetailed(
  responses: any[],
  resultMap: Map<string, any>
): Record<string, SkillRating> {
  const skillRatings: Record<string, SkillRating> = {};

  responses.forEach(res => {
    const result = resultMap.get(res.id);
    if (result && res.completedAt) {
      skillRatings[res.sport.toLowerCase()] = {
        singles: result.singles ? result.singles / 1000 : null,
        doubles: result.doubles ? result.doubles / 1000 : null,
        rating: (result.doubles ?? result.singles ?? 0) / 1000,
        confidence: result.confidence ?? 'N/A',
        rd: result.rd ?? 0,
        lastUpdated: res.completedAt,
      };
    }
  });

  return skillRatings;
}

/**
 * Build questionnaire status map (Pattern B only)
 */
export function buildQuestionnaireStatus(responses: any[]): Record<string, any> {
  return responses.reduce((acc, res) => {
    acc[res.sport.toLowerCase()] = {
      isCompleted: !!res.completedAt,
      startedAt: res.startedAt,
      completedAt: res.completedAt,
    };
    return acc;
  }, {} as Record<string, any>);
}

/**
 * Enrich single player with sports and skills (Pattern A)
 */
export async function enrichPlayerWithSkills(player: any) {
  const responses = await fetchPlayerQuestionnaires(player.id);
  return {
    ...player,
    sports: extractSports(responses),
    skillRatings: buildSkillRatings(responses),
  };
}

/**
 * Enrich multiple players with sports and skills (Pattern A - optimized batch query)
 */
export async function enrichPlayersWithSkills(players: any[]) {
  if (players.length === 0) return [];

  const playerIds = players.map(p => p.id);
  const responses = await fetchPlayerQuestionnaires(playerIds);

  // Group responses by userId
  const responsesByUserId = responses.reduce((acc, res) => {
    (acc[res.userId] = acc[res.userId] || []).push(res);
    return acc;
  }, {} as Record<string, typeof responses>);

  // Enrich each player
  return players.map(player => {
    const userResponses = responsesByUserId[player.id] || [];
    return {
      ...player,
      sports: extractSports(userResponses),
      skillRatings: Object.keys(buildSkillRatings(userResponses)).length > 0
        ? buildSkillRatings(userResponses)
        : null,
    };
  });
}

/**
 * DEPRECATED: Check player activity status (currently unused in codebase)
 * Kept for backward compatibility if needed in future
 */
export async function checkPlayerActivityStatus(userId: string): Promise<string> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentMatches = await prisma.match.count({
      where: {
        participants: {
          some: { userId: userId },
        },
        matchDate: { gte: thirtyDaysAgo },
      },
    });

    const isActive = recentMatches > 0;

    await prisma.user.update({
      where: { id: userId },
      data: {
        status: isActive ? 'active' : 'inactive',
        lastActivityCheck: new Date(),
      },
    });

    return isActive ? 'active' : 'inactive';
  } catch (error) {
    console.error("Error checking activity status:", error);
    return 'active'; // Default to active on error
  }
}
