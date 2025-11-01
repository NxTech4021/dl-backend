/**
 * Division Capacity Service
 * Handles capacity checking and count management for divisions
 * ISOLATED - No dependencies on other services
 */

import { prisma } from '../../lib/prisma';
import { GameType, Prisma } from "@prisma/client";
import { DivisionCapacityResult } from './utils/types';

/**
 * Check if division has capacity for new assignments
 * @param divisionId - Division ID to check
 * @param gameType - Game type (SINGLES or DOUBLES)
 * @returns Capacity information with hasCapacity flag
 */
export async function checkDivisionCapacity(
  divisionId: string,
  gameType: GameType
): Promise<DivisionCapacityResult> {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: {
      maxSinglesPlayers: true,
      maxDoublesTeams: true,
      currentSinglesCount: true,
      currentDoublesCount: true,
      gameType: true,
      name: true
    }
  });

  if (!division) {
    throw new Error("Division not found");
  }

  const isSingles = gameType === GameType.SINGLES;
  const maxCapacity = isSingles ? division.maxSinglesPlayers : division.maxDoublesTeams;
  const currentCount = isSingles ? (division.currentSinglesCount || 0) : (division.currentDoublesCount || 0);

  return {
    hasCapacity: maxCapacity ? currentCount < maxCapacity : true,
    currentCount,
    maxCapacity,
    division
  };
}

/**
 * Update division player/team counts (atomic operation)
 * @param divisionId - Division ID to update
 * @param increment - True to increment, false to decrement
 */
export async function updateDivisionCounts(
  divisionId: string,
  increment: boolean = true
): Promise<void> {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { gameType: true }
  });

  if (!division) return;

  const isSingles = division.gameType === GameType.SINGLES;
  const updateData = isSingles
    ? { currentSinglesCount: { increment: increment ? 1 : -1 } }
    : { currentDoublesCount: { increment: increment ? 1 : -1 } };

  await prisma.division.update({
    where: { id: divisionId },
    data: updateData
  });
}

/**
 * Update division counts within a transaction
 * @param tx - Prisma transaction client
 * @param divisionId - Division ID to update
 * @param increment - True to increment, false to decrement
 */
export async function updateDivisionCountsInTransaction(
  tx: Prisma.TransactionClient,
  divisionId: string,
  increment: boolean = true
): Promise<void> {
  const division = await tx.division.findUnique({
    where: { id: divisionId },
    select: { gameType: true }
  });

  if (!division) return;

  const isSingles = division.gameType === GameType.SINGLES;
  const updateData = isSingles
    ? { currentSinglesCount: { increment: increment ? 1 : -1 } }
    : { currentDoublesCount: { increment: increment ? 1 : -1 } };

  await tx.division.update({
    where: { id: divisionId },
    data: updateData
  });
}

/**
 * Get current capacity information for a division
 * @param divisionId - Division ID
 * @returns Current capacity stats
 */
export async function getDivisionCapacityInfo(divisionId: string) {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: {
      id: true,
      name: true,
      gameType: true,
      maxSinglesPlayers: true,
      maxDoublesTeams: true,
      currentSinglesCount: true,
      currentDoublesCount: true
    }
  });

  if (!division) {
    throw new Error("Division not found");
  }

  const isSingles = division.gameType === GameType.SINGLES;
  const maxCapacity = isSingles ? division.maxSinglesPlayers : division.maxDoublesTeams;
  const currentCount = isSingles ? (division.currentSinglesCount || 0) : (division.currentDoublesCount || 0);
  const availableSlots = maxCapacity ? maxCapacity - currentCount : null;
  const utilizationRate = maxCapacity ? (currentCount / maxCapacity) * 100 : 0;

  return {
    divisionId: division.id,
    divisionName: division.name,
    gameType: division.gameType,
    maxCapacity,
    currentCount,
    availableSlots,
    utilizationRate: Math.round(utilizationRate * 100) / 100,
    isFull: maxCapacity ? currentCount >= maxCapacity : false
  };
}
