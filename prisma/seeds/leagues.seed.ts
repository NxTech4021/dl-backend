/**
 * League, Season, Division, and Category Seeding
 * Creates 15 leagues, 60 seasons, 150+ divisions
 */

import {
  Prisma,
  SportType,
  GameType,
  GenderType,
  GenderRestriction,
  Statuses,
  SeasonStatus,
  DivisionLevel,
  TierType,
  PartnershipStatus,
  PairRequestStatus,
  SeasonInvitationStatus,
  Season,
  Division,
  User,
  UserStatus,
  MembershipStatus,
  PaymentStatus,
} from "@prisma/client";
import {
  prisma,
  randomDate,
  randomElement,
  randomElements,
  randomDecimal,
  randomInt,
  randomBoolean,
  monthsAgo,
  daysAgo,
  daysFromNow,
  logSection,
  logSuccess,
  logProgress,
  AREAS,
} from "./utils";

// =============================================
// SEED CATEGORIES
// =============================================

export async function seedCategories() {
  logSection("📋 Seeding categories...");

  const categories = [
    { name: "Men's Singles", game_type: GameType.SINGLES, gender_category: GenderType.MALE, genderRestriction: GenderRestriction.MALE, matchFormat: "Best of 3 sets", categoryOrder: 1 },
    { name: "Women's Singles", game_type: GameType.SINGLES, gender_category: GenderType.FEMALE, genderRestriction: GenderRestriction.FEMALE, matchFormat: "Best of 3 sets", categoryOrder: 2 },
    { name: "Men's Doubles", game_type: GameType.DOUBLES, gender_category: GenderType.MALE, genderRestriction: GenderRestriction.MALE, matchFormat: "Best of 3 sets", categoryOrder: 3 },
    { name: "Women's Doubles", game_type: GameType.DOUBLES, gender_category: GenderType.FEMALE, genderRestriction: GenderRestriction.FEMALE, matchFormat: "Best of 3 sets", categoryOrder: 4 },
    { name: "Mixed Doubles", game_type: GameType.DOUBLES, gender_category: GenderType.MIXED, genderRestriction: GenderRestriction.MIXED, matchFormat: "Best of 3 sets", categoryOrder: 5 },
    { name: "Open Singles", game_type: GameType.SINGLES, gender_category: null, genderRestriction: GenderRestriction.OPEN, matchFormat: "Best of 3 sets", categoryOrder: 6 },
    { name: "Open Doubles", game_type: GameType.DOUBLES, gender_category: null, genderRestriction: GenderRestriction.OPEN, matchFormat: "Best of 3 sets", categoryOrder: 7 },
  ];

  const createdCategories = [];
  for (const cat of categories) {
    const existing = await prisma.category.findFirst({ where: { name: cat.name } });
    if (existing) {
      createdCategories.push(existing);
      continue;
    }
    const created = await prisma.category.create({
      data: {
        name: cat.name,
        gameType: cat.game_type,
        genderCategory: cat.gender_category,
        genderRestriction: cat.genderRestriction,
        matchFormat: cat.matchFormat,
        categoryOrder: cat.categoryOrder,
        isActive: true,
      },
    });
    createdCategories.push(created);
  }

  logSuccess(`Created ${createdCategories.length} categories`);
  return createdCategories;
}

// =============================================
// SEED SPONSORSHIPS
// =============================================

export async function seedSponsorships(adminId?: string) {
  logSection("💰 Seeding sponsorships...");

  const sponsorships = [
    { packageTier: TierType.PLATINUM, contractAmount: 50000, sponsorRevenue: 42000, sponsoredName: "Wilson Sports" },
    { packageTier: TierType.PLATINUM, contractAmount: 45000, sponsorRevenue: 38500, sponsoredName: "Nike Athletics" },
    { packageTier: TierType.GOLD, contractAmount: 25000, sponsorRevenue: 19500, sponsoredName: "Adidas Malaysia" },
    { packageTier: TierType.GOLD, contractAmount: 22000, sponsorRevenue: 17600, sponsoredName: "Head Rackets" },
    { packageTier: TierType.GOLD, contractAmount: 20000, sponsorRevenue: 15000, sponsoredName: "Babolat" },
    { packageTier: TierType.SILVER, contractAmount: 12000, sponsorRevenue: 9600, sponsoredName: "Yonex" },
    { packageTier: TierType.SILVER, contractAmount: 10000, sponsorRevenue: 7500, sponsoredName: "Prince Sports" },
    { packageTier: TierType.SILVER, contractAmount: 8000, sponsorRevenue: 6000, sponsoredName: "Dunlop" },
    { packageTier: TierType.BRONZE, contractAmount: 5000, sponsorRevenue: 3500, sponsoredName: "Local Sports Shop" },
    { packageTier: TierType.BRONZE, contractAmount: 4000, sponsorRevenue: 2800, sponsoredName: "KL Sports Equipment" },
    { packageTier: TierType.BRONZE, contractAmount: 3500, sponsorRevenue: 2100, sponsoredName: "Court Masters" },
    { packageTier: TierType.BRONZE, contractAmount: 3000, sponsorRevenue: 1800, sponsoredName: "Racket Pro" },
  ];

  const createdSponsorships = [];
  for (const sponsor of sponsorships) {
    const existing = await prisma.sponsorship.findFirst({ where: { sponsoredName: sponsor.sponsoredName } });
    if (existing) {
      createdSponsorships.push(existing);
      continue;
    }
    const created = await prisma.sponsorship.create({
      data: {
        packageTier: sponsor.packageTier,
        contractAmount: new Prisma.Decimal(sponsor.contractAmount),
        sponsorRevenue: new Prisma.Decimal(sponsor.sponsorRevenue),
        sponsoredName: sponsor.sponsoredName,
        createdById: adminId,
      },
    });
    createdSponsorships.push(created);
  }

  logSuccess(`Created ${createdSponsorships.length} sponsorships`);
  return createdSponsorships;
}

// =============================================
// SEED LEAGUES AND SEASONS
// =============================================

export async function seedLeaguesAndSeasons(adminId: string, categories: any[], sponsorships: any[]) {
  logSection("🏆 Seeding leagues, seasons, and divisions...");

  // 15 leagues across different sports and locations
  const leagues = [
    // Pickleball leagues
    { name: "Subang Pickleball League", location: "Subang Jaya", sportType: SportType.PICKLEBALL, gameType: GameType.DOUBLES },
    { name: "KL Central Pickleball", location: "Kuala Lumpur", sportType: SportType.PICKLEBALL, gameType: GameType.DOUBLES },
    { name: "Selangor Mixed Pickleball", location: "Selangor", sportType: SportType.PICKLEBALL, gameType: GameType.DOUBLES },
    { name: "Mont Kiara Pickleball Club", location: "Mont Kiara", sportType: SportType.PICKLEBALL, gameType: GameType.SINGLES },
    { name: "Damansara Pickleball League", location: "Damansara", sportType: SportType.PICKLEBALL, gameType: GameType.DOUBLES },

    // Tennis leagues
    { name: "KL Tennis League", location: "Kuala Lumpur", sportType: SportType.TENNIS, gameType: GameType.SINGLES },
    { name: "PJ Tennis Association", location: "Petaling Jaya", sportType: SportType.TENNIS, gameType: GameType.DOUBLES },
    { name: "Penang Tennis Club", location: "Penang", sportType: SportType.TENNIS, gameType: GameType.SINGLES },
    { name: "Bangsar Tennis League", location: "Bangsar", sportType: SportType.TENNIS, gameType: GameType.DOUBLES },
    { name: "Ampang Tennis Masters", location: "Ampang", sportType: SportType.TENNIS, gameType: GameType.SINGLES },

    // Padel leagues
    { name: "PJ Padel League", location: "Petaling Jaya", sportType: SportType.PADEL, gameType: GameType.DOUBLES },
    { name: "KL Padel Masters", location: "Kuala Lumpur", sportType: SportType.PADEL, gameType: GameType.DOUBLES },
    { name: "Sunway Padel Club", location: "Sunway", sportType: SportType.PADEL, gameType: GameType.DOUBLES },
    { name: "Cyberjaya Padel League", location: "Cyberjaya", sportType: SportType.PADEL, gameType: GameType.DOUBLES },
    { name: "JB Padel Association", location: "Johor Bahru", sportType: SportType.PADEL, gameType: GameType.DOUBLES },
  ];

  const createdLeagues = [];
  const createdSeasons: Season[] = [];
  const createdDivisions: Division[] = [];

  for (let i = 0; i < leagues.length; i++) {
    const leagueData = leagues[i]!;
    let league = await prisma.league.findFirst({ where: { name: leagueData.name } });

    if (!league) {
      league = await prisma.league.create({
        data: {
          name: leagueData.name,
          location: leagueData.location,
          sportType: leagueData.sportType,
          gameType: leagueData.gameType,
          status: Statuses.ACTIVE,
          createdById: adminId,
          description: `Premier ${leagueData.sportType.toLowerCase()} league in ${leagueData.location}`,
          createdAt: monthsAgo(randomInt(6, 18)),
        },
      });
    }
    createdLeagues.push(league);

    // Connect 1-3 sponsorships to this league (round-robin from available sponsorships)
    if (sponsorships.length > 0) {
      const sponsorCount = 1 + (i % 3); // 1, 2, or 3 sponsors per league
      const leagueSponsorIds = [];
      for (let s = 0; s < sponsorCount; s++) {
        leagueSponsorIds.push({ id: sponsorships[(i + s) % sponsorships.length].id });
      }
      await prisma.league.update({
        where: { id: league.id },
        data: { sponsorships: { connect: leagueSponsorIds } },
      });
    }

    // Create 4 seasons per league with different statuses
    // Distribution: 1 ACTIVE, 1 UPCOMING, 1-2 FINISHED, 0-1 CANCELLED
    const seasonConfigs = [
      { status: SeasonStatus.ACTIVE, startOffset: -45, endOffset: 45 },
      { status: SeasonStatus.UPCOMING, startOffset: 30, endOffset: 120 },
      { status: SeasonStatus.FINISHED, startOffset: -180, endOffset: -90 },
      { status: SeasonStatus.FINISHED, startOffset: -270, endOffset: -180 },
    ];

    for (let s = 0; s < seasonConfigs.length; s++) {
      const config = seasonConfigs[s]!;
      const seasonNumber = s + 1;
      const seasonName = `${leagueData.name} - Season ${seasonNumber}`;

      let season = await prisma.season.findFirst({ where: { name: seasonName } });

      if (!season) {
        const startDate = new Date(Date.now() + config.startOffset * 24 * 60 * 60 * 1000);
        const endDate = new Date(Date.now() + config.endOffset * 24 * 60 * 60 * 1000);

        season = await prisma.season.create({
          data: {
            name: seasonName,
            entryFee: new Prisma.Decimal(50 + s * 10),
            status: config.status,
            isActive: config.status === SeasonStatus.ACTIVE,
            description: `Season ${seasonNumber} of ${leagueData.name}`,
            paymentRequired: randomBoolean(0.7),
            promoCodeSupported: randomBoolean(0.3),
            withdrawalEnabled: config.status !== SeasonStatus.FINISHED,
            startDate,
            endDate,
            regiDeadline: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
            categoryId: categories[i % categories.length]?.id,
            sponsorId: sponsorships[i % sponsorships.length]?.id,
            leagues: { connect: { id: league.id } },
            createdAt: new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        });
      }
      createdSeasons.push(season);

      // Create divisions for ACTIVE and FINISHED seasons
      if (config.status === SeasonStatus.ACTIVE || config.status === SeasonStatus.FINISHED) {
        const divisionLevels = [DivisionLevel.BEGINNER, DivisionLevel.INTERMEDIATE, DivisionLevel.ADVANCED];

        for (let d = 0; d < 3; d++) {
          const divisionName = `Division ${String.fromCharCode(65 + d)}`;
          let division = await prisma.division.findFirst({
            where: { seasonId: season.id, name: divisionName },
          });

          if (!division) {
            division = await prisma.division.create({
              data: {
                name: divisionName,
                description: `${divisionLevels[d]} level division`,
                level: divisionLevels[d],
                gameType: leagueData.gameType,
                genderCategory: categories[i % categories.length]?.genderCategory || GenderType.MIXED,
                maxSinglesPlayers: leagueData.gameType === GameType.SINGLES ? 16 : null,
                maxDoublesTeams: leagueData.gameType === GameType.DOUBLES ? 8 : null,
                seasonId: season.id,
                leagueId: league.id,
                createdByAdminId: adminId,
                isActiveDivision: config.status === SeasonStatus.ACTIVE,
                divisionSponsorId: sponsorships[d % sponsorships.length]?.id,
                prizePoolTotal: new Prisma.Decimal(1000 + d * 500),
              },
            });
          }
          createdDivisions.push(division);
        }
      }
    }

    if ((i + 1) % 5 === 0) {
      logProgress(`Leagues: ${i + 1}/${leagues.length}`);
    }
  }

  logSuccess(`Created ${createdLeagues.length} leagues`);
  logSuccess(`Created ${createdSeasons.length} seasons`);
  logSuccess(`Created ${createdDivisions.length} divisions`);

  return { leagues: createdLeagues, seasons: createdSeasons, divisions: createdDivisions };
}

// =============================================
// SEED SEASON MEMBERSHIPS
// =============================================

export async function seedSeasonMemberships(users: User[], seasons: Season[], divisions: Division[]) {
  logSection("🎫 Seeding season memberships...");

  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const activeAndFinishedSeasons = seasons.filter(s =>
    s.status === SeasonStatus.ACTIVE || s.status === SeasonStatus.FINISHED
  );

  const memberships = [];
  const membershipStatuses: MembershipStatus[] = [
    MembershipStatus.ACTIVE, MembershipStatus.ACTIVE, MembershipStatus.ACTIVE, // Weight active
    MembershipStatus.ACTIVE, MembershipStatus.ACTIVE,
    MembershipStatus.PENDING, MembershipStatus.FLAGGED,
    MembershipStatus.INACTIVE, MembershipStatus.REMOVED
  ];
  const paymentStatuses: PaymentStatus[] = [
    PaymentStatus.COMPLETED, PaymentStatus.COMPLETED, PaymentStatus.COMPLETED, // Weight completed
    PaymentStatus.COMPLETED, PaymentStatus.PENDING, PaymentStatus.FAILED
  ];

  for (const season of activeAndFinishedSeasons) {
    const seasonDivisions = divisions.filter(d => d.seasonId === season.id);
    if (seasonDivisions.length === 0) continue;

    // Calculate total capacity across all divisions in this season
    // For doubles: maxDoublesTeams is team count, each team has 2 players
    const totalCapacity = seasonDivisions.reduce((sum, d) => {
      const cap = d.gameType === "SINGLES"
        ? (d.maxSinglesPlayers ?? 16)
        : (d.maxDoublesTeams ?? 8) * 2;
      return sum + cap;
    }, 0);

    // Member count respects total capacity (leave some room)
    const rawMemberCount = season.status === SeasonStatus.ACTIVE
      ? randomInt(30, 50)
      : randomInt(20, 40);
    const memberCount = Math.min(rawMemberCount, totalCapacity);

    const selectedUsers = activeUsers
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(memberCount, activeUsers.length));

    // Track active assignment counts per division to respect capacity
    // Initialize from existing DB counts for idempotency
    const divisionActiveCount = new Map<string, number>();
    for (const d of seasonDivisions) {
      const existingCount = await prisma.divisionAssignment.count({
        where: { divisionId: d.id },
      });
      divisionActiveCount.set(d.id, existingCount);
    }

    for (let i = 0; i < selectedUsers.length; i++) {
      const user = selectedUsers[i]!;
      // Find a division that still has capacity (round-robin, skip full ones)
      let division: typeof seasonDivisions[0] | undefined;
      for (let attempt = 0; attempt < seasonDivisions.length; attempt++) {
        const candidate = seasonDivisions[(i + attempt) % seasonDivisions.length]!;
        const maxCap = candidate.gameType === "SINGLES"
          ? (candidate.maxSinglesPlayers ?? 16)
          : (candidate.maxDoublesTeams ?? 8) * 2;
        const currentCount = divisionActiveCount.get(candidate.id) ?? 0;
        if (currentCount < maxCap) {
          division = candidate;
          break;
        }
      }
      // All divisions full — skip this user
      if (!division) continue;

      const existing = await prisma.seasonMembership.findFirst({
        where: { userId: user.id, seasonId: season.id },
      });

      if (existing) {
        memberships.push(existing);
        continue;
      }

      // Weight towards ACTIVE and COMPLETED
      const membershipStatus = randomElement(membershipStatuses);
      const paymentStatus = randomElement(paymentStatuses);

      const joinedAt = randomDate(
        new Date(season.createdAt.getTime()),
        new Date(Math.min(Date.now(), season.startDate?.getTime() || Date.now()))
      );

      const membership = await prisma.seasonMembership.create({
        data: {
          userId: user.id,
          seasonId: season.id,
          divisionId: division?.id,
          status: membershipStatus,
          paymentStatus: paymentStatus,
          joinedAt,
          withdrawalReason: membershipStatus === MembershipStatus.REMOVED
            ? randomElement(["Personal reasons", "Schedule conflict", "Injury", "Relocation"])
            : null,
        },
      });
      memberships.push(membership);

      // Create division assignment for active members
      if (division && membershipStatus === MembershipStatus.ACTIVE) {
        await prisma.divisionAssignment.upsert({
          where: { divisionId_userId: { divisionId: division.id, userId: user.id } },
          update: {},
          create: {
            divisionId: division.id,
            userId: user.id,
            notes: "Assigned during registration",
          },
        });
        // Track active count to enforce capacity
        divisionActiveCount.set(division.id, (divisionActiveCount.get(division.id) ?? 0) + 1);
      }
    }
  }

  logSuccess(`Created ${memberships.length} season memberships`);

  // Update denormalized division capacity counters
  logProgress("   Updating division capacity counters...");
  let updatedDivisions = 0;

  for (const division of divisions) {
    const assignmentCount = await prisma.divisionAssignment.count({
      where: { divisionId: division.id },
    });

    if (assignmentCount > 0) {
      await prisma.division.update({
        where: { id: division.id },
        data: division.gameType === "SINGLES"
          ? { currentSinglesCount: assignmentCount }
          : { currentDoublesCount: assignmentCount },
      });
      updatedDivisions++;
    }
  }

  logSuccess(`Updated capacity counters for ${updatedDivisions} divisions`);

  // Update registeredUserCount on each season
  logProgress("   Updating season registered user counts...");
  for (const season of activeAndFinishedSeasons) {
    const count = await prisma.seasonMembership.count({
      where: { seasonId: season.id },
    });
    if (count > 0) {
      await prisma.season.update({
        where: { id: season.id },
        data: { registeredUserCount: count },
      });
    }
  }
  logSuccess(`Updated registered user counts for ${activeAndFinishedSeasons.length} seasons`);

  return memberships;
}

// =============================================
// SEED PARTNERSHIPS (for doubles seasons)
// =============================================

export async function seedPartnerships(seasons: Season[], divisions: Division[]) {
  logSection("👥 Seeding partnerships for doubles seasons...");

  // Find doubles seasons (seasons linked to leagues with gameType DOUBLES)
  const doublesSeasons = await prisma.season.findMany({
    where: {
      id: { in: seasons.map(s => s.id) },
      leagues: { some: { gameType: GameType.DOUBLES } },
      status: { in: [SeasonStatus.ACTIVE, SeasonStatus.FINISHED] },
    },
  });

  let partnershipCount = 0;

  for (const season of doublesSeasons) {
    // Get active memberships grouped by division
    const memberships = await prisma.seasonMembership.findMany({
      where: {
        seasonId: season.id,
        status: MembershipStatus.ACTIVE,
        divisionId: { not: null },
      },
      select: { userId: true, divisionId: true },
      orderBy: { joinedAt: "asc" },
    });

    // Group by division
    const byDivision = new Map<string, string[]>();
    for (const m of memberships) {
      if (!m.divisionId) continue;
      const arr = byDivision.get(m.divisionId) || [];
      arr.push(m.userId);
      byDivision.set(m.divisionId, arr);
    }

    // Pair users within each division
    for (const [divisionId, userIds] of byDivision) {
      for (let i = 0; i + 1 < userIds.length; i += 2) {
        const captainId = userIds[i];
        const partnerId = userIds[i + 1];

        // Check if partnership already exists
        const existing = await prisma.partnership.findFirst({
          where: { captainId, partnerId, seasonId: season.id },
        });
        if (existing) continue;

        await prisma.partnership.create({
          data: {
            captainId,
            partnerId,
            seasonId: season.id,
            divisionId,
            status: PartnershipStatus.ACTIVE,
            createdAt: randomDate(monthsAgo(6), monthsAgo(1)),
          },
        });
        partnershipCount++;
      }
    }
  }

  logSuccess(`Created ${partnershipCount} partnerships`);
}

// =============================================
// SEED PROMO CODES
// =============================================

export async function seedPromoCodes(seasons: Season[]) {
  logSection("🎟️ Seeding promo codes...");

  const promoCodes = [
    { code: "WELCOME10", description: "Welcome discount - 10%", discountValue: 10, isPercentage: true },
    { code: "EARLYBIRD", description: "Early bird discount - RM20", discountValue: 20, isPercentage: false },
    { code: "SUMMER2024", description: "Summer promotion - 15%", discountValue: 15, isPercentage: true },
    { code: "REFERRAL5", description: "Referral discount - RM5", discountValue: 5, isPercentage: false },
    { code: "VIP25", description: "VIP member discount - 25%", discountValue: 25, isPercentage: true },
    { code: "NEWSEASON", description: "New season special - 20%", discountValue: 20, isPercentage: true },
    { code: "COMEBACK15", description: "Comeback player - RM15", discountValue: 15, isPercentage: false },
    { code: "FRIENDS10", description: "Bring a friend - 10%", discountValue: 10, isPercentage: true },
    { code: "EXPIRED2023", description: "Expired code", discountValue: 10, isPercentage: true, isActive: false },
    { code: "OLDCODE", description: "Old promotion", discountValue: 5, isPercentage: false, isActive: false },
  ];

  const activeSeasons = seasons.filter(s => s.promoCodeSupported);
  let created = 0;

  for (const promo of promoCodes) {
    const existing = await prisma.promoCode.findFirst({ where: { code: promo.code } });

    if (!existing) {
      await prisma.promoCode.create({
        data: {
          code: promo.code,
          description: promo.description,
          discountValue: new Prisma.Decimal(promo.discountValue),
          isPercentage: promo.isPercentage,
          isActive: promo.isActive !== false,
          expiresAt: promo.isActive !== false
            ? daysFromNow(randomInt(30, 180))
            : daysAgo(randomInt(30, 90)),
          seasons: {
            connect: activeSeasons.slice(0, randomInt(2, 5)).map(s => ({ id: s.id })),
          },
        },
      });
      created++;
    }
  }

  logSuccess(`Created ${created} promo codes`);
}

// =============================================
// SEED WAITLISTS
// =============================================

export async function seedWaitlists(seasons: Season[], users: User[]) {
  logSection("📋 Seeding waitlists...");

  const upcomingSeasons = seasons.filter(s => s.status === SeasonStatus.UPCOMING);
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  let created = 0;

  for (const season of upcomingSeasons) {
    let waitlist = await prisma.waitlist.findUnique({
      where: { seasonId: season.id },
    });

    if (!waitlist) {
      waitlist = await prisma.waitlist.create({
        data: {
          seasonId: season.id,
          enabled: true,
          maxParticipants: randomInt(30, 100),
        },
      });
      created++;
    }

    // Add 5-15 users to each waitlist
    const waitlistUserCount = randomInt(5, 15);
    const selectedUsers = activeUsers.sort(() => 0.5 - Math.random()).slice(0, waitlistUserCount);

    for (let i = 0; i < selectedUsers.length; i++) {
      const user = selectedUsers[i]!;

      const existing = await prisma.waitlistUser.findFirst({
        where: { waitlistId: waitlist.id, userId: user.id },
      });

      if (!existing) {
        await prisma.waitlistUser.create({
          data: {
            waitlistId: waitlist.id,
            userId: user.id,
            waitlistDate: randomDate(daysAgo(14), new Date()),
            promotedToRegistered: i < 2, // First 2 promoted
          },
        });
      }
    }
  }

  logSuccess(`Created ${created} waitlists with users`);
}

// =============================================
// SEED INACTIVITY SETTINGS
// =============================================

export async function seedInactivitySettings(leagues: any[], seasons: Season[], adminId: string) {
  logSection("⏰ Seeding inactivity settings...");

  let created = 0;

  // League-specific settings
  for (const league of leagues.slice(0, 5)) {
    const existing = await prisma.inactivitySettings.findFirst({
      where: { leagueId: league.id, seasonId: null },
    });

    if (!existing) {
      await prisma.inactivitySettings.create({
        data: {
          leagueId: league.id,
          inactivityThresholdDays: randomInt(7, 14),
          warningThresholdDays: randomInt(5, 10),
          autoMarkInactive: true,
          excludeFromPairing: randomBoolean(),
          sendReminderEmail: true,
          reminderDaysBefore: randomInt(1, 3),
          updatedByAdminId: adminId,
        },
      });
      created++;
    }
  }

  // Season-specific settings
  const activeSeasons = seasons.filter(s => s.status === SeasonStatus.ACTIVE);
  for (const season of activeSeasons.slice(0, 5)) {
    const existing = await prisma.inactivitySettings.findFirst({
      where: { seasonId: season.id },
    });

    if (!existing) {
      await prisma.inactivitySettings.create({
        data: {
          seasonId: season.id,
          inactivityThresholdDays: 7,
          warningThresholdDays: 5,
          autoMarkInactive: true,
          excludeFromPairing: true,
          sendReminderEmail: true,
          reminderDaysBefore: 1,
          updatedByAdminId: adminId,
        },
      });
      created++;
    }
  }

  logSuccess(`Created ${created} inactivity settings`);
}

// =============================================
// SEED SEASON LOCKS
// =============================================

export async function seedSeasonLocks(seasons: Season[], adminId: string) {
  logSection("🔒 Seeding season locks...");

  const finishedSeasons = seasons.filter(s => s.status === SeasonStatus.FINISHED);
  let created = 0;

  for (const season of finishedSeasons) {
    const existing = await prisma.seasonLock.findUnique({
      where: { seasonId: season.id },
    });

    if (!existing) {
      await prisma.seasonLock.create({
        data: {
          seasonId: season.id,
          isLocked: true,
          lockedByAdminId: adminId,
          finalExportUrl: `https://storage.example.com/exports/season_${season.id}_final.xlsx`,
          exportGeneratedAt: new Date(),
          overrideAllowed: false,
        },
      });
      created++;
    }
  }

  logSuccess(`Created ${created} season locks`);
}

// =============================================
// SEED PAIR REQUESTS
// =============================================

const PAIR_REQUEST_MESSAGES = [
  "Want to team up this season?",
  "Looking for a doubles partner!",
  "Let's play together!",
  "I've seen your matches, great skills!",
  "Interested in partnering up?",
  "Available for doubles this season?",
  null,
  null,
];

export async function seedPairRequests(seasons: Season[], users: User[]): Promise<number> {
  logSection("🤝 Seeding pair requests...");

  const doublesSeasons = await prisma.season.findMany({
    where: {
      id: { in: seasons.map(s => s.id) },
      leagues: { some: { gameType: GameType.DOUBLES } },
      status: { in: [SeasonStatus.ACTIVE, SeasonStatus.FINISHED] },
    },
  });

  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  let created = 0;
  const target = 80;

  // Get existing partnerships to avoid creating requests for already-partnered users
  const partnerships = await prisma.partnership.findMany({
    select: { captainId: true, partnerId: true, seasonId: true },
  });
  const partneredKeys = new Set(
    partnerships.flatMap(p => [
      `${p.captainId}-${p.seasonId}`,
      ...(p.partnerId ? [`${p.partnerId}-${p.seasonId}`] : []),
    ])
  );

  const usedPairs = new Set<string>();

  for (let i = 0; i < target && i < doublesSeasons.length * 20; i++) {
    const season = randomElement(doublesSeasons);
    const requester = randomElement(activeUsers);
    const recipient = randomElement(activeUsers);

    if (requester.id === recipient.id) continue;

    const pairKey = `${requester.id}-${recipient.id}-${season.id}`;
    if (usedPairs.has(pairKey)) continue;
    usedPairs.add(pairKey);

    // Skip if either user is already partnered in this season
    if (partneredKeys.has(`${requester.id}-${season.id}`) || partneredKeys.has(`${recipient.id}-${season.id}`)) continue;

    // Status distribution
    const statusRoll = Math.random() * 100;
    let status: PairRequestStatus;
    if (statusRoll < 40) status = PairRequestStatus.ACCEPTED;
    else if (statusRoll < 60) status = PairRequestStatus.PENDING;
    else if (statusRoll < 75) status = PairRequestStatus.DENIED;
    else if (statusRoll < 85) status = PairRequestStatus.CANCELLED;
    else if (statusRoll < 95) status = PairRequestStatus.EXPIRED;
    else status = PairRequestStatus.AUTO_DENIED;

    const createdAt = randomDate(monthsAgo(8), daysAgo(1));
    const hasResponded = status !== PairRequestStatus.PENDING;

    await prisma.pairRequest.create({
      data: {
        requesterId: requester.id,
        recipientId: recipient.id,
        seasonId: season.id,
        message: randomElement(PAIR_REQUEST_MESSAGES),
        status,
        createdAt,
        respondedAt: hasResponded ? randomDate(createdAt, new Date()) : null,
        expiresAt: status === PairRequestStatus.PENDING
          ? daysFromNow(randomInt(3, 14))
          : new Date(createdAt.getTime() + randomInt(3, 14) * 24 * 60 * 60 * 1000),
      },
    });
    created++;
  }

  logSuccess(`Created ${created} pair requests`);
  return created;
}

// =============================================
// SEED SEASON INVITATIONS
// =============================================

const SEASON_INVITATION_MESSAGES = [
  "Join this season with me!",
  "This league looks great, want to play?",
  "Let's compete together this season!",
  "I'm signing up, you should too!",
  "Great season coming up, join us!",
  null,
  null,
];

export async function seedSeasonInvitations(seasons: Season[], users: User[]): Promise<number> {
  logSection("✉️ Seeding season invitations...");

  const upcomingAndActive = seasons.filter(
    s => s.status === SeasonStatus.UPCOMING || s.status === SeasonStatus.ACTIVE
  );

  if (upcomingAndActive.length === 0) {
    logProgress("   No upcoming/active seasons for invitations, skipping...");
    return 0;
  }

  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  let created = 0;
  const target = 60;
  const usedCombinations = new Set<string>();

  for (let i = 0; i < target * 2 && created < target; i++) {
    const season = randomElement(upcomingAndActive);
    const sender = randomElement(activeUsers);
    const recipient = randomElement(activeUsers);

    if (sender.id === recipient.id) continue;

    // Respect @@unique([senderId, recipientId, seasonId])
    const key = `${sender.id}-${recipient.id}-${season.id}`;
    if (usedCombinations.has(key)) continue;
    usedCombinations.add(key);

    const statusRoll = Math.random() * 100;
    let status: SeasonInvitationStatus;
    if (statusRoll < 35) status = SeasonInvitationStatus.ACCEPTED;
    else if (statusRoll < 60) status = SeasonInvitationStatus.PENDING;
    else if (statusRoll < 80) status = SeasonInvitationStatus.DENIED;
    else if (statusRoll < 90) status = SeasonInvitationStatus.CANCELLED;
    else status = SeasonInvitationStatus.EXPIRED;

    const createdAt = randomDate(monthsAgo(4), daysAgo(1));
    const hasResponded = status !== SeasonInvitationStatus.PENDING;

    try {
      await prisma.seasonInvitation.create({
        data: {
          senderId: sender.id,
          recipientId: recipient.id,
          seasonId: season.id,
          message: randomElement(SEASON_INVITATION_MESSAGES),
          status,
          createdAt,
          respondedAt: hasResponded ? randomDate(createdAt, new Date()) : null,
          expiresAt: status === SeasonInvitationStatus.PENDING
            ? daysFromNow(randomInt(7, 30))
            : new Date(createdAt.getTime() + randomInt(7, 30) * 24 * 60 * 60 * 1000),
        },
      });
      created++;
    } catch {
      // Skip unique constraint violations
    }
  }

  logSuccess(`Created ${created} season invitations`);
  return created;
}

// =============================================
// SEED PAYMENTS
// =============================================

export async function seedPayments(seasons: Season[], users: User[]): Promise<number> {
  logSection("💳 Seeding payments...");

  // Get season memberships that should have payments
  const memberships = await prisma.seasonMembership.findMany({
    where: {
      paymentStatus: { in: [PaymentStatus.COMPLETED, PaymentStatus.PENDING, PaymentStatus.FAILED] },
    },
    include: { season: true },
    take: 300,
  });

  if (memberships.length === 0) {
    logProgress("   No memberships for payments, skipping...");
    return 0;
  }

  let created = 0;
  const fiuuChannels = ["fpx", "card", "ewallet", "online_banking"];

  for (let i = 0; i < memberships.length; i++) {
    const membership = memberships[i]!;
    const entryFee = membership.season?.entryFee ? Number(membership.season.entryFee) : 50 + randomInt(0, 150);

    // Map membership payment status to payment status
    let paymentStatus: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "REFUNDED";
    if (membership.paymentStatus === PaymentStatus.COMPLETED) {
      const roll = Math.random() * 100;
      paymentStatus = roll < 95 ? "COMPLETED" : roll < 98 ? "REFUNDED" : "COMPLETED";
    } else if (membership.paymentStatus === PaymentStatus.PENDING) {
      paymentStatus = "PENDING";
    } else {
      paymentStatus = "FAILED";
    }

    const createdAt = membership.joinedAt || randomDate(monthsAgo(10), daysAgo(1));
    const isCompleted = paymentStatus === "COMPLETED" || paymentStatus === "REFUNDED";

    await prisma.payment.create({
      data: {
        orderId: `ORD-${Date.now()}-${i.toString().padStart(4, "0")}`,
        amount: new Prisma.Decimal(entryFee),
        currency: "MYR",
        paymentMethod: isCompleted ? randomElement(["fpx", "credit_card", "debit_card", "ewallet"]) : null,
        status: paymentStatus,
        paidAt: isCompleted ? randomDate(createdAt, new Date()) : null,
        userId: membership.userId,
        seasonId: membership.seasonId,
        seasonMembershipId: membership.id,
        fiuuTransactionId: isCompleted ? `FIUU-${Date.now()}-${randomInt(10000, 99999)}` : null,
        fiuuChannel: isCompleted ? randomElement(fiuuChannels) : null,
        fiuuStatusCode: isCompleted ? "00" : paymentStatus === "FAILED" ? "11" : null,
        fiuuMessage: isCompleted ? "Payment successful" : paymentStatus === "FAILED" ? "Payment declined" : null,
        notes: paymentStatus === "REFUNDED" ? "Refund processed for withdrawal" : null,
        createdAt,
      },
    });
    created++;

    if (created % 50 === 0) {
      logProgress(`   Payments: ${created}/${memberships.length}`);
    }
  }

  logSuccess(`Created ${created} payments`);
  return created;
}
