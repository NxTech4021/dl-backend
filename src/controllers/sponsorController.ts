import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";


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

    return res.status(200).json(
      new ApiResponse(true, 200, sponsors, "Sponsors fetched successfully")
    );
  } catch (error) {
    console.error("Error fetching sponsors:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error fetching sponsors")
    );
  }
};

// Create a new sponsor
export const createSponsor = async (req: Request, res: Response) => {
  try {
    const { sponsoredName, packageTier, contractAmount, sponsorRevenue, leagueIds } = req.body;

    // Validate required fields
    if (!sponsoredName || !packageTier) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Sponsored name and package tier are required")
      );
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

    return res.status(201).json(
      new ApiResponse(true, 201, sponsor, "Sponsor created successfully")
    );
  } catch (error) {
    console.error("Error creating sponsor:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error creating sponsor")
    );
  }
};

// Get sponsor by ID
export const getSponsorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Sponsor ID is required")
      );
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
      return res.status(404).json(
        new ApiResponse(false, 404, null, "Sponsor not found")
      );
    }

    return res.status(200).json(
      new ApiResponse(true, 200, sponsor, "Sponsor fetched successfully")
    );
  } catch (error) {
    console.error("Error fetching sponsor:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error fetching sponsor")
    );
  }
};

// Update sponsor
export const updateSponsor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sponsoredName, packageTier, contractAmount, sponsorRevenue, leagueIds } = req.body;

    if (!id) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Sponsor ID is required")
      );
    }

    // Check if sponsor exists
    const existingSponsor = await prisma.sponsorship.findUnique({
      where: { id }
    });

    if (!existingSponsor) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, "Sponsor not found")
      );
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

    return res.status(200).json(
      new ApiResponse(true, 200, updatedSponsor, "Sponsor updated successfully")
    );
  } catch (error) {
    console.error("Error updating sponsor:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error updating sponsor")
    );
  }
};

// Delete sponsor
export const deleteSponsor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Sponsor ID is required")
      );
    }

    // Check if sponsor exists
    const existingSponsor = await prisma.sponsorship.findUnique({
      where: { id }
    });

    if (!existingSponsor) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, "Sponsor not found")
      );
    }

    // Delete the sponsorship
    await prisma.sponsorship.delete({
      where: { id }
    });

    return res.status(200).json(
      new ApiResponse(true, 200, null, "Sponsor deleted successfully")
    );
  } catch (error) {
    console.error("Error deleting sponsor:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error deleting sponsor")
    );
  }
};