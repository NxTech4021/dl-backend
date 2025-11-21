import { prisma } from "../lib/prisma";
// import { PrismaClient, LeagueTypeType, Gender } from '@prisma/client'; // Commented out: LeagueTypeType and Gender don't exist in Prisma schema
import { PrismaClient } from '@prisma/client';


// interface LeagueTypeCreationData {
//   name: string;
//   type: LeagueTypeType;
//   gender: Gender;
// } // Commented out: LeagueTypeType and Gender don't exist

// interface LeagueTypeUpdateData {
//   name?: string;
//   type?: LeagueTypeType;
//   gender?: Gender;
// } // Commented out: LeagueTypeType and Gender don't exist

interface LeagueTypeCreationData {
  name: string;
  type: string; // Using string instead of non-existent LeagueTypeType
  gender: string; // Using string instead of non-existent Gender
}

interface LeagueTypeUpdateData {
  name?: string;
  type?: string; // Using string instead of non-existent LeagueTypeType
  gender?: string; // Using string instead of non-existent Gender
}


// BUSINESS LOGIC SERVICES 


// Business Logic: League type creation with validation
export const createLeagueType = async (data: LeagueTypeCreationData) => {
  // const { name, type, gender } = data; // Commented out: leagueType model doesn't exist

  // Business Rule: Check for duplicate league type combinations
  // const existingLeagueType = await prisma.leagueType.findFirst({ // Commented out: leagueType model doesn't exist
  //   where: {
  //     OR: [
  //       // Exact name match
  //       { name: { equals: name, mode: 'insensitive' } },
  //       // Same type and gender combination
  //       { type, gender }
  //     ]
  //   }
  // });

  // if (existingLeagueType) {
  //   if (existingLeagueType.name.toLowerCase() === name.toLowerCase()) {
  //     throw new Error(`A league type with name "${name}" already exists.`);
  //   } else {
  //     throw new Error(`A league type with type "${type}" and gender "${gender}" already exists.`);
  //   }
  // }

  // Business Logic: Create league type
  // return prisma.leagueType.create({ // Commented out: leagueType model doesn't exist
  //   data: { name, type, gender },
  // });
  throw new Error('LeagueType model does not exist in the database schema');
};

// Business Logic: League type update with validation
export const updateLeagueType = async (id: number, data: LeagueTypeUpdateData) => {
  // Business Rule: Verify league type exists
  // const leagueType = await prisma.leagueType.findUnique({ // Commented out: leagueType model doesn't exist
  //   where: { id },
  //   include: {
  //     _count: { select: { seasons: true } }
  //   }
  // });
  
  // if (!leagueType) {
  //   throw new Error(`League type with ID ${id} not found.`);
  // }

  // Business Rule: Cannot modify league type that has active seasons
  // if (leagueType._count.seasons > 0 && (data.type || data.gender)) {
  //   const hasActiveSeasons = await prisma.season.count({
  //     where: {
  //       leagueTypeId: id, // Commented out: leagueTypeId doesn't exist on Season model
  //       status: {
  //         in: ['UPCOMING', 'REGISTRATION_OPEN', 'IN_PROGRESS'] // Commented out: REGISTRATION_OPEN and IN_PROGRESS don't exist in SeasonStatus enum
  //       }
  //     }
  //   });

  //   if (hasActiveSeasons > 0) {
  //     throw new Error('Cannot modify type or gender of league type with active seasons.');
  //   }
  // }

  // Business Rule: Check for duplicate names if name is being updated
  // if (data.name && data.name !== leagueType.name) {
  //   const duplicateName = await prisma.leagueType.findFirst({ // Commented out: leagueType model doesn't exist
  //     where: {
  //       name: { equals: data.name, mode: 'insensitive' },
  //       id: { not: id }
  //     }
  //   });
  //   if (duplicateName) {
  //     throw new Error(`A league type with name "${data.name}" already exists.`);
  //   }
  // }

  // Business Rule: Check for duplicate type/gender combination if being updated
  // if (data.type || data.gender) {
  //   const newType = data.type || leagueType.type;
  //   const newGender = data.gender || leagueType.gender;

  //   const duplicateCombination = await prisma.leagueType.findFirst({ // Commented out: leagueType model doesn't exist
  //     where: {
  //       type: newType,
  //       gender: newGender,
  //       id: { not: id }
  //     }
  //   });
  //   if (duplicateCombination) {
  //     throw new Error(`A league type with type "${newType}" and gender "${newGender}" already exists.`);
  //   }
  // }

  // Business Logic: Update league type
  // return prisma.leagueType.update({ // Commented out: leagueType model doesn't exist
  //   where: { id },
  //   data,
  // });
  throw new Error('LeagueType model does not exist in the database schema');
};

// Business Logic: League type deletion with constraint checking
export const deleteLeagueType = async (id: number) => {
  // Business Rule: Check if league type has seasons
  // const seasonCount = await prisma.season.count({ // Commented out: leagueTypeId doesn't exist on Season model
  //   where: { leagueTypeId: id },
  // });

  // if (seasonCount > 0) {
  //   throw new Error('Cannot delete a league type that has seasons.');
  // }

  // Business Logic: Delete league type
  // return prisma.leagueType.delete({ // Commented out: leagueType model doesn't exist
  //   where: { id },
  // });
  throw new Error('LeagueType model does not exist in the database schema');
};