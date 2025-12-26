import { Request, Response } from "express";
import * as leagueService from "../services/leagueService";
import {
  Statuses,
  SportType,
  GameType,
  TierType,
  PrismaClient,
  Prisma,
  AdminActionType,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiResponse } from "../utils/ApiResponse";
import { logLeagueAction } from "../services/admin/adminLogService";
import { notificationService } from '../services/notificationService';
import { leagueLifecycleNotifications } from '../helpers/notifications';
import { NOTIFICATION_TYPES } from '../types/notificationTypes';

interface CreateLeagueBody {
  name?: string;
  location?: string;
  description?: string;
  status?: string;
  sportType?: string;
  gameType?: string;
  sponsorships?: Array<Record<string, unknown>>;
  existingSponsorshipIds?: string[];
}

interface UpdateLeagueBody {
  name?: string;
  location?: string;
  description?: string;
  status?: string;
}

export const getLeagues = async (req: Request, res: Response) => {
  try {
    const { leagues, totalMembers } = await leagueService.getAllLeagues();

    return res
      .status(200)
      .json(
        new ApiResponse(
          true,
          200,
          { leagues, totalMembers },
          `Found ${leagues.length} league(s)`
        )
      );
  } catch (error) {
    console.error("Error fetching leagues:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Error fetching leagues"));
  }
};

export const getLeagueById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    if (!id) {
      return res
        .status(400)
        .json(new ApiResponse(false, 400, null, "League ID is required"));
    }

    const league = await leagueService.getLeagueById(id);

    if (!league) {
      return res
        .status(404)
        .json(new ApiResponse(false, 404, null, "League not found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(true, 200, { league }, "League fetched successfully")
      );
  } catch (error) {
    console.error("Error fetching league:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Error fetching league"));
  }
};

export const createLeague = async (req: Request, res: Response) => {
  try {
    const {
      name,
      location,
      description,
      status,
      sportType,
      gameType,
      sponsorships,
      existingSponsorshipIds,
    } = req.body as CreateLeagueBody;

    // Validation
    if (!name || !name.trim()) {
      return res
        .status(400)
        .json(new ApiResponse(false, 400, null, "League name is required"));
    }

    if (name.length > 200) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            false,
            400,
            null,
            "League name must be 200 characters or less"
          )
        );
    }

    if (!location || !location.trim()) {
      return res
        .status(400)
        .json(new ApiResponse(false, 400, null, "Location is required"));
    }

    if (status && !Object.values(Statuses).includes(status as Statuses)) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            false,
            400,
            null,
            `Invalid status. Must be one of: ${Object.values(Statuses).join(
              ", "
            )}`
          )
        );
    }

    if (
      sportType &&
      !Object.values(SportType).includes(sportType as SportType)
    ) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            false,
            400,
            null,
            `Invalid sportType. Must be one of: ${Object.values(SportType).join(
              ", "
            )}`
          )
        );
    }

    if (gameType && !Object.values(GameType).includes(gameType as GameType)) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            false,
            400,
            null,
            `Invalid gameType. Must be one of: ${Object.values(GameType).join(
              ", "
            )}`
          )
        );
    }

    const leagueData: Parameters<typeof leagueService.createLeague>[0] = {
      name,
      location,
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status: status as Statuses }),
      ...(sportType !== undefined && { sportType: sportType as SportType }),
      ...(gameType !== undefined && { gameType: gameType as GameType }),
      ...(sponsorships !== undefined && {
        sponsorships: sponsorships.map((s) => {
          const sponsorship = s as {
            id?: string;
            companyId: string;
            packageTier: string;
            contractAmount: number;
            sponsoredName?: string;
            startDate: Date | string;
            endDate?: Date | string;
            isActive?: boolean;
          };

          if (
            !Object.values(TierType).includes(
              sponsorship.packageTier as TierType
            )
          ) {
            throw new Error(
              `Invalid packageTier. Must be one of: ${Object.values(
                TierType
              ).join(", ")}`
            );
          }

          const result: {
            id?: string;
            companyId: string;
            packageTier: TierType;
            contractAmount: number;
            sponsoredName?: string;
            startDate: Date | string;
            endDate?: Date | string;
            isActive?: boolean;
            createdById?: string;
          } = {
            ...sponsorship,
            packageTier: sponsorship.packageTier as TierType,
          };

          if (req.user?.id) {
            result.createdById = req.user.id;
          }

          return result;
        }),
      }),
      ...(existingSponsorshipIds !== undefined && { existingSponsorshipIds }),
    };

    const newLeague = await leagueService.createLeague(leagueData);

    // Broadcast new league announcement to all users (push)
    try {
      const users = await prisma.user.findMany({ select: { id: true } });
      if (users.length > 0) {
        const userIds = users.map(u => u.id);
        const notif = leagueLifecycleNotifications.newLeagueAnnouncement(
          newLeague.location || 'your area',
          newLeague.sportType || 'sport'
        );

        // Ensure notification type maps to push by using LEAGUE_ANNOUNCEMENT
        await notificationService.createNotification({
          userIds,
          ...notif,
          type: NOTIFICATION_TYPES.LEAGUE_ANNOUNCEMENT || notif.type,
        });
      }
    } catch (err) {
      console.error('Failed to send new league announcement notifications:', err);
    }

    // Log admin action if user is authenticated
    if (req.user?.id) {
      await logLeagueAction(
        req.user.id,
        AdminActionType.LEAGUE_CREATE,
        newLeague.id,
        `Created league: ${name}`,
        undefined,
        { name, location, description, sportType, gameType }
      );
    }

    return res
      .status(201)
      .json(
        new ApiResponse(
          true,
          201,
          { league: newLeague },
          "League created successfully"
        )
      );
  } catch (error: unknown) {
    console.error("Error creating league:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("already exists")) {
      return res
        .status(409)
        .json(new ApiResponse(false, 409, null, errorMessage));
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return res
          .status(409)
          .json(
            new ApiResponse(
              false,
              409,
              null,
              "A league with this name already exists"
            )
          );
      }
    }

    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Error creating league"));
  }
};

/**
 * Update league
 * Admin only
 */
export const updateLeague = async (req: Request, res: Response) => {
  // console.log("---- updateLeague called ----");
  // console.log("Request params:", req.params);
  // console.log("Request body:", req.body);
  // console.log("Request user:", req.user?.id);

  try {
    const id = req.params.id;
    const { name, location, description, status } =
      req.body as UpdateLeagueBody;

    if (!id) {
      return res
        .status(400)
        .json(new ApiResponse(false, 400, null, "Invalid league ID"));
    }

    // Validation
    if (name !== undefined && (!name.trim() || name.length > 255)) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            false,
            400,
            null,
            "League name must be between 1 and 255 characters"
          )
        );
    }
    if (location !== undefined && !location.trim()) {
      return res
        .status(400)
        .json(new ApiResponse(false, 400, null, "Location cannot be empty"));
    }
    if (status && !Object.values(Statuses).includes(status as Statuses)) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            false,
            400,
            null,
            `Invalid status. Must be one of: ${Object.values(Statuses).join(
              ", "
            )}`
          )
        );
    }

    const updateData: Parameters<typeof leagueService.updateLeague>[1] = {};

    if (name !== undefined) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status as Statuses;

    const updatedLeague = await leagueService.updateLeague(id, updateData);

    // Log admin action if user is authenticated
    if (req.user?.id) {
      await logLeagueAction(
        req.user.id,
        AdminActionType.LEAGUE_UPDATE,
        id,
        `Updated league: ${updatedLeague.name}`,
        undefined,
        updateData as Record<string, unknown>
      );
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          true,
          200,
          { league: updatedLeague },
          "League updated successfully"
        )
      );
  } catch (error: unknown) {
    console.error("Error updating league:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("not found")) {
      return res
        .status(404)
        .json(new ApiResponse(false, 404, null, errorMessage));
    }

    if (errorMessage.includes("already exists")) {
      return res
        .status(409)
        .json(new ApiResponse(false, 409, null, errorMessage));
    }

    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Error updating league"));
  }
};

export const deleteLeague = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    if (!id || typeof id !== "string") {
      return res
        .status(400)
        .json(new ApiResponse(false, 400, null, "Invalid league ID"));
    }

    await leagueService.deleteLeague(id);

    // Log admin action if user is authenticated
    if (req.user?.id) {
      await logLeagueAction(
        req.user.id,
        AdminActionType.LEAGUE_DELETE,
        id,
        `Deleted league`,
        undefined,
        undefined
      );
    }

    return res
      .status(200)
      .json(new ApiResponse(true, 200, null, "League deleted successfully"));
  } catch (error: unknown) {
    console.error("Error deleting league:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("not found")) {
      return res
        .status(404)
        .json(new ApiResponse(false, 404, null, errorMessage));
    }

    if (errorMessage.includes("Cannot delete")) {
      return res
        .status(400)
        .json(new ApiResponse(false, 400, null, errorMessage));
    }

    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Error deleting league"));
  }
};
