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
import { sendSuccess, sendPaginated, sendError } from "../utils/response";
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

    return sendSuccess(
      res,
      { leagues, totalMembers },
      `Found ${leagues.length} league(s)`
    );
  } catch (error) {
    console.error("Error fetching leagues:", error);
    return sendError(res, "Error fetching leagues", 500);
  }
};

export const getLeagueById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    if (!id) {
      return sendError(res, "League ID is required", 400);
    }

    const league = await leagueService.getLeagueById(id);

    if (!league) {
      return sendError(res, "League not found", 404);
    }

    return sendSuccess(res, { league }, "League fetched successfully");
  } catch (error) {
    console.error("Error fetching league:", error);
    return sendError(res, "Error fetching league", 500);
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
      return sendError(res, "League name is required", 400);
    }

    if (name.length > 200) {
      return sendError(
        res,
        "League name must be 200 characters or less",
        400
      );
    }

    if (!location || !location.trim()) {
      return sendError(res, "Location is required", 400);
    }

    if (status && !Object.values(Statuses).includes(status as Statuses)) {
      return sendError(
        res,
        `Invalid status. Must be one of: ${Object.values(Statuses).join(
          ", "
        )}`,
        400
      );
    }

    if (
      sportType &&
      !Object.values(SportType).includes(sportType as SportType)
    ) {
      return sendError(
        res,
        `Invalid sportType. Must be one of: ${Object.values(SportType).join(
          ", "
        )}`,
        400
      );
    }

    if (gameType && !Object.values(GameType).includes(gameType as GameType)) {
      return sendError(
        res,
        `Invalid gameType. Must be one of: ${Object.values(GameType).join(
          ", "
        )}`,
        400
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

    return sendSuccess(
      res,
      { league: newLeague },
      "League created successfully",
      201
    );
  } catch (error: unknown) {
    console.error("Error creating league:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("already exists")) {
      return sendError(res, errorMessage, 409);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return sendError(
          res,
          "A league with this name already exists",
          409
        );
      }
    }

    return sendError(res, "Error creating league", 500);
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
      return sendError(res, "Invalid league ID", 400);
    }

    // Validation
    if (name !== undefined && (!name.trim() || name.length > 255)) {
      return sendError(
        res,
        "League name must be between 1 and 255 characters",
        400
      );
    }
    if (location !== undefined && !location.trim()) {
      return sendError(res, "Location cannot be empty", 400);
    }
    if (status && !Object.values(Statuses).includes(status as Statuses)) {
      return sendError(
        res,
        `Invalid status. Must be one of: ${Object.values(Statuses).join(
          ", "
        )}`,
        400
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

    return sendSuccess(
      res,
      { league: updatedLeague },
      "League updated successfully"
    );
  } catch (error: unknown) {
    console.error("Error updating league:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("not found")) {
      return sendError(res, errorMessage, 404);
    }

    if (errorMessage.includes("already exists")) {
      return sendError(res, errorMessage, 409);
    }

    return sendError(res, "Error updating league", 500);
  }
};

export const deleteLeague = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    if (!id || typeof id !== "string") {
      return sendError(res, "Invalid league ID", 400);
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

    return sendSuccess(res, null, "League deleted successfully");
  } catch (error: unknown) {
    console.error("Error deleting league:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("not found")) {
      return sendError(res, errorMessage, 404);
    }

    if (errorMessage.includes("Cannot delete")) {
      return sendError(res, errorMessage, 400);
    }

    return sendError(res, "Error deleting league", 500);
  }
};

export const getLeagueSeasons = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;

    if (!id) {
      return sendError(res, "League ID is required", 400);
    }

    // Check if league exists
    const league = await leagueService.getLeagueById(id);
    if (!league) {
      return sendError(res, "League not found", 404);
    }

    const pageNum = page ? parseInt(page as string, 10) : 1;
    const limitNum = limit ? parseInt(limit as string, 10) : 20;

    const seasons = await leagueService.getLeagueSeasons(id, pageNum, limitNum);

    return sendPaginated(
      res,
      seasons.data,
      seasons.pagination,
      `Found ${seasons.data.length} season(s) for league`
    );
  } catch (error: unknown) {
    console.error("Error fetching league seasons:", error);
    return sendError(res, "Error fetching league seasons", 500);
  }
};
