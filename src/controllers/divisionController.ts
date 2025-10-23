import {
  DivisionLevel,
  GameType,
  GenderType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { Request, Response } from "express";
import { createThread } from "./threadController";

const prisma = new PrismaClient();

const toEnum = <T extends DivisionLevel | GameType | GenderType>(
  value: string | undefined,
  enumType: Record<string, T>
): T | undefined => {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  return enumType[normalized as keyof typeof enumType];
};

const FALLBACK_DATE_ISO = new Date(0).toISOString();

const toISODateString = (input: unknown): string => {
  if (!input) return FALLBACK_DATE_ISO;
  const date = input instanceof Date ? input : new Date(input as any);
  return Number.isNaN(date.getTime()) ? FALLBACK_DATE_ISO : date.toISOString();
};

const toISODateStringOrNull = (input: unknown): string | null => {
  if (input === null || input === undefined) return null;
  const date = input instanceof Date ? input : new Date(input as any);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const checkDivisionCapacity = async (divisionId: string, gameType: GameType) => {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: {
      maxSinglesPlayers: true,
      maxDoublesTeams: true,
      currentSinglesCount: true,
      currentDoublesCount: true,
      gameType: true,
      name: true
    }
  });

  if (!division) {
    throw new Error("Division not found");
  }

  const isSingles = gameType === GameType.SINGLES;
  const maxCapacity = isSingles ? division.maxSinglesPlayers : division.maxDoublesTeams;
  const currentCount = isSingles ? (division.currentSinglesCount || 0) : (division.currentDoublesCount || 0);

  return {
    hasCapacity: maxCapacity ? currentCount < maxCapacity : true,
    currentCount,
    maxCapacity,
    division
  };
};

const updateDivisionCounts = async (divisionId: string, increment: boolean = true) => {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { gameType: true }
  });

  if (!division) return;

  const isSingles = division.gameType === GameType.SINGLES;
  const updateData = isSingles 
    ? { currentSinglesCount: { increment: increment ? 1 : -1 } }
    : { currentDoublesCount: { increment: increment ? 1 : -1 } };

  await prisma.division.update({
    where: { id: divisionId },
    data: updateData
  });
};

const formatSeason = (season: any) => ({
  id: season?.id ?? "",
  name: season?.name ?? "",
  sportType: season?.sportType ?? null,
  seasonType: season?.seasonType ?? null,
  description: season?.description ?? null,
  startDate: toISODateStringOrNull(season?.startDate),
  endDate: toISODateStringOrNull(season?.endDate),
  regiDeadline: toISODateStringOrNull(season?.regiDeadline),
  status: season?.status ?? "UPCOMING",
  current:
    season && "current" in season
      ? Boolean(season.current)
      : Boolean(season?.isActive),
  createdAt: toISODateString(season?.createdAt),
  updatedAt: toISODateString(season?.updatedAt),
  memberships: [],
  withdrawalRequests: [],
});

const formatDivision = (division: any) => ({
  id: division.id,
  seasonId: division.seasonId,
  name: division.name,
  description: division.description ?? null,
  threshold:
    division.pointsThreshold !== null && division.pointsThreshold !== undefined
      ? Number(division.pointsThreshold)
      : null,
  divisionLevel: division.level
    ? division.level.toLowerCase()
    : "beginner",
  gameType: division.gameType ? division.gameType.toLowerCase() : "singles",
  genderCategory: division.genderCategory
    ? division.genderCategory.toLowerCase()
    : "mixed",
  maxSingles:
    division.maxSinglesPlayers !== null && division.maxSinglesPlayers !== undefined
      ? Number(division.maxSinglesPlayers)
      : null,
  maxDoublesTeams:
    division.maxDoublesTeams !== null && division.maxDoublesTeams !== undefined
      ? Number(division.maxDoublesTeams)
      : null,
  currentSinglesCount:
    division.currentSinglesCount !== null && division.currentSinglesCount !== undefined
      ? Number(division.currentSinglesCount)
      : null,
  currentDoublesCount:
    division.currentDoublesCount !== null && division.currentDoublesCount !== undefined
      ? Number(division.currentDoublesCount)
      : null,
  autoAssignmentEnabled: division.autoAssignmentEnabled,
  isActive: division.isActiveDivision,
  prizePoolTotal: division.prizePoolTotal
    ? Number(division.prizePoolTotal)
    : null,
  sponsoredDivisionName: division.sponsoredDivisionName ?? null,
  season: formatSeason(division.season),
  createdAt: toISODateString(division.createdAt),
  updatedAt: toISODateString(division.updatedAt),
});

export const createDivision = async (req: Request, res: Response) => {
  const {
    seasonId,
    name,
    description,
    threshold,
    divisionLevel,
    gameType,
    genderCategory,
    maxSinglesPlayers,
    maxDoublesTeams,
    autoAssignmentEnabled = false,
    isActive = true,
    prizePoolTotal,
    sponsorName,
    adminId
  } = req.body;

  if (!adminId) {
    return res.status(400).json({
      error: "Admin Id is required to create the division thread.",
    });
  }

  if (!seasonId || !name || !divisionLevel || !gameType) {
    return res.status(400).json({
      error: "seasonId, name, divisionLevel, and gameType are required fields.",
    });
  }

  const levelEnum = toEnum(divisionLevel, DivisionLevel);
  const gameTypeEnum = toEnum(gameType, GameType);
  const genderEnum = toEnum(genderCategory, GenderType);

  if (!levelEnum) {
    return res.status(400).json({ error: "Invalid divisionLevel value." });
  }
  if (!gameTypeEnum) {
    return res.status(400).json({ error: "Invalid gameType value." });
  }

  if (
    gameTypeEnum === GameType.SINGLES &&
    (maxSinglesPlayers === null || maxSinglesPlayers === undefined)
  ) {
    return res.status(400).json({
      error: "maxSinglesPlayers is required when gameType is singles.",
    });
  }

  if (
    gameTypeEnum === GameType.DOUBLES &&
    (maxDoublesTeams === null || maxDoublesTeams === undefined)
  ) {
    return res.status(400).json({
      error: "maxDoublesTeams is required when gameType is doubles.",
    });
  }

  try {
    // Verify admin exists
    const adminUser = await prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, name: true }
    });

    if (!adminUser) {
      return res.status(404).json({ error: "Admin user not found." });
    }

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { 
        id: true, 
        name: true,  
        leagues: { 
          select: {
            id: true
          }
        }
      },
    });

    if (!season) {
      return res.status(404).json({ error: "Season not found." });
    }

    const leagueId = season.leagues && season.leagues.length > 0 ? season.leagues[0].id : null;

    if (!leagueId) {
      return res.status(400).json({ error: "Season is not linked to any league." });
    }

    const duplicate = await prisma.division.findFirst({
      where: { seasonId, name },
      select: { id: true },
    });

    if (duplicate) {
      return res.status(409).json({
        error: "A division with this name already exists in the season.",
      });
    }

    // Create division and thread in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the division first
      const division = await tx.division.create({
        data: {
          seasonId,
          leagueId: leagueId,
          name,
          description,
          pointsThreshold:
            threshold !== undefined && threshold !== null
              ? Number(threshold)
              : null,
          level: levelEnum,
          gameType: gameTypeEnum,
          genderCategory: genderEnum ?? null,
          maxSinglesPlayers:
            maxSinglesPlayers !== undefined && maxSinglesPlayers !== null
              ? Number(maxSinglesPlayers)
              : null,
          maxDoublesTeams:
            maxDoublesTeams !== undefined && maxDoublesTeams !== null
              ? Number(maxDoublesTeams)
              : null,
          autoAssignmentEnabled: Boolean(autoAssignmentEnabled),
          isActiveDivision: Boolean(isActive),
          prizePoolTotal:
            prizePoolTotal !== undefined && prizePoolTotal !== null
              ? new Prisma.Decimal(prizePoolTotal)
              : null,
          sponsoredDivisionName: sponsorName ?? null,
        },
        include: {
          season: true,
        },
      });

      // Create the group chat/thread for the division
      const thread = await tx.thread.create({
        data: {
          name: `${division.name} Chat`,
          isGroup: true,
          divisionId: division.id,
          members: {
            create: [{
              userId: adminId,
              role: "admin"
            }]
          }
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, username: true, image: true }
              }
            }
          }
        }
      });

      console.log(`✅ Division ${division.id} created with chat thread ${thread.id}`);

      return { division, thread };
    });

    // Socket notification for thread creation
    if (req.io) {
      req.io.to(adminId).emit('new_thread', {
        thread: result.thread,
        message: `Division chat created for ${result.division.name}`,
        timestamp: new Date().toISOString()
      });

      req.io.to(adminId).emit('division_created', {
        division: result.division,
        thread: result.thread,
        message: `Division ${result.division.name} created successfully`,
        timestamp: new Date().toISOString()
      });

      console.log(`📤 Sent division and thread creation notifications to admin ${adminId}`);
    }

    return res.status(201).json({
      success: true,
      data: {
        division: formatDivision(result.division),
        thread: {
          id: result.thread.id,
          name: result.thread.name,
          isGroup: result.thread.isGroup,
          divisionId: result.thread.divisionId,
          members: result.thread.members
        }
      },
      message: "Division and chat group created successfully",
    });

  } catch (error) {
    console.error("❌ Create Division Error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return res.status(409).json({
          error: "A division with this name already exists in the season."
        });
      }
      if (error.code === "P2003") {
        return res.status(400).json({
          error: "Invalid season, league, or admin ID provided."
        });
      }
    }

    return res.status(500).json({ 
      error: "An error occurred while creating the division and chat group." 
    });
  }
};

export const getDivisions = async (_req: Request, res: Response) => {
  try {
    const divisions = await prisma.division.findMany({
      include: { season: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json(divisions.map(formatDivision));
  } catch (error) {
    console.error("Get Divisions Error:", error);
    return res.status(500).json({ error: "Failed to retrieve divisions." });
  }
};

export const getDivisionById = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Division ID is required." });
  }

  try {
    const division = await prisma.division.findUnique({
      where: { id },
      include: { season: true },
    });

    if (!division) {
      return res.status(404).json({ error: "Division not found." });
    }

    return res.json(formatDivision(division));
  } catch (error) {
    console.error("Get Division By ID Error:", error);
    return res.status(500).json({ error: "Failed to retrieve division." });
  }
};

export const updateDivision = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Division ID is required." });
  }

  const {
    name,
    description,
    threshold,
    divisionLevel,
    gameType,
    genderCategory,
    maxSinglesPlayers,
    maxDoublesTeams,
    autoAssignmentEnabled,
    isActive,
    prizePoolTotal,
    sponsorName,
    seasonId,
  } = req.body;

  try {
    const existing = await prisma.division.findUnique({
      where: { id },
      include: { season: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Division not found." });
    }


 
    const data: Prisma.DivisionUpdateInput = {};

    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (threshold !== undefined)
      data.pointsThreshold =
        threshold !== null ? Number(threshold) : (null as any);

    if (divisionLevel !== undefined) {
      const levelEnum = toEnum(divisionLevel, DivisionLevel);
      if (!levelEnum) {
        return res.status(400).json({ error: "Invalid divisionLevel value." });
      }
      data.level = levelEnum;
    }

    if (seasonId !== undefined) {
      data.season = {
        connect: { id: seasonId },
      };
    }

    if (gameType !== undefined) {
      const gameTypeEnum = toEnum(gameType, GameType);
      if (!gameTypeEnum) {
        return res.status(400).json({ error: "Invalid gameType value." });
      }
      data.gameType = gameTypeEnum;
    }

    if (genderCategory !== undefined) {
      const genderEnum = toEnum(genderCategory, GenderType);
      if (!genderEnum) {
        return res
          .status(400)
          .json({ error: "Invalid genderCategory value." });
      }
      data.genderCategory = genderEnum;
    }

    if (maxSinglesPlayers !== undefined) {
      data.maxSinglesPlayers =
        maxSinglesPlayers !== null ? Number(maxSinglesPlayers) : null;
    }

    if (maxDoublesTeams !== undefined) {
      data.maxDoublesTeams =
        maxDoublesTeams !== null ? Number(maxDoublesTeams) : null;
    }

    if (autoAssignmentEnabled !== undefined) {
      data.autoAssignmentEnabled = Boolean(autoAssignmentEnabled);
    }

    if (isActive !== undefined) {
      data.isActiveDivision = Boolean(isActive);
    }

    if (prizePoolTotal !== undefined) {
      data.prizePoolTotal =
        prizePoolTotal !== null
          ? new Prisma.Decimal(prizePoolTotal)
          : (null as any);
    }

    if (sponsorName !== undefined) {
      data.sponsoredDivisionName = sponsorName;
    }

    const division = await prisma.division.update({
      where: { id },
      data,
      include: { season: true },
    });

    return res.json({
      data: formatDivision(division),
      message: "Division updated successfully",
    });
  } catch (error) {
    console.error("Update Division Error:", error);
    return res.status(500).json({ error: "Failed to update division." });
  }
};

export const deleteDivision = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Division ID is required." });
  }

  try {
    await prisma.division.delete({ where: { id } });
    return res.json({ message: "Division deleted successfully" });
  } catch (error) {
    console.error("Delete Division Error:", error);
    return res.status(500).json({ error: "Failed to delete division." });
  }
};

// Assign a user to a division
export const assignPlayerToDivision = async (req: Request, res: Response) => {
  try {
    const { 
      userId, 
      divisionId, 
      seasonId, 
      assignedBy, 
      notes,
      autoAssignment = false 
    } = req.body;

    console.log(`👤 Assigning user ${userId} to division ${divisionId} in season ${seasonId}`);

    // Validate required fields
    if (!userId || !divisionId || !seasonId) {
      return res.status(400).json({
        success: false,
        error: "userId, divisionId, and seasonId are required"
      });
    }



      let adminId = null;

      if (assignedBy) {
        const adminRecord = await prisma.admin.findUnique({
          where: { userId: assignedBy },
          select: { id: true },
        });

        if (adminRecord) {
          adminId = adminRecord.id;
        }
      }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, username: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Check if division exists and get details
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      include: {
        season: { select: { id: true, name: true, isActive: true } }
      }
    });

    if (!division) {
      return res.status(404).json({
        success: false,
        error: "Division not found"
      });
    }

    // Verify division belongs to the specified season
    if (division.seasonId !== seasonId) {
      return res.status(400).json({
        success: false,
        error: "Division does not belong to the specified season"
      });
    }

    // Check if division is active
    if (!division.isActiveDivision) {
      return res.status(400).json({
        success: false,
        error: "Cannot assign to inactive division"
      });
    }

    // Check player rating against division threshold (before checking capacity)
    if (division.pointsThreshold) {
      // Get the season's league to determine sport type
      const seasonWithLeague = await prisma.season.findUnique({
        where: { id: seasonId },
        include: {
          leagues: {
            select: { sportType: true }
          }
        }
      });

      if (seasonWithLeague?.leagues?.[0]?.sportType) {
        const sportType = seasonWithLeague.leagues[0].sportType.toLowerCase();
        
        // Get player's questionnaire response for this sport
        const questionnaireResponse = await prisma.questionnaireResponse.findFirst({
          where: {
            userId: userId,
            sport: sportType,
            completedAt: { not: null }
          },
          include: {
            result: true
          }
        });

        if (questionnaireResponse?.result) {
          // Determine the appropriate rating based on game type
          const playerRating = division.gameType === 'DOUBLES' 
            ? questionnaireResponse.result.doubles 
            : questionnaireResponse.result.singles;

          if (playerRating && playerRating > division.pointsThreshold) {
            return res.status(400).json({
              success: false,
              error: `Player rating (${playerRating}) exceeds division threshold (${division.pointsThreshold}). Player is too advanced for this division.`
            });
          }
        } else {
          return res.status(400).json({
            success: false,
            error: "Player has not completed the skill assessment questionnaire for this sport"
          });
        }
      }
    }

    // Check division capacity
    const capacityCheck = await checkDivisionCapacity(divisionId, division.gameType);
    if (!capacityCheck.hasCapacity) {
      return res.status(400).json({
        success: false,
        error: `Division is at full capacity (${capacityCheck.currentCount}/${capacityCheck.maxCapacity})`
      });
    }

    // Check if user is already assigned to this division
    const existingAssignment = await prisma.divisionAssignment.findUnique({
      where: { divisionId_userId: { divisionId, userId } }
    });

    if (existingAssignment) {
      return res.status(409).json({
        success: false,
        error: "User is already assigned to this division"
      });
    }

    // Check if user has season membership
    let seasonMembership = await prisma.seasonMembership.findUnique({
      where: { userId_seasonId_divisionId: { userId, seasonId, divisionId } }
    });

    // Create or update season membership
    if (!seasonMembership) {
      // Check if user has any membership in this season
      const existingMembership = await prisma.seasonMembership.findFirst({
        where: { userId, seasonId }
      });

      if (existingMembership) {
        // Update existing membership to include division
        seasonMembership = await prisma.seasonMembership.update({
          where: { id: existingMembership.id },
          data: { divisionId }
        });
      } else {
        // Create new season membership
        seasonMembership = await prisma.seasonMembership.create({
          data: {
            userId,
            seasonId,
            divisionId,
            status: "ACTIVE"
          }
        });
      }
    }

    // Create division assignment
    const assignment = await prisma.divisionAssignment.create({
      data: {
        divisionId,
        userId,
        assignedBy: adminId,
        notes: notes || (autoAssignment ? "Auto-assigned based on rating" : null)
      },
      include: {
        user: { select: { id: true, name: true, username: true } },
        division: { select: { id: true, name: true, level: true, gameType: true } },
      }
    });

    // Update division counts
    await updateDivisionCounts(divisionId, true);

    console.log(`✅ User ${userId} assigned to division ${divisionId} successfully`);

    
    // Socket notifications FUTURE TO-DO 
    // if (req.io) {
    //   req.io.to(userId).emit('division_assigned', {
    //     assignment,
    //     message: `You have been assigned to ${division.name}`,
    //     timestamp: new Date().toISOString()
    //   });

    //   req.io.to(`season_${seasonId}`).emit('user_assigned_to_division', {
    //     userId,
    //     divisionId,
    //     seasonId,
    //     userName: user.name,
    //     divisionName: division.name,
    //     timestamp: new Date().toISOString()
    //   });

    //   console.log(`📤 Sent division assignment notifications`);
    // }

    return res.status(201).json({
      success: true,
      message: "User assigned to division successfully",
      data: assignment
    });

  } catch (error) {
    console.error("❌ Error assigning user to division:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          error: "User is already assigned to this division"
        });
      }
      if (error.code === "P2003") {
        return res.status(400).json({
          success: false,
          error: "Invalid user, division, or admin ID"
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: "Failed to assign user to division"
    });
  }
};


export const removePlayerFromDivision = async (req: Request, res: Response) => {
  try {
    const { divisionId, userId } = req.params;
    const { removedBy, reason } = req.body;

    console.log(`🗑️ Removing user ${userId} from division ${divisionId}`);

    if (!divisionId || !userId) {
      return res.status(400).json({
        success: false,
        error: "Division ID and User ID are required"
      });
    }

    // Check if assignment exists
    const assignment = await prisma.divisionAssignment.findUnique({
      where: { divisionId_userId: { divisionId, userId } },
      include: {
        user: { select: { name: true } },
        division: { select: { name: true, seasonId: true, gameType: true } }
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: "User is not assigned to this division"
      });
    }

    // Remove the assignment
    await prisma.divisionAssignment.delete({
      where: { divisionId_userId: { divisionId, userId } }
    });

    // Update season membership to remove division
    await prisma.seasonMembership.updateMany({
      where: { 
        userId, 
        seasonId: assignment.division.seasonId,
        divisionId 
      },
      data: { divisionId: null }
    });

    // Update division counts
    await updateDivisionCounts(divisionId, false);

    console.log(`✅ User ${userId} removed from division ${divisionId}`);

    
    // Socket notifications FUTURE TO-DO 
    // if (req.io) {
    //   req.io.to(userId).emit('division_removed', {
    //     divisionId,
    //     divisionName: assignment.division.name,
    //     reason: reason || "Removed by admin",
    //     timestamp: new Date().toISOString()
    //   });

    //   req.io.to(`season_${assignment.division.seasonId}`).emit('user_removed_from_division', {
    //     userId,
    //     divisionId,
    //     userName: assignment.user.name,
    //     divisionName: assignment.division.name,
    //     timestamp: new Date().toISOString()
    //   });

    //   console.log(`📤 Sent division removal notifications`);
    // }

    return res.json({
      success: true,
      message: "User removed from division successfully"
    });

  } catch (error) {
    console.error("❌ Error removing user from division:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to remove user from division"
    });
  }
};

// Get division assignments
export const getDivisionAssignments = async (req: Request, res: Response) => {
  try {
    const { divisionId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    console.log(`📋 Fetching assignments for division ${divisionId}`);

    if (!divisionId) {
      return res.status(400).json({
        success: false,
        error: "Division ID is required"
      });
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [assignments, totalCount, division] = await Promise.all([
      prisma.divisionAssignment.findMany({
        where: { divisionId },
        include: {
          user: { 
            select: { 
              id: true, 
              name: true, 
              username: true, 
              image: true,
              email: true 
            } 
          },
          assignedByAdmin: { 
            select: { 
              id: true, 
              userId: true 
            } 
          }
        },
        orderBy: { assignedAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.divisionAssignment.count({ where: { divisionId } }),
      prisma.division.findUnique({
        where: { id: divisionId },
        select: { 
          name: true, 
          maxSinglesPlayers: true, 
          maxDoublesTeams: true,
          currentSinglesCount: true,
          currentDoublesCount: true,
          gameType: true
        }
      })
    ]);

    console.log(`✅ Found ${assignments.length} assignments for division ${divisionId}`);

    return res.json({
      success: true,
      data: assignments,
      division,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit))
      }
    });

  } catch (error) {
    console.error("❌ Error fetching division assignments:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch division assignments"
    });
  }
};

// Get player's division assignments
export const getUserDivisionAssignments = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    console.log(`👤 Fetching division assignments for user ${userId}`);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required"
      });
    }

    const assignments = await prisma.divisionAssignment.findMany({
      where: { userId },
      include: {
        division: {
          select: {
            id: true,
            name: true,
            level: true,
            gameType: true,
            genderCategory: true,
            season: {
              select: {
                id: true,
                name: true,
                isActive: true,
                startDate: true,
                endDate: true
              }
            }
          }
        },
        assignedByAdmin: {
          select: { id: true, userId: true }
        }
      },
      orderBy: { assignedAt: 'desc' }
    });

    console.log(`✅ Found ${assignments.length} assignments for user ${userId}`);

    return res.json({
      success: true,
      data: assignments,
      count: assignments.length
    });

  } catch (error) {
    console.error("❌ Error fetching user assignments:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch user assignments"
    });
  }
};

// Auto-assign players to divisions (bulk assignment)
export const autoAssignPlayersToDivisions = async (req: Request, res: Response) => {
  try {
    const { seasonId, assignedBy } = req.body;

    console.log(`🤖 Starting auto-assignment for season ${seasonId}`);

    if (!seasonId) {
      return res.status(400).json({
        success: false,
        error: "Season ID is required"
      });
    }

    // Get all users without division assignments in this season
    const unassignedUsers = await prisma.seasonMembership.findMany({
      where: {
        seasonId,
        divisionId: null,
        status: "ACTIVE"
      },
      include: {
        user: {
          include: {
            initialRatingResult: true
          }
        }
      }
    });

    // Get available divisions for this season
    const divisions = await prisma.division.findMany({
      where: {
        seasonId,
        isActiveDivision: true,
        autoAssignmentEnabled: true
      },
      orderBy: [
        { level: 'asc' },
        { pointsThreshold: 'asc' }
      ]
    });

    if (divisions.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No divisions available for auto-assignment"
      });
    }

    const assignments = [];
    const errors = [];

    for (const membership of unassignedUsers) {
      try {
        const userRating = membership.user.initialRatingResult?.[0]?.rating || 0;
        
        // Find appropriate division based on rating and capacity
        let targetDivision = null;
        
        for (const division of divisions) {
          const capacityCheck = await checkDivisionCapacity(division.id, division.gameType);
          
          if (capacityCheck.hasCapacity && 
              (!division.pointsThreshold || userRating >= division.pointsThreshold)) {
            targetDivision = division;
          }
        }

        if (targetDivision) {
          const assignment = await prisma.divisionAssignment.create({
            data: {
              divisionId: targetDivision.id,
              userId: membership.userId,
              assignedBy: assignedBy || null,
              notes: `Auto-assigned based on rating: ${userRating}`
            },
            include: {
              user: { select: { name: true } },
              division: { select: { name: true } }
            }
          });

          // Update season membership
          await prisma.seasonMembership.update({
            where: { id: membership.id },
            data: { divisionId: targetDivision.id }
          });

          // Update division counts
          await updateDivisionCounts(targetDivision.id, true);

          assignments.push(assignment);

          // Socket notifications FUTURE TO-DO 
          // if (req.io) {
          //   req.io.to(membership.userId).emit('division_assigned', {
          //     assignment,
          //     message: `You have been auto-assigned to ${targetDivision.name}`,
          //     timestamp: new Date().toISOString()
          //   });
          // }

        } else {
          errors.push({
            userId: membership.userId,
            userName: membership.user.name,
            reason: "No suitable division found or all divisions at capacity"
          });
        }

      } catch (error) {
        errors.push({
          userId: membership.userId,
          userName: membership.user.name,
          reason: error.message
        });
      }
    }

    console.log(`✅ Auto-assignment completed: ${assignments.length} successful, ${errors.length} failed`);

    return res.json({
      success: true,
      message: "Auto-assignment completed",
      data: {
        assignmentsCreated: assignments.length,
        assignments,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error("❌ Error in auto-assignment:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to auto-assign users"
    });
  }
};

// Transfer player between divisions
export const transferPlayerBetweenDivisions = async (req: Request, res: Response) => {
  try {
    const { userId, fromDivisionId, toDivisionId, transferredBy, reason } = req.body;

    console.log(`🔄 Transferring user ${userId} from division ${fromDivisionId} to ${toDivisionId}`);

    if (!userId || !fromDivisionId || !toDivisionId) {
      return res.status(400).json({
        success: false,
        error: "userId, fromDivisionId, and toDivisionId are required"
      });
    }

    // Verify current assignment exists
    const currentAssignment = await prisma.divisionAssignment.findUnique({
      where: { divisionId_userId: { divisionId: fromDivisionId, userId } },
      include: {
        division: { select: { seasonId: true, name: true } }
      }
    });

    if (!currentAssignment) {
      return res.status(404).json({
        success: false,
        error: "User is not currently assigned to the source division"
      });
    }

    // Check target division
    const targetDivision = await prisma.division.findUnique({
      where: { id: toDivisionId },
      select: { 
        id: true, 
        name: true, 
        seasonId: true, 
        gameType: true,
        isActiveDivision: true
      }
    });

    if (!targetDivision) {
      return res.status(404).json({
        success: false,
        error: "Target division not found"
      });
    }

    // Verify both divisions are in the same season
    if (currentAssignment.division.seasonId !== targetDivision.seasonId) {
      return res.status(400).json({
        success: false,
        error: "Cannot transfer between divisions in different seasons"
      });
    }

    // Check target division capacity
    const capacityCheck = await checkDivisionCapacity(toDivisionId, targetDivision.gameType);
    if (!capacityCheck.hasCapacity) {
      return res.status(400).json({
        success: false,
        error: `Target division is at full capacity`
      });
    }

    // Perform transfer in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Remove from current division
      await tx.divisionAssignment.delete({
        where: { divisionId_userId: { divisionId: fromDivisionId, userId } }
      });

      // Create new assignment
      const newAssignment = await tx.divisionAssignment.create({
        data: {
          divisionId: toDivisionId,
          userId,
          assignedBy: transferredBy || null,
          reassignmentCount: currentAssignment.reassignmentCount + 1,
          notes: reason || "Transferred between divisions"
        },
        include: {
          user: { select: { name: true } },
          division: { select: { name: true } }
        }
      });

      await tx.seasonMembership.updateMany({
        where: {
          userId,
          seasonId: targetDivision.seasonId,
          divisionId: fromDivisionId
        },
        data: { divisionId: toDivisionId }
      });

      return newAssignment;
    });

    // Update division counts
    await updateDivisionCounts(fromDivisionId, false); // Decrement source
    await updateDivisionCounts(toDivisionId, true);     // Increment target

    console.log(`✅ User ${userId} transferred successfully`);

    // Socket notifications FUTURE TO-DO 
    // if (req.io) {
    //   req.io.to(userId).emit('division_transferred', {
    //     fromDivision: currentAssignment.division.name,
    //     toDivision: targetDivision.name,
    //     reason: reason || "Transferred by admin",
    //     timestamp: new Date().toISOString()
    //   });
    // }

    return res.json({
      success: true,
      message: "User transferred successfully",
      data: result
    });

  } catch (error) {
    console.error("❌ Error transferring user:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to transfer user between divisions"
    });
  }
};

export const getDivisionsBySeasonId = async (req: Request, res: Response) => {
  try {
    const { seasonId } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      isActive, 
      gameType, 
      level, 
      genderCategory,
      includeAssignments = false 
    } = req.query;

    console.log(`📋 Fetching divisions for season ${seasonId}`);

    if (!seasonId) {
      return res.status(400).json({
        success: false,
        error: "Season ID is required"
      });
    }

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, name: true, isActive: true }
    });

    if (!season) {
      return res.status(404).json({
        success: false,
        error: "Season not found"
      });
    }

  
    const whereConditions: any = {
      seasonId
    };

    if (gameType) {
      const gameTypeEnum = toEnum(gameType as string, GameType);
      if (gameTypeEnum) {
        whereConditions.gameType = gameTypeEnum;
      }
    }

    if (level) {
      const levelEnum = toEnum(level as string, DivisionLevel);
      if (levelEnum) {
        whereConditions.level = levelEnum;
      }
    }

    if (genderCategory) {
      const genderEnum = toEnum(genderCategory as string, GenderType);
      if (genderEnum) {
        whereConditions.genderCategory = genderEnum;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Build include object based on query parameters
    const includeOptions: any = {
      season: {
        select: {
          id: true,
          name: true,
          isActive: true,
          startDate: true,
          endDate: true
        }
      },
      divisionSponsor: {
        select: {
          id: true,
          sponsoredName: true,
          packageTier: true
        }
      },
      _count: {
        select: {
          assignments: true,
          seasonMemberships: true,
          matches: true
        }
      }
    };

    // Include assignments if requested
    if (includeAssignments === 'true') {
      includeOptions.assignments = {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true
            }
          }
        },
        orderBy: {
          assignedAt: 'desc'
        }
      };
    }

    const [divisions, totalCount] = await Promise.all([
      prisma.division.findMany({
        where: whereConditions,
        include: includeOptions,
        orderBy: [
          { level: 'asc' },
          { name: 'asc' }
        ],
        skip,
        take: Number(limit)
      }),
      prisma.division.count({ where: whereConditions })
    ]);

    console.log(`✅ Found ${divisions.length} divisions for season ${seasonId}`);

    // Format the response data
    const formattedDivisions = divisions.map(division => ({
      ...formatDivision(division),
      assignmentCount: division._count?.assignments || 0,
      membershipCount: division._count?.seasonMemberships || 0,
      matchCount: division._count?.matches || 0,
      sponsor: division.divisionSponsor ? {
        id: division.divisionSponsor.id,
        name: division.divisionSponsor.sponsoredName,
        tier: division.divisionSponsor.packageTier
      } : null,
      assignments: includeAssignments === 'true' ? division.assignments : undefined
    }));

    return res.json({
      success: true,
      data: formattedDivisions,
      season: {
        id: season.id,
        name: season.name,
        isActive: season.isActive
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit))
      },
      filters: {
        isActive: isActive ? isActive === 'true' : undefined,
        gameType: gameType || undefined,
        level: level || undefined,
        genderCategory: genderCategory || undefined
      }
    });

  } catch (error) {
    console.error("❌ Error fetching divisions by season:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters"
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to fetch divisions for season"
    });
  }
};

export const getDivisionSummaryBySeasonId = async (req: Request, res: Response) => {
  try {
    const { seasonId } = req.params;

    console.log(`📊 Fetching division summary for season ${seasonId}`);

    if (!seasonId) {
      return res.status(400).json({
        success: false,
        error: "Season ID is required"
      });
    }

    const [season, divisionStats] = await Promise.all([
      prisma.season.findUnique({
        where: { id: seasonId },
        select: { id: true, name: true, isActive: true }
      }),
      prisma.division.findMany({
        where: { seasonId },
        select: {
          id: true,
          name: true,
          level: true,
          gameType: true,
          genderCategory: true,
          isActiveDivision: true,
          maxSinglesPlayers: true,
          maxDoublesTeams: true,
          currentSinglesCount: true,
          currentDoublesCount: true,
          _count: {
            select: {
              assignments: true,
              seasonMemberships: true,
              matches: true
            }
          }
        }
      })
    ]);

    if (!season) {
      return res.status(404).json({
        success: false,
        error: "Season not found"
      });
    }

    // Calculate summary statistics
    const summary = {
      totalDivisions: divisionStats.length,
      activeDivisions: divisionStats.filter(d => d.isActiveDivision).length,
      inactiveDivisions: divisionStats.filter(d => !d.isActiveDivision).length,
      totalAssignments: divisionStats.reduce((sum, d) => sum + (d._count?.assignments || 0), 0),
      totalMemberships: divisionStats.reduce((sum, d) => sum + (d._count?.seasonMemberships || 0), 0),
      totalMatches: divisionStats.reduce((sum, d) => sum + (d._count?.matches || 0), 0),
      byGameType: {
        singles: divisionStats.filter(d => d.gameType === GameType.SINGLES).length,
        doubles: divisionStats.filter(d => d.gameType === GameType.DOUBLES).length
      },
      byLevel: {
        beginner: divisionStats.filter(d => d.level === DivisionLevel.BEGINNER).length,
        intermediate: divisionStats.filter(d => d.level === DivisionLevel.INTERMEDIATE).length,
        advanced: divisionStats.filter(d => d.level === DivisionLevel.ADVANCED).length,
        // expert: divisionStats.filter(d => d.level === DivisionLevel.EXPERT).length
      },
      byGender: {
        male: divisionStats.filter(d => d.genderCategory === GenderType.MALE).length,
        female: divisionStats.filter(d => d.genderCategory === GenderType.FEMALE).length,
        mixed: divisionStats.filter(d => d.genderCategory === GenderType.MIXED || !d.genderCategory).length
      },
      capacityUtilization: divisionStats.map(d => {
        const isSingles = d.gameType === GameType.SINGLES;
        const maxCapacity = isSingles ? d.maxSinglesPlayers : d.maxDoublesTeams;
        const currentCount = isSingles ? (d.currentSinglesCount || 0) : (d.currentDoublesCount || 0);
        const utilizationRate = maxCapacity ? (currentCount / maxCapacity) * 100 : 0;
        
        return {
          divisionId: d.id,
          divisionName: d.name,
          maxCapacity: maxCapacity || 0,
          currentCount: currentCount || 0,
          utilizationRate: Math.round(utilizationRate * 100) / 100
        };
      })
    };

    console.log(`✅ Generated summary for season ${seasonId}: ${summary.totalDivisions} divisions`);

    return res.json({
      success: true,
      season: {
        id: season.id,
        name: season.name,
        isActive: season.isActive
      },
      summary,
      divisions: divisionStats.map(formatDivision)
    });

  } catch (error) {
    console.error("❌ Error fetching division summary:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch division summary"
    });
  }
};
