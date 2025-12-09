/**
 * Admin Activity Logs Seeding
 * Creates realistic admin activity logs across all action categories
 */

import {
  AdminActionType,
  AdminTargetType,
} from "@prisma/client";
import {
  prisma,
  randomDate,
  randomElement,
  randomInt,
  randomBoolean,
  monthsAgo,
  daysAgo,
  logSection,
  logSuccess,
  logProgress,
} from "./utils";
import type { SeededAdmin } from "./users.seed";

// =============================================
// TYPES
// =============================================

export interface SeededAdminLogData {
  logCount: number;
}

// =============================================
// ACTION DESCRIPTIONS
// =============================================

const ACTION_DESCRIPTIONS: Record<AdminActionType, string[]> = {
  // Player management
  PLAYER_BAN: [
    "Banned player for repeated violations",
    "Player suspended due to misconduct",
    "Account banned for terms of service violation",
    "Temporary ban applied after multiple warnings",
  ],
  PLAYER_UNBAN: [
    "Player ban lifted after appeal",
    "Unbanned player following review",
    "Ban expired and account restored",
    "Player reinstated after investigation",
  ],
  PLAYER_DELETE: [
    "Player account deleted upon request",
    "Removed inactive player account",
    "Account deletion completed",
  ],
  PLAYER_UPDATE: [
    "Updated player profile information",
    "Corrected player contact details",
    "Modified player rating manually",
    "Updated player division assignment",
  ],
  PLAYER_STATUS_CHANGE: [
    "Changed player status to active",
    "Set player status to inactive",
    "Player marked as suspended",
    "Restored player to active status",
  ],

  // League management
  LEAGUE_CREATE: [
    "Created new tennis league",
    "New pickleball league added",
    "Launched new padel league",
    "Created regional league",
  ],
  LEAGUE_UPDATE: [
    "Updated league settings",
    "Modified league description",
    "Changed league location",
    "Updated league rules",
  ],
  LEAGUE_DELETE: [
    "Removed inactive league",
    "Deleted league after merger",
    "League archived",
  ],
  LEAGUE_STATUS_CHANGE: [
    "League status changed to active",
    "League marked as completed",
    "League paused temporarily",
    "League reopened for registration",
  ],

  // Season management
  SEASON_CREATE: [
    "Created new season",
    "New season added to league",
    "Season 2024 created",
    "Summer season initiated",
  ],
  SEASON_UPDATE: [
    "Updated season dates",
    "Modified season entry fee",
    "Changed season registration deadline",
    "Updated season description",
  ],
  SEASON_DELETE: [
    "Removed cancelled season",
    "Deleted empty season",
    "Season removed from system",
  ],
  SEASON_STATUS_CHANGE: [
    "Season status changed to active",
    "Season marked as finished",
    "Season registration opened",
    "Season closed for new registrations",
  ],

  // Division management
  DIVISION_CREATE: [
    "Created Division A",
    "New beginner division added",
    "Advanced division created",
    "Created intermediate division",
  ],
  DIVISION_UPDATE: [
    "Updated division capacity",
    "Modified division skill range",
    "Changed division name",
    "Updated division settings",
  ],
  DIVISION_DELETE: [
    "Removed empty division",
    "Merged divisions",
    "Division archived",
  ],

  // Match management
  MATCH_VOID: [
    "Voided match due to invalid result",
    "Match result invalidated",
    "Match cancelled and voided",
    "Void applied after investigation",
  ],
  MATCH_EDIT_RESULT: [
    "Corrected match score",
    "Updated final result",
    "Score correction applied",
    "Match result amended",
  ],
  MATCH_EDIT_SCHEDULE: [
    "Rescheduled match",
    "Updated match time",
    "Changed match venue",
    "Match date modified",
  ],
  MATCH_WALKOVER: [
    "Walkover awarded to player",
    "No-show walkover applied",
    "Walkover due to injury",
    "Late cancellation walkover",
  ],

  // Dispute management
  DISPUTE_RESOLVE: [
    "Resolved dispute in favor of plaintiff",
    "Dispute closed after investigation",
    "Score dispute resolved",
    "Dispute marked as resolved",
  ],
  DISPUTE_OVERRIDE: [
    "Override applied to disputed match",
    "Admin override for dispute resolution",
    "Dispute decision overridden",
    "Manual override applied",
  ],

  // System settings
  SETTINGS_UPDATE: [
    "Updated system settings",
    "Modified notification preferences",
    "Changed default rating parameters",
    "Updated platform configuration",
  ],

  // Bug reports
  BUG_ASSIGN: [
    "Assigned bug report to developer",
    "Bug ticket reassigned",
    "Issue assigned for review",
  ],
  BUG_RESOLVE: [
    "Bug report marked as resolved",
    "Issue fixed and closed",
    "Bug resolution confirmed",
  ],
  BUG_UPDATE: [
    "Updated bug report status",
    "Added notes to bug report",
    "Changed bug priority",
    "Updated bug severity",
  ],

  // Admin management
  ADMIN_CREATE: [
    "Created new admin account",
    "New moderator added",
    "Admin user created",
  ],
  ADMIN_UPDATE: [
    "Updated admin permissions",
    "Modified admin role",
    "Changed admin status",
  ],
  ADMIN_DELETE: [
    "Removed admin account",
    "Admin access revoked",
    "Admin user deleted",
  ],

  // Other
  OTHER: [
    "Manual system operation performed",
    "Bulk data update completed",
    "System maintenance action",
    "Custom admin action",
  ],
};

// Map action types to target types
const ACTION_TO_TARGET: Record<AdminActionType, AdminTargetType> = {
  PLAYER_BAN: AdminTargetType.PLAYER,
  PLAYER_UNBAN: AdminTargetType.PLAYER,
  PLAYER_DELETE: AdminTargetType.PLAYER,
  PLAYER_UPDATE: AdminTargetType.PLAYER,
  PLAYER_STATUS_CHANGE: AdminTargetType.PLAYER,
  LEAGUE_CREATE: AdminTargetType.LEAGUE,
  LEAGUE_UPDATE: AdminTargetType.LEAGUE,
  LEAGUE_DELETE: AdminTargetType.LEAGUE,
  LEAGUE_STATUS_CHANGE: AdminTargetType.LEAGUE,
  SEASON_CREATE: AdminTargetType.SEASON,
  SEASON_UPDATE: AdminTargetType.SEASON,
  SEASON_DELETE: AdminTargetType.SEASON,
  SEASON_STATUS_CHANGE: AdminTargetType.SEASON,
  DIVISION_CREATE: AdminTargetType.DIVISION,
  DIVISION_UPDATE: AdminTargetType.DIVISION,
  DIVISION_DELETE: AdminTargetType.DIVISION,
  MATCH_VOID: AdminTargetType.MATCH,
  MATCH_EDIT_RESULT: AdminTargetType.MATCH,
  MATCH_EDIT_SCHEDULE: AdminTargetType.MATCH,
  MATCH_WALKOVER: AdminTargetType.MATCH,
  DISPUTE_RESOLVE: AdminTargetType.DISPUTE,
  DISPUTE_OVERRIDE: AdminTargetType.DISPUTE,
  SETTINGS_UPDATE: AdminTargetType.SETTINGS,
  BUG_ASSIGN: AdminTargetType.BUG_REPORT,
  BUG_RESOLVE: AdminTargetType.BUG_REPORT,
  BUG_UPDATE: AdminTargetType.BUG_REPORT,
  ADMIN_CREATE: AdminTargetType.ADMIN,
  ADMIN_UPDATE: AdminTargetType.ADMIN,
  ADMIN_DELETE: AdminTargetType.ADMIN,
  OTHER: AdminTargetType.OTHER,
};

// =============================================
// SEED ADMIN LOGS
// =============================================

export async function seedAdminLogs(admins: SeededAdmin[]): Promise<number> {
  logSection("📋 Seeding admin activity logs...");

  if (admins.length === 0) {
    logProgress("   No admins found, skipping admin logs...");
    return 0;
  }

  let created = 0;
  const targetLogs = 300;

  // Get target IDs for various types
  const users = await prisma.user.findMany({ take: 50, select: { id: true } });
  const leagues = await prisma.league.findMany({ take: 20, select: { id: true } });
  const seasons = await prisma.season.findMany({ take: 30, select: { id: true } });
  const divisions = await prisma.division.findMany({ take: 30, select: { id: true } });
  const matches = await prisma.match.findMany({ take: 100, select: { id: true } });
  const disputes = await prisma.matchDispute.findMany({ take: 50, select: { id: true } });
  const bugReports = await prisma.bugReport.findMany({ take: 30, select: { id: true } });

  // Action type distribution (weighted)
  const actionDistribution: { action: AdminActionType; weight: number }[] = [
    // Player actions - common
    { action: AdminActionType.PLAYER_UPDATE, weight: 25 },
    { action: AdminActionType.PLAYER_STATUS_CHANGE, weight: 15 },
    { action: AdminActionType.PLAYER_BAN, weight: 5 },
    { action: AdminActionType.PLAYER_UNBAN, weight: 3 },

    // League/Season/Division - less common
    { action: AdminActionType.LEAGUE_UPDATE, weight: 8 },
    { action: AdminActionType.LEAGUE_STATUS_CHANGE, weight: 5 },
    { action: AdminActionType.SEASON_UPDATE, weight: 10 },
    { action: AdminActionType.SEASON_STATUS_CHANGE, weight: 8 },
    { action: AdminActionType.DIVISION_UPDATE, weight: 6 },

    // Match actions - frequent
    { action: AdminActionType.MATCH_EDIT_RESULT, weight: 20 },
    { action: AdminActionType.MATCH_EDIT_SCHEDULE, weight: 12 },
    { action: AdminActionType.MATCH_VOID, weight: 5 },
    { action: AdminActionType.MATCH_WALKOVER, weight: 8 },

    // Dispute actions
    { action: AdminActionType.DISPUTE_RESOLVE, weight: 15 },
    { action: AdminActionType.DISPUTE_OVERRIDE, weight: 5 },

    // Bug reports
    { action: AdminActionType.BUG_UPDATE, weight: 12 },
    { action: AdminActionType.BUG_RESOLVE, weight: 8 },
    { action: AdminActionType.BUG_ASSIGN, weight: 5 },

    // Settings & Admin
    { action: AdminActionType.SETTINGS_UPDATE, weight: 3 },
    { action: AdminActionType.ADMIN_UPDATE, weight: 2 },

    // Other
    { action: AdminActionType.OTHER, weight: 2 },
  ];

  const totalWeight = actionDistribution.reduce((sum, a) => sum + a.weight, 0);

  for (let i = 0; i < targetLogs; i++) {
    const admin = randomElement(admins);

    // Select action type based on weight
    let random = Math.random() * totalWeight;
    let selectedAction = actionDistribution[0].action;
    for (const { action, weight } of actionDistribution) {
      random -= weight;
      if (random <= 0) {
        selectedAction = action;
        break;
      }
    }

    const targetType = ACTION_TO_TARGET[selectedAction];
    let targetId: string | null = null;

    // Get appropriate target ID based on action type
    switch (targetType) {
      case AdminTargetType.PLAYER:
        targetId = users.length > 0 ? randomElement(users).id : null;
        break;
      case AdminTargetType.LEAGUE:
        targetId = leagues.length > 0 ? randomElement(leagues).id : null;
        break;
      case AdminTargetType.SEASON:
        targetId = seasons.length > 0 ? randomElement(seasons).id : null;
        break;
      case AdminTargetType.DIVISION:
        targetId = divisions.length > 0 ? randomElement(divisions).id : null;
        break;
      case AdminTargetType.MATCH:
        targetId = matches.length > 0 ? randomElement(matches).id : null;
        break;
      case AdminTargetType.DISPUTE:
        targetId = disputes.length > 0 ? randomElement(disputes).id : null;
        break;
      case AdminTargetType.BUG_REPORT:
        targetId = bugReports.length > 0 ? randomElement(bugReports).id : null;
        break;
      case AdminTargetType.ADMIN:
        targetId = randomElement(admins).adminId;
        break;
      default:
        targetId = null;
    }

    const createdAt = randomDate(monthsAgo(10), daysAgo(1));
    const descriptions = ACTION_DESCRIPTIONS[selectedAction];
    const description = randomElement(descriptions);

    // Generate old/new values for edit operations
    let oldValue: object | null = null;
    let newValue: object | null = null;

    if (selectedAction.includes("UPDATE") || selectedAction.includes("EDIT")) {
      oldValue = { status: "previous", updatedAt: new Date(createdAt.getTime() - 86400000).toISOString() };
      newValue = { status: "updated", updatedAt: createdAt.toISOString() };
    } else if (selectedAction.includes("STATUS")) {
      oldValue = { status: randomElement(["ACTIVE", "INACTIVE", "PENDING"]) };
      newValue = { status: randomElement(["ACTIVE", "COMPLETED", "SUSPENDED"]) };
    }

    await prisma.adminLog.create({
      data: {
        adminId: admin.adminId,
        actionType: selectedAction,
        targetType,
        targetId,
        description,
        oldValue,
        newValue,
        metadata: {
          ipAddress: `192.168.1.${randomInt(1, 255)}`,
          userAgent: randomElement([
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/121",
          ]),
          source: randomElement(["admin-dashboard", "api", "bulk-operation"]),
        },
        createdAt,
      },
    });
    created++;

    if (created % 50 === 0) {
      logProgress(`   Admin logs: ${created}/${targetLogs}`);
    }
  }

  logSuccess(`Created ${created} admin activity logs`);
  return created;
}

// =============================================
// MAIN EXPORT
// =============================================

export async function seedAdminActivityLogs(admins: SeededAdmin[]): Promise<SeededAdminLogData> {
  const logCount = await seedAdminLogs(admins);

  return {
    logCount,
  };
}
