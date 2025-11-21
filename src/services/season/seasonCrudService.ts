/**
 * Season CRUD Service
 * Handles create, update, and delete operations for seasons
 * Extracted from: seasonService.ts lines 58-345
 */

import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import {
  CreateSeasonInput,
  UpdateSeasonInput,
  UpdateSeasonStatusInput
} from './utils/types';
import { validateCreateSeasonInput, validateUpdateSeasonInput } from './utils/validators';

/**
 * Create a new season
 * Extracted from: seasonService.ts lines 58-120
 *
 * @param data - Season creation data
 * @returns Created season with leagues and categories
 * @throws Error if validation fails or season name already exists
 */
export async function createSeason(data: CreateSeasonInput) {
  const {
    name,
    startDate,
    endDate,
    regiDeadline,
    description,
    entryFee,
    leagueIds,
    categoryIds,
    isActive,
    paymentRequired,
    promoCodeSupported,
    withdrawalEnabled,
  } = data;

  // Validate input
  const validation = validateCreateSeasonInput(data);
  if (!validation.isValid) {
    throw new Error(validation.error || "Invalid season data");
  }

  // Check for existing season with same name
  const existingSeason = await prisma.season.findFirst({
    where: { name },
  });
  if (existingSeason) {
    throw new Error("A season with this name already exists.");
  }

  // Schema defines one-to-one relationship: Season.categoryId → Category.id
  // Take the first categoryId from the array (controller may pass array for consistency)
  const categoryId = categoryIds && categoryIds.length > 0 ? categoryIds[0] : undefined;

  const season = await prisma.season.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      regiDeadline: regiDeadline ? new Date(regiDeadline) : new Date(endDate),
      entryFee: new Prisma.Decimal(entryFee),
      description: description ?? null,
      isActive: isActive ?? false,
      paymentRequired: paymentRequired ?? false,
      promoCodeSupported: promoCodeSupported ?? false,
      withdrawalEnabled: withdrawalEnabled ?? false,
      status: isActive ? "ACTIVE" : "UPCOMING",
      leagues: {
        connect: leagueIds.map(id => ({ id }))
      },
      // Use categoryId (singular) to match schema's one-to-one relationship
      ...(categoryId ? { categoryId } : {}),
    } as any, // Type assertion needed because categoryId may not be recognized in SeasonCreateInput
    include: {
      leagues: {
        select: {
          id: true,
          name: true,
          sportType: true,
          gameType: true
        }
      },
      category: {
        select: {
          id: true,
          name: true,
          genderRestriction: true,
          gender_category: true,
          game_type: true,
          matchFormat: true
        }
      }
    } as any
  });

  console.log(`✅ Season ${season.id} created: ${season.name}`);

  return season;
}

/**
 * Update season status and isActive flag
 * Extracted from: seasonService.ts lines 260-279
 *
 * @param id - Season ID
 * @param data - Status update data
 * @returns Updated season
 */
export async function updateSeasonStatus(
  id: string,
  data: UpdateSeasonStatusInput
) {
  const { status, isActive } = data;

  const finalStatus = status ?? (isActive ? "ACTIVE" : undefined);

  const updateData: any = {};
  if (typeof isActive !== "undefined") {
    updateData.isActive = isActive;
  }
  if (finalStatus) {
    updateData.status = finalStatus;
  }

  const updatedSeason = await prisma.season.update({
    where: { id },
    data: updateData,
  });

  console.log(`✅ Season ${id} status updated to ${finalStatus || 'unchanged'}, isActive: ${isActive}`);

  return updatedSeason;
}

/**
 * Update season details
 * Extracted from: seasonService.ts lines 281-322
 *
 * @param id - Season ID
 * @param data - Update data
 * @returns Updated season with relations
 * @throws Error if validation fails
 */
export async function updateSeason(id: string, data: UpdateSeasonInput) {
  // Validate input
  const validation = validateUpdateSeasonInput(data);
  if (!validation.isValid) {
    throw new Error(validation.error || "Invalid update data");
  }

  const updateData: any = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
  if (data.regiDeadline !== undefined) updateData.regiDeadline = new Date(data.regiDeadline);
  if (data.entryFee !== undefined) updateData.entryFee = new Prisma.Decimal(data.entryFee);
  if (data.description !== undefined) updateData.description = data.description ?? null;
  if (data.leagueIds !== undefined) updateData.leagues = { set: data.leagueIds.map(id => ({ id })) };
  // Schema defines one-to-one relationship: Season.categoryId → Category.id
  // Take the first categoryId from the array (controller may pass array for consistency)
  if (data.categoryIds !== undefined) {
    const categoryId = data.categoryIds && data.categoryIds.length > 0 ? data.categoryIds[0] : null;
    updateData.categoryId = categoryId;
  }
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.paymentRequired !== undefined) updateData.paymentRequired = data.paymentRequired;
  if (data.promoCodeSupported !== undefined) updateData.promoCodeSupported = data.promoCodeSupported;
  if (data.withdrawalEnabled !== undefined) updateData.withdrawalEnabled = data.withdrawalEnabled;

  const updatedSeason = await prisma.season.update({
    where: { id },
    data: updateData,
    include: {
      leagues: {
        select: {
          id: true,
          name: true,
          sportType: true,
          gameType: true
        }
      },
      // Use category (singular) to match schema
      // Type assertion needed because category relation may not be recognized in SeasonInclude
      category: {
        select: {
          id: true,
          name: true,
          genderRestriction: true,
          gender_category: true,
          game_type: true,
          matchFormat: true
        }
      }
    } as any
  });

  console.log(`✅ Season ${id} updated: ${updatedSeason.name}`);

  return updatedSeason;
}

/**
 * Delete a season
 * Extracted from: seasonService.ts lines 324-345
 *
 * SAFETY:
 * - Prevents deletion if season has registered users
 * - This protects against accidental data loss
 *
 * @param seasonId - Season ID to delete
 * @returns Deleted season
 * @throws Error if season not found or has registered users
 */
export async function deleteSeason(seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { id: true, registeredUserCount: true, name: true },
  });

  if (!season) {
    throw new Error("Season not found.");
  }

  if (season.registeredUserCount > 0) {
    throw new Error(
      "Cannot delete season: there are registered users."
    );
  }

  const deleted = await prisma.season.delete({
    where: { id: seasonId },
  });

  console.log(`✅ Season ${seasonId} deleted: ${season.name}`);

  return deleted;
}
