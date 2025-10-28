import { Request, Response } from 'express';
import * as leagueService from '../services/leagueService';
import { Statuses, PrismaClient, Prisma } from '@prisma/client';
import { ApiResponse } from '../utils/ApiResponse';
import crypto from "crypto";

const prisma = new PrismaClient();


export const getLeagues = async (req: Request, res: Response) => {
  try {
    const { leagues, totalMembers, totalCategories } = await leagueService.getAllLeagues();

    return res.status(200).json(
      new ApiResponse(
        true,
        200,
        { leagues, totalMembers, totalCategories },
        `Found ${leagues.length} league(s)`
      )
    );
  } catch (error) {
    console.error("Error fetching leagues:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error fetching leagues")
    );
  }
};


// LeagueMembership model has been removed - this function is no longer needed
// export const getLeaguePlayerCount = async (leagueId: string) => {
//   return prisma.leagueMembership.count({
//     where: { leagueId }
//   });
// };

export const getLeagueById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    if (!id) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League ID is required")
      );
    }

    const league = await leagueService.getLeagueById(id);

    if (!league) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, "League not found")
      );
    }

    return res.status(200).json(
      new ApiResponse(true, 200, { league }, "League fetched successfully")
    );
  } catch (error) {
    console.error("Error fetching league:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error fetching league")
    );
  }
};


export const createLeague = async (req: Request, res: Response) => {
  try {

    console.log("Params:", JSON.stringify(req.params, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("User (from auth):", JSON.stringify(req.user, null, 2));

   const { name, location, description, status, sportType, gameType, sponsorships, existingSponsorshipIds } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League name is required")
      );
    }

    if (name.length > 200) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League name must be 200 characters or less")
      );
    }

    if (!location || !location.trim()) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Location is required")
      );
    }

    if (status && !Object.values(Statuses).includes(status)) {
      return res.status(400).json(
        new ApiResponse(
          false,
          400,
          null,
          `Invalid status. Must be one of: ${Object.values(Statuses).join(', ')}`
        )
      );
    }

     const newLeague = await leagueService.createLeague({
      name,
      location,
      description,
      status,
      sportType,
      gameType,
      sponsorships: sponsorships?.map((s: any) => ({ ...s, createdById: req.user?.id })),
      existingSponsorshipIds
    });


    return res.status(201).json(
      new ApiResponse(
        true,
        201,
        { league: newLeague },
        "League created successfully"
      )
    );
  } catch (error: any) {
    console.error("Error creating league:", error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json(
        new ApiResponse(false, 409, null, error.message)
      );
    }
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return res.status(409).json(
          new ApiResponse(false, 409, null, "A league with this name already exists")
        );
      }
    }
    
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error creating league")
    );
  }
};

/**
 * Update league
 * Admin only
 */
export const updateLeague = async (req: Request, res: Response) => {
    
    console.log("---- updateLeague called ----");
  console.log("Request params:", req.params);
  console.log("Request body:", req.body);
  console.log("Request user:", req.user?.id);

  try {
    const id = req.params.id;
    const { name, location, description, status} = req.body;
    
    if (!id) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Invalid league ID")
      );
    }

  

    // Validation
    if (name !== undefined && (!name.trim() || name.length > 255)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League name must be between 1 and 255 characters")
      );
    }
    if (location !== undefined && !location.trim()) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Location cannot be empty")
      );
    }
    if (status && !Object.values(Statuses).includes(status)) {
      return res.status(400).json(
        new ApiResponse(
          false,
          400,
          null,
          `Invalid status. Must be one of: ${Object.values(Statuses).join(', ')}`
        )
      );
    }

   const updatedLeague = await leagueService.updateLeague(id, {
      name,
      location,
      description,
      status: status as Statuses,
    });

    return res.status(200).json(
      new ApiResponse(
        true,
        200,
        { league: updatedLeague },
        "League updated successfully"
      )
    );
  } catch (error: any) {
    console.error("Error updating league:", error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, error.message)
      );
    }
    
    if (error.message.includes('already exists')) {
      return res.status(409).json(
        new ApiResponse(false, 409, null, error.message)
      );
    }
    
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error updating league")
    );
  }
};

export const deleteLeague = async (req: Request, res: Response) => {
  try {
    const id = req.params.id; 

    if (!id || typeof id !== 'string') {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Invalid league ID")
      );
    }

    await leagueService.deleteLeague(id);

    return res.status(200).json(
      new ApiResponse(true, 200, null, "League deleted successfully")
    );
  } catch (error: any) {
    console.error("Error deleting league:", error);

    if (error.message.includes('not found')) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, error.message)
      );
    }

    if (error.message.includes('Cannot delete')) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, error.message)
      );
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error deleting league")
    );
  }
};


// LeagueMembership model has been removed - joinLeague functionality is no longer available
// export const joinLeague = async (req: Request, res: Response) => {
//   try {
//     const { leagueId, userId } = req.body;

//     if (!leagueId || !userId) {
//       return res.status(400).json({ message: "leagueId and userId are required" });
//     }

//     // Check if league exists
//     const league = await prisma.league.findUnique({
//       where: { id: leagueId },
//     });

//     if (!league) {
//       return res.status(404).json({ message: "League not found" });
//     }

//     // Check if already a member
//     const existingMembership = await prisma.leagueMembership.findUnique({
//       where: {
//         userId_leagueId: {
//           userId,
//           leagueId,
//         },
//       },
//     });

//     if (existingMembership) {
//       return res.status(409).json({ message: "You have already joined this league." });
//     }

//     // Create membership
//     const membership = await prisma.leagueMembership.create({
//       data: {
//         userId,
//         leagueId,
//       },
//     });

//     return res.status(201).json({
//       message: "Successfully joined the league!",
//       membership,
//     });
//   } catch (error) {
//     console.error("Error joining league:", error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };


//TODO SOON
// export const sendLeagueInvite = async (req: Request, res: Response) => {
//   try {
//     const { leagueId, email, invitedById } = req.body;

//     if (!leagueId || !email || !invitedById) {
//       return res.status(400).json({ message: "leagueId, email, and invitedById are required" });
//     }

//     // Check if inviter exists and is an admin
//     const admin = await prisma.admin.findUnique({
//       where: { id: invitedById },
//     });

//     if (!admin) {
//       return res.status(404).json({ message: "Inviting admin not found" });
//     }

//     const league = await prisma.league.findUnique({
//       where: { id: leagueId },
//     });

//     if (!league) {
//       return res.status(404).json({ message: "League not found" });
//     }

//     if (league.joinType !== "INVITE_ONLY") {
//       return res.status(400).json({
//         message: "This league does not require invitations.",
//       });
//     }

//     // Generate unique token
//     const token = crypto.randomBytes(16).toString("hex");

//     const invite = await prisma.leagueInvite.create({
//       data: {
//         leagueId,
//         email,
//         token,
//         invitedById: admin.id,
//       },
//     });

//     return res.status(201).json({
//       message: "Invitation created successfully.",
//       invite,
//     });
//   } catch (error) {
//     console.error("Error sending invite:", error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };