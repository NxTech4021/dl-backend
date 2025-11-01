import { prisma } from "../lib/prisma";
import { PrismaClient } from '@prisma/client';


export const getAllSports = async () => {
  return prisma.sport.findMany({
    orderBy: {
      name: 'asc',
    },
  });
};
