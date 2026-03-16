import { prisma, PrismaClient } from "../lib/prisma";
import { AppError } from "../utils/errors";

interface JoinWaitlistResult {
  success: boolean;
  waitlistUserId: string;
  position: number;
  totalWaitlisted: number;
}

interface WaitlistStatus {
  isWaitlisted: boolean;
  position: number | null;
  totalWaitlisted: number;
  seasonStatus: string;
  maxParticipants: number | null;
  waitlistEnabled: boolean;
}

interface WaitlistedUser {
  id: string;
  userId: string;
  waitlistDate: Date;
  promotedToRegistered: boolean;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export class WaitlistService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient ?? prisma;
  }

  /**
   * Join waitlist for a season
   */
  async joinWaitlist(seasonId: string, userId: string): Promise<JoinWaitlistResult> {
    // Get season with waitlist
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: { waitlist: { include: { waitlistedUsers: true } } },
    });

    if (!season) {
      throw new AppError("Season not found", 404);
    }

    if (season.status !== "UPCOMING") {
      throw new AppError("Can only join waitlist for upcoming seasons", 400);
    }

    // Create waitlist if doesn't exist
    let waitlist = season.waitlist;
    if (!waitlist) {
      waitlist = await this.prisma.waitlist.create({
        data: { seasonId, enabled: true },
        include: { waitlistedUsers: true },
      });
    }

    if (!waitlist.enabled) {
      throw new AppError("Waitlist is not enabled for this season", 400);
    }

    // Check if already on waitlist
    const existing = await this.prisma.waitlistUser.findUnique({
      where: { waitlistId_userId: { waitlistId: waitlist.id, userId } },
    });

    if (existing) {
      throw new AppError("Already on waitlist", 400);
    }

    // Check capacity
    if (waitlist.maxParticipants && waitlist.waitlistedUsers.length >= waitlist.maxParticipants) {
      throw new AppError("Waitlist is full", 400);
    }

    // Check if already registered (use findFirst since unique constraint includes divisionId)
    const existingMembership = await this.prisma.seasonMembership.findFirst({
      where: { seasonId, userId },
    });

    if (existingMembership) {
      throw new AppError("Already registered for this season", 400);
    }

    // Add to waitlist
    const waitlistUser = await this.prisma.waitlistUser.create({
      data: { waitlistId: waitlist.id, userId },
    });

    // Calculate position
    const position = await this.getPosition(waitlist.id, userId);
    const totalWaitlisted = waitlist.waitlistedUsers.length + 1;

    return {
      success: true,
      waitlistUserId: waitlistUser.id,
      position,
      totalWaitlisted,
    };
  }

  /**
   * Leave waitlist
   */
  async leaveWaitlist(seasonId: string, userId: string): Promise<{ success: boolean }> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: { waitlist: true },
    });

    if (!season?.waitlist) {
      throw new AppError("Season or waitlist not found", 404);
    }

    const waitlistUser = await this.prisma.waitlistUser.findUnique({
      where: { waitlistId_userId: { waitlistId: season.waitlist.id, userId } },
    });

    if (!waitlistUser) {
      throw new AppError("Not on waitlist", 404);
    }

    await this.prisma.waitlistUser.delete({
      where: { id: waitlistUser.id },
    });

    return { success: true };
  }

  /**
   * Get user's waitlist status for a season
   */
  async getStatus(seasonId: string, userId: string): Promise<WaitlistStatus> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: { waitlist: { include: { waitlistedUsers: true } } },
    });

    if (!season) {
      throw new AppError("Season not found", 404);
    }

    if (!season.waitlist) {
      return {
        isWaitlisted: false,
        position: null,
        totalWaitlisted: 0,
        seasonStatus: season.status,
        maxParticipants: null,
        waitlistEnabled: false,
      };
    }

    const waitlistUser = await this.prisma.waitlistUser.findUnique({
      where: { waitlistId_userId: { waitlistId: season.waitlist.id, userId } },
    });

    const position = waitlistUser ? await this.getPosition(season.waitlist.id, userId) : null;

    return {
      isWaitlisted: !!waitlistUser,
      position,
      totalWaitlisted: season.waitlist.waitlistedUsers.length,
      seasonStatus: season.status,
      maxParticipants: season.waitlist.maxParticipants,
      waitlistEnabled: season.waitlist.enabled,
    };
  }

  /**
   * Get all waitlisted users (admin)
   */
  async getWaitlistedUsers(seasonId: string): Promise<WaitlistedUser[]> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: { waitlist: true },
    });

    if (!season?.waitlist) {
      return [];
    }

    const users = await this.prisma.waitlistUser.findMany({
      where: { waitlistId: season.waitlist.id },
      orderBy: { waitlistDate: "asc" },
      include: {
        waitlist: false,
      },
    });

    // Get user details separately
    const userIds = users.map(u => u.userId);
    const userDetails = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, image: true },
    });

    const userMap = new Map(userDetails.map(u => [u.id, u]));

    return users.map(u => ({
      ...u,
      user: userMap.get(u.userId) || { id: u.userId, name: null, email: null, image: null },
    }));
  }

  /**
   * Update waitlist settings (admin)
   */
  async updateSettings(
    seasonId: string,
    settings: { enabled?: boolean; maxParticipants?: number | null }
  ): Promise<{ success: boolean }> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: { waitlist: true },
    });

    if (!season) {
      throw new AppError("Season not found", 404);
    }

    if (season.waitlist) {
      await this.prisma.waitlist.update({
        where: { id: season.waitlist.id },
        data: settings,
      });
    } else {
      await this.prisma.waitlist.create({
        data: {
          seasonId,
          enabled: settings.enabled ?? false,
          ...(settings.maxParticipants !== undefined && { maxParticipants: settings.maxParticipants }),
        },
      });
    }

    return { success: true };
  }

  /**
   * Promote all waitlisted users to registered (with PENDING payment).
   * BUG 4: Increments registeredUserCount after promotion.
   * BUG 17: Tracks promoted and failed user IDs for admin visibility.
   */
  async promoteAllUsers(seasonId: string): Promise<{
    promoted: number;
    promotedUserIds: string[];
    failedUserIds: string[];
    seasonName: string;
  }> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        id: true,
        name: true,
        paymentRequired: true,
        waitlist: { include: { waitlistedUsers: true } },
      },
    });

    if (!season?.waitlist) {
      return { promoted: 0, promotedUserIds: [], failedUserIds: [], seasonName: season?.name ?? "" };
    }

    // Determine payment status based on whether season requires payment
    // Free seasons: COMPLETED (nothing to pay). Paid seasons: PENDING (awaiting payment).
    const paymentStatus = season.paymentRequired ? "PENDING" : "COMPLETED";

    const waitlistedUsers = await this.prisma.waitlistUser.findMany({
      where: { waitlistId: season.waitlist.id, promotedToRegistered: false },
      orderBy: { waitlistDate: "asc" },
    });

    let promoted = 0;
    const promotedUserIds: string[] = [];
    const failedUserIds: string[] = [];

    for (const waitlistUser of waitlistedUsers) {
      try {
        // Create membership — payment status depends on season.paymentRequired
        await this.prisma.seasonMembership.create({
          data: {
            seasonId,
            userId: waitlistUser.userId,
            status: "ACTIVE",
            paymentStatus,
          },
        });

        // Mark as promoted
        await this.prisma.waitlistUser.update({
          where: { id: waitlistUser.id },
          data: { promotedToRegistered: true },
        });

        promoted++;
        promotedUserIds.push(waitlistUser.userId);
      } catch (error) {
        // Skip if already registered (unique constraint) or other error
        console.error(`Failed to promote user ${waitlistUser.userId}:`, error);
        failedUserIds.push(waitlistUser.userId);
      }
    }

    // BUG 4: Increment registeredUserCount atomically
    if (promoted > 0) {
      await this.prisma.season.update({
        where: { id: seasonId },
        data: { registeredUserCount: { increment: promoted } },
      });
    }

    return { promoted, promotedUserIds, failedUserIds, seasonName: season.name };
  }

  /**
   * Remove user from waitlist (admin)
   */
  async removeUser(seasonId: string, userId: string): Promise<{ success: boolean }> {
    return this.leaveWaitlist(seasonId, userId);
  }

  /**
   * Get position in waitlist
   */
  private async getPosition(waitlistId: string, userId: string): Promise<number> {
    const users = await this.prisma.waitlistUser.findMany({
      where: { waitlistId },
      orderBy: { waitlistDate: "asc" },
      select: { userId: true },
    });

    const index = users.findIndex(u => u.userId === userId);
    return index + 1; // 1-indexed position
  }
}

// Export singleton instance
export const waitlistService = new WaitlistService();
