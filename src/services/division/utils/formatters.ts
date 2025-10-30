/**
 * Division Formatters
 * Pure functions for formatting division and season data for API responses
 */

import { toISODateString, toISODateStringOrNull } from './dateHelpers';
import { FormattedSeason, FormattedDivision } from './types';

/**
 * Format season object for API response
 * @param season - Raw season data from database
 * @returns Formatted season object
 */
export function formatSeason(season: any): FormattedSeason {
  return {
    id: season?.id ?? "",
    name: season?.name ?? "",
    sportType: season?.sportType ?? null,
    seasonType: season?.seasonType ?? null,
    description: season?.description ?? null,
    startDate: toISODateStringOrNull(season?.startDate),
    endDate: toISODateStringOrNull(season?.endDate),
    regiDeadline: toISODateStringOrNull(season?.regiDeadline),
    status: season?.status ?? "UPCOMING",
    current:
      season && "current" in season
        ? Boolean(season.current)
        : Boolean(season?.isActive),
    createdAt: toISODateString(season?.createdAt),
    updatedAt: toISODateString(season?.updatedAt),
    memberships: [],
    withdrawalRequests: [],
  };
}

/**
 * Format division object for API response
 * @param division - Raw division data from database
 * @returns Formatted division object
 */
export function formatDivision(division: any): FormattedDivision {
  return {
    id: division.id,
    seasonId: division.seasonId,
    name: division.name,
    description: division.description ?? null,
    threshold:
      division.pointsThreshold !== null && division.pointsThreshold !== undefined
        ? Number(division.pointsThreshold)
        : null,
    divisionLevel: division.level
      ? division.level.toLowerCase()
      : "beginner",
    gameType: division.gameType ? division.gameType.toLowerCase() : "singles",
    genderCategory: division.genderCategory
      ? division.genderCategory.toLowerCase()
      : "mixed",
    maxSingles:
      division.maxSinglesPlayers !== null && division.maxSinglesPlayers !== undefined
        ? Number(division.maxSinglesPlayers)
        : null,
    maxDoublesTeams:
      division.maxDoublesTeams !== null && division.maxDoublesTeams !== undefined
        ? Number(division.maxDoublesTeams)
        : null,
    currentSinglesCount:
      division.currentSinglesCount !== null && division.currentSinglesCount !== undefined
        ? Number(division.currentSinglesCount)
        : null,
    currentDoublesCount:
      division.currentDoublesCount !== null && division.currentDoublesCount !== undefined
        ? Number(division.currentDoublesCount)
        : null,
    autoAssignmentEnabled: division.autoAssignmentEnabled,
    isActive: division.isActiveDivision,
    prizePoolTotal: division.prizePoolTotal
      ? Number(division.prizePoolTotal)
      : null,
    sponsoredDivisionName: division.sponsoredDivisionName ?? null,
    season: formatSeason(division.season),
    createdAt: toISODateString(division.createdAt),
    updatedAt: toISODateString(division.updatedAt),
  };
}
