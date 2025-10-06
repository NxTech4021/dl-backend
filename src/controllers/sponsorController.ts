import { Request, Response } from "express";
import { PrismaClient, TierType } from "@prisma/client";

const prisma = new PrismaClient();

// Create a new sponsorship
export const createSponsorship = async (req: Request, res: Response) => {
  console.log("=== Create Sponsorship Request ===");
  console.log("Body:", req.body);

  try {
    const { leagueId, companyId, packageTier, contractAmount, sponsorRevenue, sponsoredName, createdById } = req.body;

    const validTiers: TierType[] = ["GOLD", "SILVER", "BRONZE","PLATINUM"];
    if (!packageTier || !validTiers.includes(packageTier as TierType)) {
      console.log("Invalid packageTier:", packageTier);
      return res.status(400).json({
        message: `Invalid packageTier. Must be one of: ${validTiers.join(", ")}`,
      });
    }

    console.log("Creating sponsorship with data:", {
      leagueId,
      companyId,
      packageTier,
      contractAmount,
      sponsorRevenue,
      sponsoredName,
      createdById,
    });

    const sponsorship = await prisma.sponsorship.create({
      data: {
        leagueId: leagueId || null,
        companyId: companyId || null,
        packageTier: packageTier as TierType,
        contractAmount: contractAmount ?? null,
        sponsorRevenue: sponsorRevenue ?? null,
        sponsoredName: sponsoredName || null,
        createdById: createdById || null,
      },
    });

    console.log("Sponsorship created successfully:", sponsorship);
    return res.status(201).json(sponsorship);

  } catch (error: any) {
    console.error("Error creating sponsorship:", error);

    if (error.code === "P2002") {
      return res.status(400).json({
        message: "Sponsorship with this leagueId, companyId, and packageTier already exists",
        error: error.meta,
      });
    }

    return res.status(500).json({ message: error.message, stack: error.stack });
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
    const { leagueId, companyId, packageTier, contractAmount, sponsorRevenue, sponsoredName } = req.body;

    const sponsorship = await prisma.sponsorship.update({
      where: { id },
      data: {
        leagueId: leagueId ?? undefined,
        companyId: companyId ?? undefined,
        packageTier: packageTier ? (packageTier as TierType) : undefined,
        contractAmount: contractAmount ?? undefined,
        sponsorRevenue: sponsorRevenue ?? undefined,
        sponsoredName: sponsoredName ?? undefined,
      },
    });

    return res.json(sponsorship);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(400).json({ message: "Sponsorship with this leagueId, companyId, and packageTier already exists" });
    }
    return res.status(500).json({ message: error.message });
  }
};

// Delete sponsorship by ID
export const deleteSponsorship = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.sponsorship.delete({ where: { id } });
    return res.json({ message: "Sponsorship deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
