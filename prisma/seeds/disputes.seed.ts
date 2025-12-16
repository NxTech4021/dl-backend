/**
 * Disputes and Penalties Seeding
 * Creates match disputes, penalties, walkovers, team changes, and withdrawals
 */

import {
  User,
  DisputeStatus,
  DisputeCategory,
  DisputePriority,
  PenaltyType,
  PenaltySeverity,
  PenaltyStatus,
  WalkoverReason,
  TeamChangeRequestStatus,
  WithdrawalStatus,
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

export interface SeededDisputeData {
  disputeCount: number;
  penaltyCount: number;
  walkoverCount: number;
  teamChangeCount: number;
  withdrawalCount: number;
}

// =============================================
// DISPUTE COMMENTS
// =============================================

const DISPUTE_COMMENTS: Record<DisputeCategory, string[]> = {
  WRONG_SCORE: [
    "Opponent submitted wrong score",
    "Final score was different from what we recorded",
    "Score discrepancy in the third set",
    "Opponent claims they won but we actually won",
    "Scores don't match our records",
    "Wrong tiebreak score entered",
    "Missing game in the count",
  ],
  NO_SHOW: [
    "Opponent didn't show up at agreed time",
    "Waited 30 minutes but no one came",
    "Opponent cancelled last minute without notice",
    "No response to scheduling attempts",
  ],
  BEHAVIOR: [
    "Opponent was verbally abusive",
    "Unsportsmanlike conduct during match",
    "Opponent refused to follow rules",
    "Inappropriate language on court",
    "Player was disrespectful",
  ],
  OTHER: [
    "Rule interpretation disagreement",
    "Equipment issue during match",
    "Court condition affected play",
    "External interference during match",
    "Weather-related dispute",
  ],
};

const ADMIN_RESOLUTIONS = [
  "After reviewing evidence, the dispute has been resolved in favor of the reporter.",
  "Both parties have agreed to replay the match.",
  "Score has been corrected based on submitted evidence.",
  "Warning issued to the reported party.",
  "No violation found after investigation.",
  "Match result stands as originally submitted.",
  "The dispute has been dismissed due to insufficient evidence.",
];

const PENALTY_REASONS = [
  "Repeated no-shows",
  "Conduct violation",
  "Late cancellation penalty",
  "Unsportsmanlike behavior",
  "Multiple scheduling failures",
  "Abuse of dispute system",
];

const WITHDRAWAL_REASONS = [
  "Personal reasons",
  "Injury",
  "Work commitments",
  "Moving to different area",
  "Schedule conflicts",
  "Health issues",
  "Family emergency",
];

const TEAM_CHANGE_REASONS = [
  "Partner is injured",
  "Partner withdrew from season",
  "Scheduling incompatibility with current partner",
  "Partner moved away",
  "Partner has work conflicts",
  "Mutual agreement to change teams",
];

// =============================================
// SEED MATCH DISPUTES
// =============================================

export async function seedDisputes(users: User[], admins: SeededAdmin[]): Promise<number> {
  logSection("⚖️ Seeding match disputes...");

  let created = 0;
  const targetDisputes = 150;

  // Get matches that can have disputes (completed matches)
  // Get matches that don't already have disputes
  const matches = await prisma.match.findMany({
    where: {
      status: "COMPLETED",
      disputes: { none: {} }, // Exclude matches that already have disputes
    },
    include: {
      participants: {
        include: {
          user: true,
        },
      },
    },
    take: 300,
  });

  if (matches.length === 0) {
    logProgress("   No completed matches found for disputes, skipping...");
    return 0;
  }

  // Status distribution: 40% resolved, 30% open, 20% under review, 10% rejected
  const statusDistribution: { status: DisputeStatus; weight: number }[] = [
    { status: DisputeStatus.RESOLVED, weight: 40 },
    { status: DisputeStatus.OPEN, weight: 30 },
    { status: DisputeStatus.UNDER_REVIEW, weight: 20 },
    { status: DisputeStatus.REJECTED, weight: 10 },
  ];

  // Category distribution: 50% wrong score, 25% no show, 15% behavior, 10% other
  const categoryDistribution: { category: DisputeCategory; weight: number }[] = [
    { category: DisputeCategory.WRONG_SCORE, weight: 50 },
    { category: DisputeCategory.NO_SHOW, weight: 25 },
    { category: DisputeCategory.BEHAVIOR, weight: 15 },
    { category: DisputeCategory.OTHER, weight: 10 },
  ];

  // Priority distribution
  const priorityDistribution: { priority: DisputePriority; weight: number }[] = [
    { priority: DisputePriority.NORMAL, weight: 50 },
    { priority: DisputePriority.LOW, weight: 20 },
    { priority: DisputePriority.HIGH, weight: 20 },
    { priority: DisputePriority.URGENT, weight: 10 },
  ];

  const totalStatusWeight = statusDistribution.reduce((sum, s) => sum + s.weight, 0);
  const totalCategoryWeight = categoryDistribution.reduce((sum, c) => sum + c.weight, 0);
  const totalPriorityWeight = priorityDistribution.reduce((sum, p) => sum + p.weight, 0);

  const usedMatches = new Set<string>();

  for (let i = 0; i < targetDisputes && i < matches.length; i++) {
    const match = matches[i];

    // Skip if match already has a dispute
    if (usedMatches.has(match.id)) continue;

    // Get participants
    const participants = match.participants;
    if (participants.length < 2) continue;

    const raisedByUser = randomElement(participants);
    usedMatches.add(match.id);

    // Select status
    let random = Math.random() * totalStatusWeight;
    let selectedStatus = statusDistribution[0].status;
    for (const { status, weight } of statusDistribution) {
      random -= weight;
      if (random <= 0) {
        selectedStatus = status;
        break;
      }
    }

    // Select category
    random = Math.random() * totalCategoryWeight;
    let selectedCategory = categoryDistribution[0].category;
    for (const { category, weight } of categoryDistribution) {
      random -= weight;
      if (random <= 0) {
        selectedCategory = category;
        break;
      }
    }

    // Select priority
    random = Math.random() * totalPriorityWeight;
    let selectedPriority = priorityDistribution[0].priority;
    for (const { priority, weight } of priorityDistribution) {
      random -= weight;
      if (random <= 0) {
        selectedPriority = priority;
        break;
      }
    }

    const isResolved = selectedStatus === DisputeStatus.RESOLVED || selectedStatus === DisputeStatus.REJECTED;
    const admin = isResolved && admins.length > 0 ? randomElement(admins) : null;
    const reviewAdmin = admins.length > 0 ? randomElement(admins) : null;

    const submittedAt = randomDate(monthsAgo(10), daysAgo(3));

    await prisma.matchDispute.create({
      data: {
        matchId: match.id,
        raisedByUserId: raisedByUser.userId,
        disputeCategory: selectedCategory,
        disputeComment: randomElement(DISPUTE_COMMENTS[selectedCategory]),
        disputerScore: selectedCategory === DisputeCategory.WRONG_SCORE ? { sets: [[6, 4], [4, 6], [7, 5]] } : null,
        submittedAt,
        status: selectedStatus,
        priority: selectedPriority,
        adminResolution: isResolved ? randomElement(ADMIN_RESOLUTIONS) : null,
        resolvedAt: isResolved ? randomDate(submittedAt, new Date()) : null,
        reviewedByAdminId: reviewAdmin?.adminId || null,
        resolvedByAdminId: admin?.adminId || null,
      },
    });
    created++;

    if (created % 30 === 0) {
      logProgress(`   Disputes: ${created}/${targetDisputes}`);
    }
  }

  logSuccess(`Created ${created} match disputes`);
  return created;
}

// =============================================
// SEED PLAYER PENALTIES
// =============================================

export async function seedPenalties(users: User[], admins: SeededAdmin[]): Promise<number> {
  logSection("🚨 Seeding player penalties...");

  const activeUsers = users.filter(u => u.status === "ACTIVE" && u.completedOnboarding);
  let created = 0;
  const targetPenalties = 80;

  if (admins.length === 0) {
    logProgress("   No admins found, skipping penalties...");
    return 0;
  }

  // Severity distribution
  const severityDistribution: { severity: PenaltySeverity; weight: number }[] = [
    { severity: PenaltySeverity.WARNING, weight: 50 },
    { severity: PenaltySeverity.POINTS_DEDUCTION, weight: 30 },
    { severity: PenaltySeverity.SUSPENSION, weight: 15 },
    { severity: PenaltySeverity.PERMANENT_BAN, weight: 5 },
  ];

  // Status distribution
  const statusDistribution: { status: PenaltyStatus; weight: number }[] = [
    { status: PenaltyStatus.COMPLETED, weight: 40 },
    { status: PenaltyStatus.ACTIVE, weight: 30 },
    { status: PenaltyStatus.EXPIRED, weight: 20 },
    { status: PenaltyStatus.OVERTURNED, weight: 10 },
  ];

  const totalSeverityWeight = severityDistribution.reduce((sum, s) => sum + s.weight, 0);
  const totalStatusWeight = statusDistribution.reduce((sum, s) => sum + s.weight, 0);

  for (let i = 0; i < targetPenalties; i++) {
    const user = randomElement(activeUsers);
    const admin = randomElement(admins);

    // Select severity
    let random = Math.random() * totalSeverityWeight;
    let selectedSeverity = severityDistribution[0].severity;
    for (const { severity, weight } of severityDistribution) {
      random -= weight;
      if (random <= 0) {
        selectedSeverity = severity;
        break;
      }
    }

    // Select status
    random = Math.random() * totalStatusWeight;
    let selectedStatus = statusDistribution[0].status;
    for (const { status, weight } of statusDistribution) {
      random -= weight;
      if (random <= 0) {
        selectedStatus = status;
        break;
      }
    }

    // Map severity to penalty type
    let penaltyType: PenaltyType;
    switch (selectedSeverity) {
      case PenaltySeverity.WARNING:
        penaltyType = PenaltyType.WARNING;
        break;
      case PenaltySeverity.POINTS_DEDUCTION:
        penaltyType = PenaltyType.POINTS_DEDUCTION;
        break;
      case PenaltySeverity.SUSPENSION:
      case PenaltySeverity.PERMANENT_BAN:
        penaltyType = PenaltyType.SUSPENSION;
        break;
      default:
        penaltyType = PenaltyType.WARNING;
    }

    const createdAt = randomDate(monthsAgo(8), daysAgo(1));

    await prisma.playerPenalty.create({
      data: {
        userId: user.id,
        penaltyType,
        severity: selectedSeverity,
        pointsDeducted: penaltyType === PenaltyType.POINTS_DEDUCTION ? randomInt(5, 30) : null,
        suspensionDays: penaltyType === PenaltyType.SUSPENSION ? randomInt(7, 30) : null,
        suspensionStartDate: penaltyType === PenaltyType.SUSPENSION ? createdAt : null,
        suspensionEndDate: penaltyType === PenaltyType.SUSPENSION
          ? new Date(createdAt.getTime() + randomInt(7, 30) * 24 * 60 * 60 * 1000)
          : null,
        issuedByAdminId: admin.adminId,
        reason: randomElement(PENALTY_REASONS),
        status: selectedStatus,
        expiresAt: selectedStatus === PenaltyStatus.ACTIVE
          ? new Date(Date.now() + randomInt(7, 60) * 24 * 60 * 60 * 1000)
          : null,
        createdAt,
        updatedAt: randomDate(createdAt, new Date()),
      },
    });
    created++;

    if (created % 20 === 0) {
      logProgress(`   Penalties: ${created}/${targetPenalties}`);
    }
  }

  logSuccess(`Created ${created} player penalties`);
  return created;
}

// =============================================
// SEED MATCH WALKOVERS
// =============================================

export async function seedWalkovers(users: User[], admins: SeededAdmin[]): Promise<number> {
  logSection("🚶 Seeding match walkovers...");

  let created = 0;

  // Get matches that are walkovers (completed matches with isWalkover=true)
  const matches = await prisma.match.findMany({
    where: {
      status: "COMPLETED",
      isWalkover: true,
    },
    include: {
      participants: true,
    },
    take: 100,
  });

  if (matches.length === 0) {
    logProgress("   No walkover matches found, skipping...");
    return 0;
  }

  const walkoverReasons: WalkoverReason[] = [
    WalkoverReason.NO_SHOW,
    WalkoverReason.LATE_CANCELLATION,
    WalkoverReason.INJURY,
    WalkoverReason.PERSONAL_EMERGENCY,
    WalkoverReason.OTHER,
  ];

  for (const match of matches) {
    // Check if walkover already exists
    const existing = await prisma.matchWalkover.findUnique({
      where: { matchId: match.id },
    });

    if (existing) continue;

    const participants = match.participants;
    if (participants.length < 2) continue;

    const defaultingPlayer = randomElement(participants);
    const winningPlayer = participants.find(p => p.id !== defaultingPlayer.id);

    if (!winningPlayer) continue;

    const admin = admins.length > 0 ? randomElement(admins) : null;

    await prisma.matchWalkover.create({
      data: {
        matchId: match.id,
        walkoverReason: randomElement(walkoverReasons),
        walkoverReasonDetail: randomBoolean(0.5) ? "Additional details about the walkover" : null,
        defaultingPlayerId: defaultingPlayer.userId,
        winningPlayerId: winningPlayer.userId,
        reportedBy: winningPlayer.userId,
        confirmedBy: randomBoolean(0.7) ? defaultingPlayer.userId : null,
        adminVerified: admin ? true : false,
        adminVerifiedBy: admin?.adminId || null,
        adminVerifiedAt: admin ? randomDate(match.createdAt, new Date()) : null,
      },
    });
    created++;
  }

  logSuccess(`Created ${created} match walkovers`);
  return created;
}

// =============================================
// SEED TEAM CHANGE REQUESTS
// =============================================

export async function seedTeamChangeRequests(users: User[], admins: SeededAdmin[]): Promise<number> {
  logSection("🔄 Seeding team change requests...");

  let created = 0;
  const targetRequests = 60;

  // Get season memberships with divisions
  const memberships = await prisma.seasonMembership.findMany({
    where: {
      season: {
        status: { in: ["ACTIVE", "UPCOMING"] },
      },
      divisionId: { not: null },
    },
    include: {
      user: true,
      season: true,
      division: true,
    },
    take: 150,
  });

  if (memberships.length < 10) {
    logProgress("   Not enough memberships for team changes, skipping...");
    return 0;
  }

  // Get all divisions for requesting different ones
  const divisions = await prisma.division.findMany({
    take: 50,
  });

  // Status distribution
  const statusDistribution: { status: TeamChangeRequestStatus; weight: number }[] = [
    { status: TeamChangeRequestStatus.APPROVED, weight: 40 },
    { status: TeamChangeRequestStatus.PENDING, weight: 30 },
    { status: TeamChangeRequestStatus.DENIED, weight: 20 },
    { status: TeamChangeRequestStatus.CANCELLED, weight: 10 },
  ];

  const totalWeight = statusDistribution.reduce((sum, s) => sum + s.weight, 0);

  for (let i = 0; i < targetRequests && i < memberships.length; i++) {
    const membership = memberships[i];

    if (!membership.divisionId) continue;

    // Find a different division to request
    const otherDivisions = divisions.filter(d =>
      d.seasonId === membership.seasonId && d.id !== membership.divisionId
    );

    if (otherDivisions.length === 0) continue;

    const requestedDivision = randomElement(otherDivisions);

    // Select status
    let random = Math.random() * totalWeight;
    let selectedStatus = statusDistribution[0].status;
    for (const { status, weight } of statusDistribution) {
      random -= weight;
      if (random <= 0) {
        selectedStatus = status;
        break;
      }
    }

    const createdAt = randomDate(monthsAgo(6), daysAgo(1));
    const isProcessed = selectedStatus !== TeamChangeRequestStatus.PENDING;
    const admin = isProcessed && admins.length > 0 ? randomElement(admins) : null;

    await prisma.teamChangeRequest.create({
      data: {
        userId: membership.userId,
        seasonId: membership.seasonId,
        currentDivisionId: membership.divisionId,
        requestedDivisionId: requestedDivision.id,
        reason: randomElement(TEAM_CHANGE_REASONS),
        status: selectedStatus,
        reviewedByAdminId: admin?.adminId || null,
        reviewedAt: isProcessed ? randomDate(createdAt, new Date()) : null,
        adminNotes: isProcessed && randomBoolean(0.5) ? "Request reviewed and processed." : null,
        createdAt,
        updatedAt: randomDate(createdAt, new Date()),
      },
    });
    created++;

    if (created % 15 === 0) {
      logProgress(`   Team changes: ${created}/${targetRequests}`);
    }
  }

  logSuccess(`Created ${created} team change requests`);
  return created;
}

// =============================================
// SEED WITHDRAWAL REQUESTS
// =============================================

export async function seedWithdrawalRequests(users: User[], admins: SeededAdmin[]): Promise<number> {
  logSection("🚪 Seeding withdrawal requests...");

  let created = 0;
  const targetRequests = 50;

  // Get season memberships
  const memberships = await prisma.seasonMembership.findMany({
    where: {
      season: {
        status: { in: ["ACTIVE", "UPCOMING", "FINISHED"] },
      },
    },
    include: {
      user: true,
      season: true,
    },
    take: 100,
  });

  if (memberships.length < 10) {
    logProgress("   Not enough memberships for withdrawals, skipping...");
    return 0;
  }

  // Status distribution
  const statusDistribution: { status: WithdrawalStatus; weight: number }[] = [
    { status: WithdrawalStatus.APPROVED, weight: 50 },
    { status: WithdrawalStatus.PENDING, weight: 30 },
    { status: WithdrawalStatus.REJECTED, weight: 20 },
  ];

  const totalWeight = statusDistribution.reduce((sum, s) => sum + s.weight, 0);
  const usedCombinations = new Set<string>();

  for (let i = 0; i < targetRequests && i < memberships.length; i++) {
    const membership = memberships[i];

    const key = `${membership.userId}-${membership.seasonId}`;
    if (usedCombinations.has(key)) continue;
    usedCombinations.add(key);

    // Check if withdrawal already exists
    const existing = await prisma.withdrawalRequest.findFirst({
      where: {
        userId: membership.userId,
        seasonId: membership.seasonId,
      },
    });

    if (existing) continue;

    // Select status
    let random = Math.random() * totalWeight;
    let selectedStatus = statusDistribution[0].status;
    for (const { status, weight } of statusDistribution) {
      random -= weight;
      if (random <= 0) {
        selectedStatus = status;
        break;
      }
    }

    const createdAt = randomDate(monthsAgo(8), daysAgo(1));
    const isProcessed = selectedStatus !== WithdrawalStatus.PENDING;
    const admin = isProcessed && admins.length > 0 ? randomElement(admins) : null;

    await prisma.withdrawalRequest.create({
      data: {
        userId: membership.userId,
        seasonId: membership.seasonId,
        reason: randomElement(WITHDRAWAL_REASONS),
        status: selectedStatus,
        processedByAdminId: admin ? admin.userId : null,
        createdAt,
        updatedAt: randomDate(createdAt, new Date()),
      },
    });
    created++;
  }

  logSuccess(`Created ${created} withdrawal requests`);
  return created;
}

// =============================================
// MAIN DISPUTE SEEDING FUNCTION
// =============================================

export async function seedDisputesAndPenalties(users: User[], admins: SeededAdmin[]): Promise<SeededDisputeData> {
  const disputeCount = await seedDisputes(users, admins);
  const penaltyCount = await seedPenalties(users, admins);
  const walkoverCount = await seedWalkovers(users, admins);
  const teamChangeCount = await seedTeamChangeRequests(users, admins);
  const withdrawalCount = await seedWithdrawalRequests(users, admins);

  return {
    disputeCount,
    penaltyCount,
    walkoverCount,
    teamChangeCount,
    withdrawalCount,
  };
}
