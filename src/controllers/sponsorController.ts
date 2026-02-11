import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import { sendSuccess, sendError } from "../utils/response";


// Get all sponsors with their linked leagues
export const getAllSponsors = async (req: Request, res: Response) => {
  try {
    const sponsors = await prisma.sponsorship.findMany({
      include: {
        leagues: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return sendSuccess(res, sponsors, "Sponsors fetched successfully");
  } catch (error) {
    console.error("Error fetching sponsors:", error);
    return sendError(res, "Error fetching sponsors", 500);
  }
};

// Create a new sponsor
export const createSponsor = async (req: Request, res: Response) => {
  try {
    const { sponsoredName, packageTier, contractAmount, sponsorRevenue, leagueIds } = req.body;

    // Validate required fields
    if (!sponsoredName || !packageTier) {
      return sendError(res, "Sponsored name and package tier are required", 400);
    }

    // Create the sponsorship
    const sponsor = await prisma.sponsorship.create({
      data: {
        sponsoredName,
        packageTier,
        contractAmount: contractAmount ? parseFloat(contractAmount) : null,
        sponsorRevenue: sponsorRevenue ? parseFloat(sponsorRevenue) : null,
        leagues: {
          connect: leagueIds?.map((id: string) => ({ id })) || []
        }
      },
      include: {
        leagues: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    return sendSuccess(res, sponsor, "Sponsor created successfully", 201);
  } catch (error) {
    console.error("Error creating sponsor:", error);
    return sendError(res, "Error creating sponsor", 500);
  }
};

// Get sponsor by ID
export const getSponsorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, "Sponsor ID is required", 400);
    }

    const sponsor = await prisma.sponsorship.findUnique({
      where: { id },
      include: {
        leagues: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    if (!sponsor) {
      return sendError(res, "Sponsor not found", 404);
    }

    return sendSuccess(res, sponsor, "Sponsor fetched successfully");
  } catch (error) {
    console.error("Error fetching sponsor:", error);
    return sendError(res, "Error fetching sponsor", 500);
  }
};

// Update sponsor
export const updateSponsor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sponsoredName, packageTier, contractAmount, sponsorRevenue, leagueIds } = req.body;

    if (!id) {
      return sendError(res, "Sponsor ID is required", 400);
    }

    // Check if sponsor exists
    const existingSponsor = await prisma.sponsorship.findUnique({
      where: { id }
    });

    if (!existingSponsor) {
      return sendError(res, "Sponsor not found", 404);
    }

    // Update the sponsorship
    const updatedSponsor = await prisma.sponsorship.update({
      where: { id },
      data: {
        sponsoredName,
        packageTier,
        contractAmount: contractAmount ? parseFloat(contractAmount) : null,
        sponsorRevenue: sponsorRevenue ? parseFloat(sponsorRevenue) : null,
        leagues: {
          set: leagueIds?.map((id: string) => ({ id })) || []
        }
      },
      include: {
        leagues: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    return sendSuccess(res, updatedSponsor, "Sponsor updated successfully");
  } catch (error) {
    console.error("Error updating sponsor:", error);
    return sendError(res, "Error updating sponsor", 500);
  }
};

// Delete sponsor
export const deleteSponsor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, "Sponsor ID is required", 400);
    }

    // Check if sponsor exists
    const existingSponsor = await prisma.sponsorship.findUnique({
      where: { id }
    });

    if (!existingSponsor) {
      return sendError(res, "Sponsor not found", 404);
    }

    // Delete the sponsorship
    await prisma.sponsorship.delete({
      where: { id }
    });

    return sendSuccess(res, null, "Sponsor deleted successfully");
  } catch (error) {
    console.error("Error deleting sponsor:", error);
    return sendError(res, "Error deleting sponsor", 500);
  }
};
