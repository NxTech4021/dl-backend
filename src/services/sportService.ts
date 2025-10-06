import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllSports = async () => {
  return prisma.sport.findMany({
    orderBy: {
      name: 'asc',
    },
  });
};
