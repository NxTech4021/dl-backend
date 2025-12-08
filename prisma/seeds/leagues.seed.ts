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
    { packageTier: TierType.PLATINUM, contractAmount: 50000, sponsoredName: "Wilson Sports" },
    { packageTier: TierType.PLATINUM, contractAmount: 45000, sponsoredName: "Nike Athletics" },
    { packageTier: TierType.GOLD, contractAmount: 25000, sponsoredName: "Adidas Malaysia" },
    { packageTier: TierType.GOLD, contractAmount: 22000, sponsoredName: "Head Rackets" },
    { packageTier: TierType.GOLD, contractAmount: 20000, sponsoredName: "Babolat" },
    { packageTier: TierType.SILVER, contractAmount: 12000, sponsoredName: "Yonex" },
    { packageTier: TierType.SILVER, contractAmount: 10000, sponsoredName: "Prince Sports" },
    { packageTier: TierType.SILVER, contractAmount: 8000, sponsoredName: "Dunlop" },
    { packageTier: TierType.BRONZE, contractAmount: 5000, sponsoredName: "Local Sports Shop" },
    { packageTier: TierType.BRONZE, contractAmount: 4000, sponsoredName: "KL Sports Equipment" },
    { packageTier: TierType.BRONZE, contractAmount: 3500, sponsoredName: "Court Masters" },
    { packageTier: TierType.BRONZE, contractAmount: 3000, sponsoredName: "Racket Pro" },
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

    // 30-50 members per active season, 20-40 for finished
    const memberCount = season.status === SeasonStatus.ACTIVE
      ? randomInt(30, 50)
      : randomInt(20, 40);

    const selectedUsers = activeUsers
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(memberCount, activeUsers.length));

    for (let i = 0; i < selectedUsers.length; i++) {
      const user = selectedUsers[i]!;
      const division = seasonDivisions[i % seasonDivisions.length];

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
      }
    }
  }

  logSuccess(`Created ${memberships.length} season memberships`);
  return memberships;
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
