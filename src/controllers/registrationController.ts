import { Request, Response } from 'express';
import { PrismaClient, RegistrationType } from '@prisma/client';
import * as registrationService from '../services/registrationService';
import { ApiResponse } from '../utils/ApiResponse';

const prisma = new PrismaClient();

export const getRegistrations = async (req: Request, res: Response) => {
  try {
    const { seasonId, divisionId, registrationType, isActive, playerId, teamId } = req.query;

    // Build where clause
    const where: any = {};
    if (seasonId) where.seasonId = Number(seasonId);
    if (divisionId) where.divisionId = Number(divisionId);
    if (registrationType) where.registrationType = registrationType as RegistrationType;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (playerId) where.playerId = playerId as string;
    if (teamId) where.teamId = teamId as string;

    const registrations = await prisma.seasonRegistration.findMany({
      where,
      include: {
        player: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true
          }
        },
        team: {
          select: {
            id: true,
            name: true,
            captain: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        season: {
          select: {
            id: true,
            name: true,
            entryFee: true,
            league: {
              select: {
                name: true,
                sport: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        division: {
          select: {
            id: true,
            name: true,
            rank: true
          }
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            paidAt: true
          }
        }
      },
      orderBy: {
        registeredAt: 'desc'
      }
    });

    // Transform for frontend
    const transformedRegistrations = registrations.map(registration => ({
      id: registration.id,
      entityName: registration.player?.name ?? registration.team?.name,
      entityType: registration.registrationType,
      playerId: registration.playerId,
      teamId: registration.teamId,
      season: registration.season,
      division: registration.division,
      payment: registration.payment,
      paymentStatus: registration.payment?.status ?? 'UNPAID',
      registeredAt: registration.registeredAt,
      isActive: registration.isActive,
      flags: registration.flags
    }));

    if (transformedRegistrations.length === 0) {
      return res.status(200).json(
        new ApiResponse(true, 200, [], "No registrations found")
      );
    }

    return res.status(200).json(
      new ApiResponse(true, 200, transformedRegistrations, "Registrations fetched successfully")
    );
  } catch (error) {
    console.error("Error fetching registrations:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error fetching registrations")
    );
  }
};

export const getRegistrationById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Invalid registration ID')
      );
    }

    const registration = await prisma.seasonRegistration.findUnique({
      where: { id },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true
          }
        },
        team: {
          select: {
            id: true,
            name: true,
            description: true,
            captain: {
              select: {
                name: true,
                email: true
              }
            },
            members: {
              select: {
                user: {
                  select: {
                    name: true,
                    email: true
                  }
                },
                role: true
              }
            }
          }
        },
        season: {
          select: {
            id: true,
            name: true,
            entryFee: true,
            startDate: true,
            endDate: true,
            lastRegistration: true,
            status: true,
            league: {
              select: {
                name: true,
                sport: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        division: {
          select: {
            id: true,
            name: true,
            rank: true,
            description: true,
            maxParticipants: true,
            minRating: true,
            maxRating: true
          }
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            paymentMethod: true,
            paidAt: true,
            notes: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, 'Registration not found')
      );
    }

    // Transform for detailed view
    const transformedRegistration = {
      id: registration.id,
      entityName: registration.player?.name ?? registration.team?.name,
      entityType: registration.registrationType,
      player: registration.player,
      team: registration.team,
      season: registration.season,
      division: registration.division,
      payment: registration.payment,
      paymentStatus: registration.payment?.status ?? 'UNPAID',
      registeredAt: registration.registeredAt,
      isActive: registration.isActive,
      flags: registration.flags
    };

    return res.status(200).json(
      new ApiResponse(true, 200, transformedRegistration, "Registration details fetched successfully")
    );
  } catch (error: any) {
    console.error("Error fetching registration:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error fetching registration")
    );
  }
};

export const registerPlayer = async (req: Request, res: Response) => {
  try {
    const { playerId, seasonId, divisionId, flags } = req.body;

    if (!playerId || !seasonId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Missing required fields: playerId, seasonId')
      );
    }

    const registrationData = {
      playerId,
      seasonId: parseInt(seasonId),
      registrationType: 'PLAYER' as const,
      divisionId: divisionId ? parseInt(divisionId) : undefined,
      flags: flags ? parseInt(flags) : 0,
    };

    // Use service for complex business logic
    const newRegistration = await registrationService.createRegistration(registrationData);
    
    return res.status(201).json(
      new ApiResponse(true, 201, newRegistration, "Player registered successfully")
    );
  } catch (error: any) {
    console.error("Register player error:", error);
    if (error.message.includes('not found') || error.message.includes('already registered') || error.message.includes('Registration period')) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, error.message)
      );
    }
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error registering player")
    );
  }
};

export const registerTeam = async (req: Request, res: Response) => {
  try {
    const { teamId, seasonId, divisionId, flags } = req.body;

    if (!teamId || !seasonId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Missing required fields: teamId, seasonId')
      );
    }

    const registrationData = {
      teamId,
      seasonId: parseInt(seasonId),
      registrationType: 'TEAM' as const,
      divisionId: divisionId ? parseInt(divisionId) : undefined,
      flags: flags ? parseInt(flags) : 0,
    };

    // Use service for complex business logic
    const newRegistration = await registrationService.createRegistration(registrationData);
    
    return res.status(201).json(
      new ApiResponse(true, 201, newRegistration, "Team registered successfully")
    );
  } catch (error: any) {
    console.error("Register team error:", error);
    if (error.message.includes('not found') || error.message.includes('already registered') || error.message.includes('Registration period')) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, error.message)
      );
    }
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error registering team")
    );
  }
};

export const updateRegistration = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Invalid registration ID')
      );
    }

    const updateData = { ...req.body };
    
    // Convert numeric fields
    if (updateData.divisionId) {
      updateData.divisionId = parseInt(updateData.divisionId);
    }
    if (updateData.flags) {
      updateData.flags = parseInt(updateData.flags);
    }
    if (updateData.isActive !== undefined) {
      updateData.isActive = updateData.isActive === true || updateData.isActive === 'true';
    }

    // Use service for business logic
    const updatedRegistration = await registrationService.updateRegistration(id, updateData);
    
    return res.status(200).json(
      new ApiResponse(true, 200, updatedRegistration, "Registration updated successfully")
    );
  } catch (error: any) {
    console.error("Error updating registration:", error);
    if (error.message.includes('not found')) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, error.message)
      );
    }
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error updating registration")
    );
  }
};

export const cancelRegistration = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Invalid registration ID')
      );
    }

    // Use service for business logic
    const cancelledRegistration = await registrationService.cancelRegistration(id);
    
    return res.status(200).json(
      new ApiResponse(true, 200, cancelledRegistration, "Registration cancelled successfully")
    );
  } catch (error: any) {
    console.error("Error cancelling registration:", error);
    if (error.message.includes('not found') || error.message.includes('already cancelled')) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, error.message)
      );
    }
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error cancelling registration")
    );
  }
};

export const deleteRegistration = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Invalid registration ID')
      );
    }

    // Use service for business logic
    await registrationService.deleteRegistration(id);
    
    return res.status(200).json(
      new ApiResponse(true, 200, null, "Registration deleted successfully")
    );
  } catch (error: any) {
    console.error("Error deleting registration:", error);
    if (error.message.includes('not found')) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, error.message)
      );
    }
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error deleting registration")
    );
  }
};