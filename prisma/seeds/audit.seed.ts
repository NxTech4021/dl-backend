/**
 * Audit Trail Seed
 * Creates UserActivityLog, PlayerStatusChange, and AdminStatusChange records.
 */

import {
  UserActionType,
  UserTargetType,
  UserStatus,
  AdminStatus,
  StatusChangeReason,
  User,
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
// SEED USER ACTIVITY LOGS
// =============================================

const MALAYSIAN_IPS = [
  "175.139.42.", "60.50.108.", "115.164.73.", "183.171.95.",
  "14.192.67.", "210.195.222.", "103.6.151.", "1.32.44.",
];

async function seedUserActivityLogs(): Promise<number> {
  logSection("📊 Seeding user activity logs...");

  const activeUsers = await prisma.user.findMany({
    where: { status: "ACTIVE", completedOnboarding: true },
    select: { id: true },
    take: 200,
  });

  const matches = await prisma.match.findMany({
    where: { status: "COMPLETED" },
    select: { id: true },
    take: 500,
  });

  const seasons = await prisma.season.findMany({
    select: { id: true },
    take: 30,
  });

  const partnerships = await prisma.partnership.findMany({
    select: { id: true },
    take: 50,
  });

  if (activeUsers.length === 0) {
    logProgress("   No active users for activity logs, skipping...");
    return 0;
  }

  let created = 0;
  const target = 2000;

  // Weighted action distribution
  const actionWeights: { action: UserActionType; target: UserTargetType; weight: number }[] = [
    { action: UserActionType.MATCH_CREATE, target: UserTargetType.MATCH, weight: 15 },
    { action: UserActionType.MATCH_JOIN, target: UserTargetType.MATCH, weight: 15 },
    { action: UserActionType.SCORE_SUBMIT, target: UserTargetType.MATCH, weight: 15 },
    { action: UserActionType.SCORE_CONFIRM, target: UserTargetType.MATCH, weight: 10 },
    { action: UserActionType.SEASON_REGISTER, target: UserTargetType.SEASON, weight: 10 },
    { action: UserActionType.PAIR_REQUEST_SEND, target: UserTargetType.PARTNERSHIP, weight: 5 },
    { action: UserActionType.PAIR_REQUEST_ACCEPT, target: UserTargetType.PARTNERSHIP, weight: 5 },
    { action: UserActionType.MATCH_CANCEL, target: UserTargetType.MATCH, weight: 5 },
    { action: UserActionType.MATCH_LEAVE, target: UserTargetType.MATCH, weight: 3 },
    { action: UserActionType.WALKOVER_REPORT, target: UserTargetType.MATCH, weight: 3 },
    { action: UserActionType.WALKOVER_CONFIRM, target: UserTargetType.MATCH, weight: 2 },
    { action: UserActionType.SCORE_DISPUTE, target: UserTargetType.MATCH, weight: 3 },
    { action: UserActionType.SEASON_WITHDRAW, target: UserTargetType.SEASON, weight: 2 },
    { action: UserActionType.PARTNERSHIP_DISSOLVE, target: UserTargetType.PARTNERSHIP, weight: 1 },
    { action: UserActionType.INVITATION_RESPOND_ACCEPT, target: UserTargetType.INVITATION, weight: 3 },
    { action: UserActionType.INVITATION_RESPOND_DECLINE, target: UserTargetType.INVITATION, weight: 2 },
    { action: UserActionType.PAYMENT_COMPLETE, target: UserTargetType.PAYMENT, weight: 1 },
  ];

  const totalWeight = actionWeights.reduce((s, a) => s + a.weight, 0);

  for (let i = 0; i < target; i++) {
    // Select action by weight
    let roll = Math.random() * totalWeight;
    let selected = actionWeights[0]!;
    for (const aw of actionWeights) {
      roll -= aw.weight;
      if (roll <= 0) {
        selected = aw;
        break;
      }
    }

    // Get appropriate target ID
    let targetId: string | null = null;
    switch (selected.target) {
      case UserTargetType.MATCH:
        targetId = matches.length > 0 ? randomElement(matches).id : null;
        break;
      case UserTargetType.SEASON:
        targetId = seasons.length > 0 ? randomElement(seasons).id : null;
        break;
      case UserTargetType.PARTNERSHIP:
        targetId = partnerships.length > 0 ? randomElement(partnerships).id : null;
        break;
      default:
        targetId = null;
    }

    const ipBase = randomElement(MALAYSIAN_IPS);

    await prisma.userActivityLog.create({
      data: {
        userId: randomElement(activeUsers).id,
        actionType: selected.action,
        targetType: selected.target,
        targetId,
        metadata: { source: randomElement(["mobile", "web"]) },
        ipAddress: `${ipBase}${randomInt(1, 255)}`,
        createdAt: randomDate(monthsAgo(12), daysAgo(1)),
      },
    });
    created++;

    if (created % 500 === 0) {
      logProgress(`   Activity logs: ${created}/${target}`);
    }
  }

  logSuccess(`Created ${created} user activity logs`);
  return created;
}

// =============================================
// SEED PLAYER STATUS CHANGES
// =============================================

async function seedPlayerStatusChanges(users: User[], admins: SeededAdmin[]): Promise<number> {
  logSection("📋 Seeding player status changes...");

  let created = 0;
  const superadminId = admins.length > 0 ? admins[0]!.adminId : null;

  // Suspended users: ACTIVE → SUSPENDED
  const suspendedUsers = users.filter(u => u.status === UserStatus.SUSPENDED);
  for (const user of suspendedUsers) {
    await prisma.playerStatusChange.create({
      data: {
        userId: user.id,
        previousStatus: UserStatus.ACTIVE,
        newStatus: UserStatus.SUSPENDED,
        reason: randomElement([StatusChangeReason.ADMIN_SUSPEND, StatusChangeReason.ADMIN_BAN]),
        notes: randomElement(["Conduct violation", "Multiple no-shows", "Terms of service violation"]),
        triggeredById: superadminId,
        createdAt: randomDate(monthsAgo(6), daysAgo(7)),
      },
    });
    created++;
  }

  // Inactive users: ACTIVE → INACTIVE
  const inactiveUsers = users.filter(u => u.status === UserStatus.INACTIVE);
  for (const user of inactiveUsers) {
    await prisma.playerStatusChange.create({
      data: {
        userId: user.id,
        previousStatus: UserStatus.ACTIVE,
        newStatus: UserStatus.INACTIVE,
        reason: StatusChangeReason.INACTIVITY_THRESHOLD,
        notes: "Automatically marked inactive due to no activity",
        createdAt: randomDate(monthsAgo(4), daysAgo(14)),
      },
    });
    created++;

    // Some inactive users got a warning first
    if (randomBoolean(0.5)) {
      await prisma.playerStatusChange.create({
        data: {
          userId: user.id,
          previousStatus: UserStatus.ACTIVE,
          newStatus: UserStatus.ACTIVE, // Warning doesn't change status
          reason: StatusChangeReason.INACTIVITY_WARNING,
          notes: "Inactivity warning sent",
          createdAt: randomDate(monthsAgo(5), monthsAgo(4)),
        },
      });
      created++;
    }
  }

  // Some active users were reactivated (INACTIVE → ACTIVE)
  const reactivatedUsers = users
    .filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding)
    .slice(0, 20);
  for (const user of reactivatedUsers) {
    // Get a random match for context
    const match = await prisma.match.findFirst({
      where: {
        status: "COMPLETED",
        participants: { some: { userId: user.id } },
      },
      select: { id: true },
    });

    if (match) {
      await prisma.playerStatusChange.create({
        data: {
          userId: user.id,
          previousStatus: UserStatus.INACTIVE,
          newStatus: UserStatus.ACTIVE,
          reason: StatusChangeReason.MATCH_PLAYED,
          notes: "Reactivated after playing a match",
          matchId: match.id,
          createdAt: randomDate(monthsAgo(3), daysAgo(7)),
        },
      });
      created++;
    }
  }

  logSuccess(`Created ${created} player status changes`);
  return created;
}

// =============================================
// SEED ADMIN STATUS CHANGES
// =============================================

async function seedAdminStatusChanges(admins: SeededAdmin[]): Promise<number> {
  logSection("📋 Seeding admin status changes...");

  if (admins.length < 2) return 0;

  let created = 0;
  const superadminId = admins[0]!.adminId;

  // Get admin records with their status
  const adminRecords = await prisma.admin.findMany({
    include: { user: true },
  });

  for (const admin of adminRecords) {
    // Every admin has a creation/registration entry
    if (admin.status === AdminStatus.PENDING) {
      // PENDING admins: just the registration
      await prisma.adminStatusChange.create({
        data: {
          adminId: admin.id,
          previousStatus: AdminStatus.PENDING,
          newStatus: AdminStatus.PENDING,
          reason: StatusChangeReason.REGISTRATION,
          notes: "Admin account created via invite",
          triggeredById: superadminId,
          createdAt: admin.user?.createdAt || randomDate(monthsAgo(6), monthsAgo(3)),
        },
      });
      created++;
    } else if (admin.status === AdminStatus.SUSPENDED) {
      // SUSPENDED admins: PENDING → ACTIVE → SUSPENDED
      await prisma.adminStatusChange.create({
        data: {
          adminId: admin.id,
          previousStatus: AdminStatus.PENDING,
          newStatus: AdminStatus.ACTIVE,
          reason: StatusChangeReason.ADMIN_ACTIVATE,
          notes: "Admin account activated",
          triggeredById: superadminId,
          createdAt: randomDate(monthsAgo(10), monthsAgo(6)),
        },
      });
      created++;

      await prisma.adminStatusChange.create({
        data: {
          adminId: admin.id,
          previousStatus: AdminStatus.ACTIVE,
          newStatus: AdminStatus.SUSPENDED,
          reason: StatusChangeReason.ADMIN_SUSPEND,
          notes: "Admin account suspended",
          triggeredById: superadminId,
          createdAt: randomDate(monthsAgo(3), daysAgo(7)),
        },
      });
      created++;
    } else if (admin.status === AdminStatus.ACTIVE) {
      // ACTIVE admins: PENDING → ACTIVE
      await prisma.adminStatusChange.create({
        data: {
          adminId: admin.id,
          previousStatus: AdminStatus.PENDING,
          newStatus: AdminStatus.ACTIVE,
          reason: StatusChangeReason.ADMIN_ACTIVATE,
          notes: "Admin account activated",
          triggeredById: superadminId,
          createdAt: admin.user?.createdAt || randomDate(monthsAgo(10), monthsAgo(6)),
        },
      });
      created++;
    }
  }

  logSuccess(`Created ${created} admin status changes`);
  return created;
}

// =============================================
// MAIN EXPORT
// =============================================

export async function seedAuditTrails(
  users: User[],
  admins: SeededAdmin[]
): Promise<{
  activityLogCount: number;
  playerStatusCount: number;
  adminStatusCount: number;
}> {
  const activityLogCount = await seedUserActivityLogs();
  const playerStatusCount = await seedPlayerStatusChanges(users, admins);
  const adminStatusCount = await seedAdminStatusChanges(admins);

  return { activityLogCount, playerStatusCount, adminStatusCount };
}
