import { Request, Response } from "express";
import { PrismaClient, TierType, Prisma } from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";

const prisma = new PrismaClient();

// Create a new sponsorship
export const createSponsorship = async (req: Request, res: Response) => {
  console.log("=== Create Sponsorship Request ===");
  console.log("Body:", req.body);

  try {
    const { 
      packageTier, 
      contractAmount, 
      sponsorRevenue, 
      sponsoredName, 
      createdById,
      leagueIds, 
      divisionIds 
    } = req.body;

    // Validate required fields
    if (!packageTier) {
      return res.status(400).json({
        success: false,
        message: "Package tier is required"
      });
    }

    // Validate package tier
    const validTiers: TierType[] = ["GOLD", "SILVER", "BRONZE", "PLATINUM"];
    if (!validTiers.includes(packageTier as TierType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid packageTier. Must be one of: ${validTiers.join(", ")}`
      });
    }

    // Prepare connect objects only if IDs are provided
    const connectLeagues = leagueIds?.length ? {
      leagues: {
        connect: leagueIds.map(id => ({ id }))
      }
    } : {};

    const connectDivisions = divisionIds?.length ? {
      divisions: {
        connect: divisionIds.map(id => ({ id }))
      }
    } : {};

    const sponsorship = await prisma.sponsorship.create({
      data: {
        packageTier: packageTier as TierType,
        contractAmount: contractAmount ? new Prisma.Decimal(contractAmount) : null,
        sponsorRevenue: sponsorRevenue ? new Prisma.Decimal(sponsorRevenue) : null,
        sponsoredName: sponsoredName || null,
        createdById: createdById || null,
        ...connectLeagues,
        ...connectDivisions
      },
      include: {
        leagues: true,
        divisions: true,
        createdBy: true
      }
    });

    return res.status(201).json({
      success: true,
      message: "Sponsorship created successfully",
      data: sponsorship
    });

  } catch (error) {
    console.error("Error creating sponsorship:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          message: "A sponsorship with these details already exists"
        });
      }
      if (error.code === "P2003") {
        return res.status(400).json({
          success: false,
          message: "One or more provided IDs are invalid"
        });
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create sponsorship",
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Get all sponsorships
export const getSponsorships = async (_req: Request, res: Response) => {
  try {
    const sponsorships = await prisma.sponsorship.findMany({
      include: { company: true, league: true, createdBy: true },
    });
    return res.json(sponsorships);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// Get sponsorship by ID
export const getSponsorshipById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
   
    if (!id) {
      return res.status(400).json(new ApiResponse(false, 400, null, "Sponsorship ID is required"));
    }
    const sponsorship = await prisma.sponsorship.findUnique({
      where: { id },
      include: { company: true, league: true, createdBy: true },
    });

    if (!sponsorship) return res.status(404).json({ message: "Sponsorship not found" });
    return res.json(sponsorship);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// Update sponsorship by ID
export const updateSponsorship = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      packageTier, 
      contractAmount, 
      sponsorRevenue, 
      sponsoredName,
      leagueIds,
      divisionIds 
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Sponsorship ID is required"
      });
    }

    const dataToUpdate: any = {
      packageTier: packageTier ? (packageTier as TierType) : undefined,
      sponsoredName: sponsoredName ?? undefined,
      contractAmount: contractAmount ? new Prisma.Decimal(contractAmount) : undefined,
      sponsorRevenue: sponsorRevenue ? new Prisma.Decimal(sponsorRevenue) : undefined,
    };

    // Update relationships if provided
    if (leagueIds) {
      dataToUpdate.leagues = {
        set: leagueIds.map(id => ({ id }))
      };
    }

    if (divisionIds) {
      dataToUpdate.divisions = {
        set: divisionIds.map(id => ({ id }))
      };
    }

    const sponsorship = await prisma.sponsorship.update({
      where: { id },
      data: dataToUpdate,
      include: {
        leagues: true,
        divisions: true,
        createdBy: true
      }
    });

    return res.json({
      success: true,
      message: "Sponsorship updated successfully",
      data: sponsorship
    });

  } catch (error) {
    // ... error handling
  }
};

export const deleteSponsorship = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json(new ApiResponse(false, 400, null, "Sponsorship ID is required"));
    }

    await prisma.sponsorship.delete({ where: { id } });

    return res.json(
      new ApiResponse(true, 200, null, "Sponsorship deleted successfully")
    );
  } catch (error: any) {
    console.error("Failed to delete sponsorship:", error);
    return res
      .status(400)
      .json(new ApiResponse(false, 400, null, error.message || "Failed to delete sponsorship"));
  }
};
