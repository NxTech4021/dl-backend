import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();

export const getLeagues = async (req: Request, res: Response) => {
  try {
    const { sport } = req.query;

    const leagues = await prisma.league.findMany({
      where: {
        isActive: true,
        ...(sport && { sport: sport as string })
      },
      include: {
        seasons: {
          where: {
            status: {
              in: ['UPCOMING', 'OPEN_REGISTRATION', 'IN_PROGRESS']
            }
          },
          orderBy: { startDate: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      leagues
    });
  } catch (error) {
    console.error('Get leagues error:', error);
    res.status(500).json({ error: 'Failed to get leagues' });
  }
};

export const getLeague = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const league = await prisma.league.findUnique({
      where: { id },
      include: {
        seasons: {
          include: {
            registrations: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true
                  }
                }
              }
            }
          },
          orderBy: { startDate: 'asc' }
        }
      }
    });

    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }

    res.json({
      success: true,
      league
    });
  } catch (error) {
    console.error('Get league error:', error);
    res.status(500).json({ error: 'Failed to get league' });
  }
};

export const getLeagueSeasons = async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params;
    const { category } = req.query;

    const seasons = await prisma.leagueSeason.findMany({
      where: {
        leagueId,
        ...(category && { category: category as string })
      },
      include: {
        league: true,
        registrations: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    res.json({
      success: true,
      seasons
    });
  } catch (error) {
    console.error('Get league seasons error:', error);
    res.status(500).json({ error: 'Failed to get league seasons' });
  }
};

export const getSeason = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const season = await prisma.leagueSeason.findUnique({
      where: { id },
      include: {
        league: true,
        registrations: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true
              }
            },
            payment: {
              select: {
                id: true,
                status: true,
                paidAt: true
              }
            }
          }
        }
      }
    });

    if (!season) {
      return res.status(404).json({ error: 'Season not found' });
    }

    res.json({
      success: true,
      season
    });
  } catch (error) {
    console.error('Get season error:', error);
    res.status(500).json({ error: 'Failed to get season' });
  }
};

export const getUserRegistrations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const registrations = await prisma.leagueRegistration.findMany({
      where: { userId },
      include: {
        season: {
          include: {
            league: true
          }
        },
        payment: {
          select: {
            id: true,
            status: true,
            amount: true,
            paidAt: true
          }
        }
      },
      orderBy: { registeredAt: 'desc' }
    });

    res.json({
      success: true,
      registrations
    });
  } catch (error) {
    console.error('Get user registrations error:', error);
    res.status(500).json({ error: 'Failed to get user registrations' });
  }
};