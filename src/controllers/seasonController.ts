import { PrismaClient, Prisma,  SeasonStatus } from '@prisma/client';
import { ApiResponse } from '../utils/ApiResponse';
import { getActiveSeasonService, getSeasonByIdService, getAllSeasonsService, createSeasonService } from '../services/seasonService';

const prisma = new PrismaClient(); 

export const createSeason = async (req: Request, res: Response) => {
  const {
    name,
    startDate,
    endDate,
    regiDeadline,
    sportType,
    seasonType,
    description,
    entryFee,
    leagueId,
    categoryId,
    isActive,
    paymentRequired,
    promoCodeSupported,
    withdrawalEnabled,
  } = req.body;

  // Basic validation
  if (!name || !startDate || !endDate || !sportType || !leagueId || !categoryId || !entryFee) {
    return res.status(400).json(new ApiResponse(false, 400, null, "Missing required fields"));
  }

  try {
    const newSeason = await createSeasonService({
      name,
      startDate,
      endDate,
      regiDeadline,
      sportType,
      seasonType,
      description,
      entryFee,
      leagueId,
      categoryId,
      isActive,
      paymentRequired,
      promoCodeSupported,
      withdrawalEnabled,
    });

    return res.status(201).json(new ApiResponse(true, 201, newSeason, "Season created successfully"));
  } catch (error: any) {
    console.error("Error creating season:", error);

    if (error.message.includes("already exists")) {
      return res.status(409).json(new ApiResponse(false, 409, null, error.message));
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return res.status(400).json(new ApiResponse(false, 400, null, "Invalid leagueId or categoryId"));
      }
    }

    return res.status(500).json(new ApiResponse(false, 500, null, "Failed to create season"));
  }
};

export const getSeasons = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { active } = req.query; 

  try {
    if (id) {
      const season = await getSeasonByIdService(id);
      if (!season) return res.status(404).json({ error: "Season not found." });
      return res.status(200).json(season);
    }

    if (active === "true") {
      const activeSeason = await getActiveSeasonService();
      if (!activeSeason)
        return res.status(404).json({ error: "No active season found." });
      return res.status(200).json(activeSeason);
    }

    const seasons = await getAllSeasonsService();
    res.status(200).json(seasons);
  } catch (error: any) {
    console.error("Error fetching seasons:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return res
        .status(400)
        .json({ error: "Invalid query parameters or field selection." });
    }

    res.status(500).json({ error: "Failed to fetch seasons. Try again later." });
  }
};

export const getSeasonById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const season = await getSeasonByIdService(id);
    if (!season) {
      return res.status(404).json({ error: "Season not found." });
    }

    res.status(200).json(season);
  } catch (error: any) {
    console.error(`Error fetching season ${id}:`, error);
    res.status(500).json({ error: "Failed to retrieve season details." });
  }
};


export const updateSeason = async (req: any, res: any) => {
  const { id } = req.params;
  const { 
    name, 
    startDate, 
    endDate, 
    regiDeadline,       
    sportType,        
    seasonType,         
    description,
    status,
    current
  } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Missing required parameter: id." });
  }

  

  try {
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (current !== undefined) updateData.current = Boolean(current);

    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (regiDeadline) updateData.regiDeadline = new Date(regiDeadline);

    if (sportType !== undefined) updateData.sportType = sportType;
    if (seasonType !== undefined) updateData.seasonType = seasonType;

    if (status !== undefined) {
    switch (status.toUpperCase()) {
        case "UPCOMING":
        updateData.status = SeasonStatus.UPCOMING;
        break;
        case "ACTIVE":
        updateData.status = SeasonStatus.ACTIVE;
        break;
        case "FINISHED":
        updateData.status = SeasonStatus.FINISHED;
        break;
        case "CANCELLED":
        updateData.status = SeasonStatus.CANCELLED;
        break;
        default:
        return res.status(400).json({ 
            error: `Invalid status value. Must be one of: UPCOMING, ACTIVE, FINISHED OR CANCELLED` 
        });
    }
    }

    const updatedSeason = await prisma.season.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json(updatedSeason);
  } catch (error: any) {
    console.error("Error updating season:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: "Season not found for update." });
      }
      if (error.code === 'P2002') {
        return res.status(409).json({ error: "Unique constraint failed. A season with this name and sport already exists." });
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return res.status(400).json({ error: "Invalid data format for season update." });
    }

    res.status(500).json({ error: "Failed to update season. Please try again later." });
  }
};

export const deleteSeason = async (req: any, res: any) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Missing required parameter: id." });
  }

  try {
    // Check if season exists
    const existingSeason = await prisma.season.findUnique({
      where: { id },
      include: { memberships: true }
    });

    if (!existingSeason) {
      return res.status(404).json({ error: "Season not found." });
    }

    // Check if season has active memberships
    const activeMemberships = existingSeason.memberships.filter(
      membership => membership.status === "ACTIVE"
    );

    if (activeMemberships.length > 0) {
      return res.status(400).json({ 
        error: "Cannot delete season with active memberships. Please remove all members first." 
      });
    }

    // Delete the season
    await prisma.season.delete({
      where: { id }
    });

    res.status(200).json({ message: "Season deleted successfully." });
  } catch (error: any) {
    console.error("Error deleting season:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: "Season not found for deletion." });
      }
    }

    res.status(500).json({ error: "Failed to delete season. Please try again later." });
  }
};


// POST /api/withdrawals (User submits a request)
export const submitWithdrawalRequest = async (req: any, res: any) => {
    // NOTE: Replace req.user.id with your actual authenticated user retrieval method
    const userId = req.body.userId || 'placeholder-user-id'; // MUST be obtained from auth
    const { seasonId, reason } = req.body;

    if (!seasonId || !reason || !userId) {
        return res.status(400).json({ error: "Missing required fields: seasonId, reason, and authenticated userId." });
    }

    try {
        const season = await prisma.season.findUnique({ where: { id: seasonId } });

        if (!season || !season.withdrawalEnabled) {
            return res.status(400).json({ error: 'Withdrawal is not enabled for this season.' });
        }

        const newRequest = await prisma.withdrawalRequest.create({
            data: {
                seasonId,
                userId,
                reason,
                status: 'PENDING', // Uses the WithdrawalStatus enum
            },
        });
        res.status(201).json(newRequest);
    } catch (error: any) {
        console.error('Error submitting withdrawal request:', error);
        if (error instanceof Prisma.PrismaClientValidationError) {
             return res.status(400).json({ error: "Invalid data format or type for withdrawal request." });
        }
        res.status(500).json({ error: 'Failed to submit withdrawal request.' });
    }
};

// PUT /api/withdrawals/:id/process (Admin processes the request)
export const processWithdrawalRequest = async (req: any, res: any) => {
    const { id } = req.params;
    // NOTE: Replace req.admin.id with your actual authenticated admin ID retrieval method
    const processedByAdminId = req.body.adminId || 'placeholder-admin-id'; // MUST be obtained from auth
    const { status } = req.body; // Expects 'APPROVED' or 'REJECTED'

    if (!['APPROVED', 'REJECTED'].includes(status) || !processedByAdminId) {
        return res.status(400).json({ error: 'Invalid status or missing admin ID.' });
    }

    try {
        const updatedRequest = await prisma.withdrawalRequest.update({
            where: { id },
            data: {
                status: status,
                processedByAdminUserId: processedByAdminId, // Links to the User model
            },
            include: {
                processedByAdmin: { select: { name: true, role: true } },
            },
        });

        // NOTE: Here you would add business logic for refunds/waitlist promotion, etc.

        res.status(200).json(updatedRequest);
    } catch (error: any) {
        console.error(`Error processing withdrawal request ${id}:`, error);

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // P2025: Record to update not found
            if (error.code === 'P2025') {
                return res.status(404).json({ error: "Withdrawal request not found." });
            }
        }
        res.status(500).json({ error: 'Failed to process withdrawal request.' });
    }
};