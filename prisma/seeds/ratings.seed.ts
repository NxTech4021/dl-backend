/**
 * Ratings and Standings Seeding
 * Creates player ratings, rating history, adjustments, and recalculations
 */

import {
  User,
  Season,
  League,
  SportType,
  GameType,
  RatingChangeReason,
  AdjustmentType,
  RecalculationScope,
  RecalculationStatus,
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

export interface SeededRatingData {
  ratingCount: number;
  historyCount: number;
  adjustmentCount: number;
  recalculationCount: number;
}

// =============================================
// SEED PLAYER RATINGS
// =============================================

export async function seedPlayerRatings(users: User[]): Promise<number> {
  logSection("⭐ Seeding player ratings...");

  const activeUsers = users.filter(u => u.status === "ACTIVE" && u.completedOnboarding);
  let created = 0;

  // Get seasons for ratings
  const seasons = await prisma.season.findMany({
    where: {
      status: { in: ["ACTIVE", "FINISHED"] },
    },
    include: {
      divisions: true,
      leagues: true,
    },
    take: 20,
  });

  if (seasons.length === 0) {
    logProgress("   No seasons found for player ratings, skipping...");
    return 0;
  }

  const sports: SportType[] = [SportType.PICKLEBALL, SportType.TENNIS, SportType.PADEL];
  const gameTypes: GameType[] = [GameType.DOUBLES, GameType.SINGLES];

  for (const season of seasons) {
    // Get memberships for this season
    const memberships = await prisma.seasonMembership.findMany({
      where: { seasonId: season.id },
      take: 50,
    });

    for (const membership of memberships) {
      // Create rating for each game type
      for (const gameType of gameTypes) {
        // Check if rating already exists
        const existing = await prisma.playerRating.findUnique({
          where: {
            userId_seasonId_gameType: {
              userId: membership.userId,
              seasonId: season.id,
              gameType,
            },
          },
        });

        if (existing) continue;

        // Generate realistic rating (bell curve around 1200-1400)
        const baseRating = 1000 + randomInt(0, 600);
        const matchesPlayed = randomInt(5, 50);

        const createdAt = randomDate(monthsAgo(10), daysAgo(30));

        await prisma.playerRating.create({
          data: {
            userId: membership.userId,
            seasonId: season.id,
            divisionId: membership.divisionId,
            sport: (season.leagues[0]?.sportType || SportType.TENNIS) as SportType,
            gameType,
            currentRating: baseRating,
            ratingDeviation: 50 + randomInt(0, 100),
            volatility: 0.06 + Math.random() * 0.03,
            isProvisional: matchesPlayed < 10,
            matchesPlayed,
            peakRating: baseRating + randomInt(0, 100),
            peakRatingDate: randomDate(createdAt, new Date()),
            lowestRating: baseRating - randomInt(0, 100),
            createdAt,
          },
        });
        created++;
      }
    }

    if (created % 50 === 0) {
      logProgress(`   Player ratings: ${created}`);
    }
  }

  logSuccess(`Created ${created} player ratings`);
  return created;
}

// =============================================
// SEED RATING HISTORY
// =============================================

export async function seedRatingHistory(): Promise<number> {
  logSection("📈 Seeding rating history...");

  let created = 0;

  // Get player ratings
  const playerRatings = await prisma.playerRating.findMany({
    take: 150,
  });

  if (playerRatings.length === 0) {
    logProgress("   No player ratings found for history, skipping...");
    return 0;
  }

  const reasons: RatingChangeReason[] = [
    RatingChangeReason.MATCH_WIN,
    RatingChangeReason.MATCH_LOSS,
    RatingChangeReason.WALKOVER_WIN,
    RatingChangeReason.WALKOVER_LOSS,
  ];

  for (const rating of playerRatings) {
    // Create 5-15 history entries per rating
    const historyCount = randomInt(5, 15);
    let currentRating = rating.currentRating - randomInt(50, 150); // Start lower
    let currentRd = 150; // Start with higher deviation

    for (let i = 0; i < historyCount; i++) {
      const reason = randomElement(reasons);
      const isWin = reason === RatingChangeReason.MATCH_WIN || reason === RatingChangeReason.WALKOVER_WIN;
      const delta = isWin ? randomInt(5, 25) : -randomInt(5, 25);
      const newRating = Math.max(500, Math.min(2500, currentRating + delta));

      // RD decreases with more matches
      const rdDelta = randomInt(2, 8);
      const newRd = Math.max(30, currentRd - rdDelta);

      const recordedAt = randomDate(monthsAgo(10), daysAgo(1));

      // Get a random completed match for context
      const match = await prisma.match.findFirst({
        where: {
          status: "COMPLETED",
          matchDate: { lte: recordedAt },
        },
        select: { id: true },
      });

      await prisma.ratingHistory.create({
        data: {
          playerRatingId: rating.id,
          matchId: match?.id || null,
          ratingBefore: currentRating,
          ratingAfter: newRating,
          delta,
          rdBefore: currentRd,
          rdAfter: newRd,
          reason,
          notes: randomBoolean(0.3) ? `Rating updated after ${reason.toLowerCase().replace(/_/g, " ")}` : null,
          createdAt: recordedAt,
        },
      });
      created++;

      currentRating = newRating;
      currentRd = newRd;
    }

    if (created % 100 === 0) {
      logProgress(`   Rating history: ${created}`);
    }
  }

  logSuccess(`Created ${created} rating history entries`);
  return created;
}

// =============================================
// SEED RATING ADJUSTMENTS
// =============================================

export async function seedRatingAdjustments(admins: SeededAdmin[]): Promise<number> {
  logSection("🔧 Seeding rating adjustments...");

  if (admins.length === 0) {
    logProgress("   No admins found, skipping adjustments...");
    return 0;
  }

  let created = 0;
  const targetAdjustments = 60;

  // Get player ratings
  const playerRatings = await prisma.playerRating.findMany({
    take: 100,
  });

  if (playerRatings.length === 0) {
    logProgress("   No player ratings found for adjustments, skipping...");
    return 0;
  }

  const adjustmentTypes: AdjustmentType[] = [
    AdjustmentType.CORRECTION,
    AdjustmentType.APPEAL_RESOLUTION,
    AdjustmentType.ADMIN_OVERRIDE,
    AdjustmentType.OTHER,
  ];

  const adjustmentReasons = [
    "Initial rating correction based on player feedback",
    "Rating review after dispute resolution",
    "Adjustment following appeal",
    "Manual correction for data error",
    "Rating reset request approved",
    "Promotion/relegation adjustment",
    "New player calibration correction",
  ];

  for (let i = 0; i < targetAdjustments && i < playerRatings.length; i++) {
    const rating = playerRatings[i];
    const admin = randomElement(admins);

    const ratingBefore = rating.currentRating;
    const delta = randomInt(-75, 75);
    const ratingAfter = Math.max(500, Math.min(2500, ratingBefore + delta));

    const createdAt = randomDate(monthsAgo(8), daysAgo(1));

    await prisma.ratingAdjustment.create({
      data: {
        playerRatingId: rating.id,
        adminId: admin.adminId,
        adjustmentType: randomElement(adjustmentTypes),
        ratingBefore,
        ratingAfter,
        delta,
        reason: randomElement(adjustmentReasons),
        internalNotes: randomBoolean(0.4) ? "Adjustment applied after review." : null,
        playerNotified: randomBoolean(0.8),
        notifiedAt: randomBoolean(0.8) ? randomDate(createdAt, new Date()) : null,
        createdAt,
      },
    });
    created++;

    if (created % 15 === 0) {
      logProgress(`   Adjustments: ${created}/${targetAdjustments}`);
    }
  }

  logSuccess(`Created ${created} rating adjustments`);
  return created;
}

// =============================================
// SEED RATING RECALCULATIONS
// =============================================

export async function seedRecalculations(admins: SeededAdmin[]): Promise<number> {
  logSection("📊 Seeding rating recalculations...");

  if (admins.length === 0) {
    logProgress("   No admins found, skipping recalculations...");
    return 0;
  }

  let created = 0;
  const targetRecalculations = 25;

  const scopes: RecalculationScope[] = [
    RecalculationScope.MATCH,
    RecalculationScope.PLAYER,
    RecalculationScope.DIVISION,
    RecalculationScope.SEASON,
  ];

  const statuses: RecalculationStatus[] = [
    RecalculationStatus.APPLIED,
    RecalculationStatus.APPLIED,
    RecalculationStatus.APPLIED,
    RecalculationStatus.PENDING,
    RecalculationStatus.FAILED,
    RecalculationStatus.CANCELLED,
  ];

  // Get some seasons, divisions for scope references
  const seasons = await prisma.season.findMany({ take: 10 });
  const divisions = await prisma.division.findMany({ take: 20 });
  const users = await prisma.user.findMany({ where: { status: "ACTIVE" }, take: 50 });
  const matches = await prisma.match.findMany({ where: { status: "COMPLETED" }, take: 50 });

  for (let i = 0; i < targetRecalculations; i++) {
    const admin = randomElement(admins);
    const scope = randomElement(scopes);
    const status = randomElement(statuses);

    const createdAt = randomDate(monthsAgo(10), daysAgo(7));
    const isApplied = status === RecalculationStatus.APPLIED;
    const isFailed = status === RecalculationStatus.FAILED;

    let scopeData: Record<string, string | null> = {
      matchId: null,
      userId: null,
      divisionId: null,
      seasonId: null,
    };

    switch (scope) {
      case RecalculationScope.MATCH:
        scopeData.matchId = matches.length > 0 ? randomElement(matches).id : null;
        break;
      case RecalculationScope.PLAYER:
        scopeData.userId = users.length > 0 ? randomElement(users).id : null;
        break;
      case RecalculationScope.DIVISION:
        scopeData.divisionId = divisions.length > 0 ? randomElement(divisions).id : null;
        break;
      case RecalculationScope.SEASON:
        scopeData.seasonId = seasons.length > 0 ? randomElement(seasons).id : null;
        break;
    }

    await prisma.ratingRecalculation.create({
      data: {
        scope,
        ...scopeData,
        status,
        initiatedByAdminId: admin.adminId,
        affectedPlayersCount: randomInt(1, 100),
        changesPreview: isApplied || status === RecalculationStatus.PREVIEW_READY
          ? { players: randomInt(5, 50), avgDelta: randomInt(-20, 20) }
          : null,
        previewGeneratedAt: isApplied ? randomDate(createdAt, new Date()) : null,
        appliedAt: isApplied ? randomDate(createdAt, new Date()) : null,
        failedAt: isFailed ? randomDate(createdAt, new Date()) : null,
        errorMessage: isFailed ? "Recalculation failed due to data inconsistency" : null,
        createdAt,
      },
    });
    created++;
  }

  logSuccess(`Created ${created} rating recalculations`);
  return created;
}

// =============================================
// SEED RATING PARAMETERS
// =============================================

export async function seedRatingParameters(leagues: any[], seasons: any[], admins: SeededAdmin[]): Promise<number> {
  logSection("⚙️ Seeding rating parameters...");

  if (admins.length === 0) {
    logProgress("   No admins found, skipping rating parameters...");
    return 0;
  }

  const adminId = admins[0]!.adminId;
  let created = 0;

  // 1. Global default parameters
  await prisma.ratingParameters.create({
    data: {
      initialRating: 1500,
      initialRD: 350,
      kFactorNew: 40,
      kFactorEstablished: 20,
      kFactorThreshold: 30,
      singlesWeight: 1.0,
      doublesWeight: 1.0,
      oneSetMatchWeight: 0.5,
      walkoverWinImpact: 0.5,
      walkoverLossImpact: 1.0,
      provisionalThreshold: 10,
      version: 1,
      effectiveFrom: monthsAgo(12),
      isActive: true,
      createdByAdminId: adminId,
      notes: "Global default rating parameters",
    },
  });
  created++;

  // 2-3. League-specific parameters for competitive leagues
  for (const league of leagues.slice(0, 2)) {
    await prisma.ratingParameters.create({
      data: {
        leagueId: league.id,
        initialRating: 1400,
        initialRD: 300,
        kFactorNew: 32,
        kFactorEstablished: 16,
        kFactorThreshold: 25,
        singlesWeight: 1.2,
        doublesWeight: 0.8,
        oneSetMatchWeight: 0.4,
        walkoverWinImpact: 0.3,
        walkoverLossImpact: 1.2,
        provisionalThreshold: 15,
        version: 1,
        effectiveFrom: monthsAgo(6),
        isActive: true,
        createdByAdminId: adminId,
        notes: `Custom parameters for ${league.name || "competitive league"}`,
      },
    });
    created++;
  }

  // 4-5. Season-specific parameters
  const activeSeasons = seasons.filter((s: any) => s.status === "ACTIVE" || s.status === "FINISHED");
  for (const season of activeSeasons.slice(0, 2)) {
    await prisma.ratingParameters.create({
      data: {
        seasonId: season.id,
        initialRating: 1500,
        initialRD: 350,
        kFactorNew: 48,
        kFactorEstablished: 24,
        kFactorThreshold: 20,
        singlesWeight: 1.0,
        doublesWeight: 1.0,
        oneSetMatchWeight: 0.6,
        walkoverWinImpact: 0.5,
        walkoverLossImpact: 0.8,
        provisionalThreshold: 8,
        version: 1,
        effectiveFrom: season.startDate || monthsAgo(3),
        effectiveUntil: season.endDate || null,
        isActive: season.status === "ACTIVE",
        createdByAdminId: adminId,
        notes: `Season-specific parameters for ${season.name || "season"}`,
      },
    });
    created++;
  }

  logSuccess(`Created ${created} rating parameter sets`);
  return created;
}

// =============================================
// MAIN RATING SEEDING FUNCTION
// =============================================

/**
 * Seeds rating-related data.
 *
 * NOTE: PlayerRating and RatingHistory are now generated by the DMR (Glicko-2)
 * rating system during the DMR seeding phase. This function only seeds
 * admin-related data (adjustments and recalculations) which require
 * DMR ratings to exist first.
 *
 * The old fake rating generation functions are kept for reference but
 * should NOT be called - DMR provides algorithmically accurate ratings
 * based on actual match results.
 */
export async function seedRatingsAndStandings(users: User[], admins: SeededAdmin[]): Promise<SeededRatingData> {
  // NOTE: PlayerRatings and RatingHistory are now seeded by DMR (dmr-ratings.seed.ts)
  // The DMR system processes matches chronologically to generate accurate Glicko-2 ratings.
  // Skipping the old fake rating generation:
  // const ratingCount = await seedPlayerRatings(users);
  // const historyCount = await seedRatingHistory();

  logSection("📊 Seeding rating admin data (adjustments & recalculations)...");
  logProgress("   Note: PlayerRatings and RatingHistory are seeded by DMR processing");

  const adjustmentCount = await seedRatingAdjustments(admins);
  const recalculationCount = await seedRecalculations(admins);

  return {
    ratingCount: 0, // Now handled by DMR
    historyCount: 0, // Now handled by DMR
    adjustmentCount,
    recalculationCount,
  };
}
