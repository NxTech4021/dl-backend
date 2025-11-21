import { prisma } from "../lib/prisma";
import { PrismaClient } from '@prisma/client';


export const getAllSports = async () => {
  // return prisma.sport.findMany({ // Commented out: Sport model doesn't exist in Prisma schema
  //   orderBy: {
  //     name: 'asc',
  //   },
  // });
  throw new Error('Sport model does not exist in the database schema');
};
