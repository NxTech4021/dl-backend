import { prisma } from "../lib/prisma";
import { PrismaClient } from '@prisma/client';


interface DivisionCreationData {
  rank: number;
  name: string;
  description?: string;
  seasonId: number;
  maxParticipants?: number;
  minRating?: number;
  maxRating?: number;
}

interface DivisionUpdateData {
  rank?: number;
  name?: string;
  description?: string;
  maxParticipants?: number;
  minRating?: number;
  maxRating?: number;
}

// BUSINESS LOGIC SERVICES


// Business Logic: Division creation with validation
export const createDivision = async (data: DivisionCreationData) => {
  const { seasonId, rank, name, minRating, maxRating } = data;

  // Business Rule: Verify season exists
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
  });
  if (!season) {
    throw new Error(`Season with ID ${seasonId} not found.`);
  }

  // Business Rule: Cannot create divisions for completed seasons
  // if (season.status === 'COMPLETED') {
  //   throw new Error('Cannot create divisions for completed seasons.');
  // }

  // Business Rule: Check for duplicate division names in same season
  const existingDivision = await prisma.division.findFirst({
    where: {
      seasonId,
      name: { equals: name, mode: 'insensitive' }
    }
  });
  if (existingDivision) {
    throw new Error(`A division with name "${name}" already exists in this season.`);
  }

  // Business Rule: Check for duplicate rank in same season
  const duplicateRank = await prisma.division.findFirst({
    where: {
      seasonId,
      rank
    }
  });
  if (duplicateRank) {
    throw new Error(`A division with rank ${rank} already exists in this season.`);
  }

  // Business Rule: Rating range validation
  if (minRating && maxRating && minRating >= maxRating) {
    throw new Error('Minimum rating must be less than maximum rating.');
  }

  // Business Rule: Check for overlapping rating ranges in same season
  if (minRating !== undefined || maxRating !== undefined) {
    const overlappingDivisions = await prisma.division.findMany({
      where: {
        seasonId,
        AND: [
          minRating !== undefined ? {
            OR: [
              { maxRating: null },
              { maxRating: { gte: minRating } }
            ]
          } : {},
          maxRating !== undefined ? {
            OR: [
              { minRating: null },
              { minRating: { lte: maxRating } }
            ]
          } : {}
        ]
      }
    });

    if (overlappingDivisions.length > 0) {
      throw new Error('Rating range overlaps with existing division in this season.');
    }
  }

  // Business Logic: Create division
  return prisma.division.create({
    data,
    include: {
      season: { select: { name: true } },
    },
  });
};

// Business Logic: Division update with validation
export const updateDivision = async (id: number, data: DivisionUpdateData) => {
  // Business Rule: Verify division exists
  const division = await prisma.division.findUnique({
    where: { id },
    include: {
      season: { select: { status: true } },
      _count: { select: { registrations: true } }
    }
  });
  
  if (!division) {
    throw new Error(`Division with ID ${id} not found.`);
  }

  // Business Rule: Cannot update divisions for completed seasons
  if (division.season.status === 'COMPLETED') {
    throw new Error('Cannot update divisions for completed seasons.');
  }

  // Business Rule: Check name uniqueness if name is being updated
  if (data.name && data.name !== division.name) {
    const duplicateName = await prisma.division.findFirst({
      where: {
        seasonId: division.seasonId,
        name: { equals: data.name, mode: 'insensitive' },
        id: { not: id }
      }
    });
    if (duplicateName) {
      throw new Error(`A division with name "${data.name}" already exists in this season.`);
    }
  }

  // Business Rule: Check rank uniqueness if rank is being updated
  if (data.rank && data.rank !== division.rank) {
    const duplicateRank = await prisma.division.findFirst({
      where: {
        seasonId: division.seasonId,
        rank: data.rank,
        id: { not: id }
      }
    });
    if (duplicateRank) {
      throw new Error(`A division with rank ${data.rank} already exists in this season.`);
    }
  }

  // Business Rule: Rating range validation
  const newMinRating = data.minRating !== undefined ? data.minRating : division.minRating;
  const newMaxRating = data.maxRating !== undefined ? data.maxRating : division.maxRating;
  
  if (newMinRating && newMaxRating && newMinRating >= newMaxRating) {
    throw new Error('Minimum rating must be less than maximum rating.');
  }

  // Business Rule: Cannot reduce capacity below current registrations
  if (data.maxParticipants && data.maxParticipants < division._count.registrations) {
    throw new Error(`Cannot reduce capacity below current registration count (${division._count.registrations}).`);
  }

  // Business Logic: Update division
  return prisma.division.update({
    where: { id },
    data,
    include: {
      season: { select: { name: true } },
    },
  });
};

// Business Logic: Division deletion with constraint checking
export const deleteDivision = async (id: number) => {
  // Business Rule: Check if division has registrations
  const registrationCount = await prisma.seasonRegistration.count({
    where: { divisionId: id },
  });

  if (registrationCount > 0) {
    throw new Error('Cannot delete a division that has registrations.');
  }

  // Business Logic: Delete division
  return prisma.division.delete({
    where: { id },
  });
};