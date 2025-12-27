/// <reference types="node" />
import {
  Prisma,
  PrismaClient,
  GameType,
  SportType,
  Statuses,
  BugPriority,
  BugSeverity,
  BugStatus,
  BugReportType,
  MatchStatus,
  MatchType,
  MatchFormat,
  ParticipantRole,
  InvitationStatus,
  DisputeCategory,
  DisputeStatus,
  DisputePriority,
  DisputeResolutionAction,
  WalkoverReason,
  PenaltyType,
  PenaltySeverity,
  PenaltyStatus,
  MatchAdminActionType,
  MembershipStatus,
  PaymentStatus,
  SeasonStatus,
  GenderRestriction,
  GenderType,
  DivisionLevel,
  TierType,
  WithdrawalStatus,
  FriendshipStatus,
  PairRequestStatus,
  PartnershipStatus,
  SeasonInvitationStatus,
  NotificationCategory,
  UserStatus,
  AdminStatus,
  RatingChangeReason,
  CancellationReason,
  MessageType,
  Role,
  User,
  Season,
  Division,
  Admin,
  Match,
  TeamChangeRequestStatus,
  // New imports for 100% coverage
  AdminActionType,
  AdminTargetType,
  StatusChangeReason,
  BracketType,
  BracketStatus,
  BracketMatchStatus,
  SeedingSource,
  AdjustmentType,
  RecalculationScope,
  RecalculationStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

// =============================================
// UTILITY FUNCTIONS
// =============================================

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =============================================
// SEED ADMIN USERS
// =============================================

interface SeededAdmin {
  userId: string;
  adminId: string;
}

async function seedAdmins(): Promise<SeededAdmin[]> {
  const { hashPassword } = await import("better-auth/crypto");
  const hashedPassword = await hashPassword("Admin@123");

  const adminData = [
    { name: "Super Admin", email: "superadmin@dleague.com", username: "superadmin", role: Role.SUPERADMIN, status: AdminStatus.ACTIVE },
    { name: "Admin User", email: "admin@dleague.com", username: "admin", role: Role.ADMIN, status: AdminStatus.ACTIVE },
    { name: "Admin Manager", email: "manager@dleague.com", username: "manager", role: Role.ADMIN, status: AdminStatus.ACTIVE },
    { name: "Pending Admin", email: "pending_admin@dleague.com", username: "pending_admin", role: Role.ADMIN, status: AdminStatus.PENDING },
    { name: "Suspended Admin", email: "suspended_admin@dleague.com", username: "suspended_admin", role: Role.ADMIN, status: AdminStatus.SUSPENDED },
  ];

  const createdAdmins: SeededAdmin[] = [];

  for (const admin of adminData) {
    const existingUser = await prisma.user.findUnique({
      where: { email: admin.email },
      include: { admin: true },
    });

    if (existingUser) {
      if (existingUser.admin) {
        createdAdmins.push({ userId: existingUser.id, adminId: existingUser.admin.id });
      }
      continue;
    }

    const user = await prisma.user.create({
      data: {
        name: admin.name,
        email: admin.email,
        username: admin.username,
        role: admin.role,
        emailVerified: true,
        completedOnboarding: true,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    const adminRecord = await prisma.admin.create({
      data: {
        userId: user.id,
        status: admin.status,
      },
    });

    createdAdmins.push({ userId: user.id, adminId: adminRecord.id });
  }

  return createdAdmins;
}

// =============================================
// SEED TEST USERS
// =============================================

async function seedTestUsers(): Promise<User[]> {
  const { hashPassword } = await import("better-auth/crypto");
  const hashedPassword = await hashPassword("Test@123");

  // Malaysian names for more realistic data
  const malaysianFirstNames = {
    male: ["Ahmad", "Mohammad", "Muhammad", "Azman", "Hafiz", "Faizal", "Rizal", "Khairul", "Shahrul", "Amirul", "Hakim", "Irfan", "Nazri", "Syafiq", "Zulkifli", "Danial", "Farhan", "Hafizul", "Iskandar", "Jazlan", "Kumar", "Lim", "Tan", "Wong", "Lee", "Chen", "Ng", "Ong", "Raj", "Siva"],
    female: ["Nurul", "Siti", "Nur", "Aisyah", "Fatimah", "Aminah", "Farah", "Sarah", "Hana", "Nadia", "Zahra", "Iman", "Alya", "Syafiqah", "Amalina", "Balqis", "Camelia", "Dania", "Elina", "Fatin", "May", "Mei", "Ling", "Jia", "Hui", "Priya", "Kavitha", "Lakshmi", "Deepa", "Anitha"],
  };
  const malaysianLastNames = ["Abdullah", "Rahman", "Ibrahim", "Hassan", "Ismail", "Omar", "Ahmad", "Ali", "Yusof", "Aziz", "Hamid", "Karim", "Rashid", "Malik", "Tan", "Lim", "Wong", "Lee", "Chen", "Ng", "Kumar", "Rajan", "Pillai", "Nair", "Menon"];
  const areas = ["Kuala Lumpur", "Petaling Jaya", "Subang Jaya", "Shah Alam", "Bangsar", "Mont Kiara", "Damansara", "Ampang", "Cheras", "Puchong", "Cyberjaya", "Putrajaya"];
  const bios = [
    "Love playing doubles! Looking for partners.",
    "Intermediate player, play for fun.",
    "Advanced player, competitive mindset.",
    "Beginner looking to improve!",
    "Experienced doubles player.",
    "Weekend warrior, love the game!",
    "Competitive player, looking for tournaments.",
    "Doubles specialist, team player.",
    "Improving steadily every week.",
    "Advanced singles and doubles player.",
    "Tennis enthusiast turned pickleball fanatic.",
    "Padel lover from Spain.",
    "New to the game but learning fast!",
    "Competitive spirit runs in my veins!",
    "Weekend player, weekday warrior.",
    "Love the thrill of competition!",
    "All-around player, any game works.",
    "Doubles is life!",
    "Playing for fun and fitness!",
    "Former tennis pro, new to pickleball.",
    "Here for the community and the game.",
    "Looking to improve my ratings!",
    "Serious about the sport, friendly on court.",
    "Ready for any challenge!",
    "Making friends through sports.",
  ];

  const testUsers: Array<{
    name: string;
    email: string;
    username: string;
    bio: string | null;
    area: string | null;
    gender: string | null;
    status: UserStatus;
    completedOnboarding: boolean;
    createdAt?: Date;
  }> = [];

  // Generate 50 active users with complete profiles
  for (let i = 0; i < 50; i++) {
    const isMale = i % 2 === 0;
    const firstName = randomElement(isMale ? malaysianFirstNames.male : malaysianFirstNames.female);
    const lastName = randomElement(malaysianLastNames);
    const name = `${firstName} ${lastName}`;
    const username = `${firstName.toLowerCase()}_${lastName.toLowerCase().slice(0, 3)}${i}`;
    const email = `${username}@test.com`;

    // Vary creation dates for user growth chart
    const daysAgo = randomInt(0, 180); // Users created over last 6 months
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    testUsers.push({
      name,
      email,
      username,
      bio: randomElement(bios),
      area: randomElement(areas),
      gender: isMale ? "MALE" : "FEMALE",
      status: UserStatus.ACTIVE,
      completedOnboarding: true,
      createdAt,
    });
  }

  // Add 10 inactive users
  for (let i = 0; i < 10; i++) {
    const isMale = i % 2 === 0;
    const firstName = randomElement(isMale ? malaysianFirstNames.male : malaysianFirstNames.female);
    const lastName = randomElement(malaysianLastNames);
    testUsers.push({
      name: `${firstName} ${lastName}`,
      email: `inactive${i + 1}@test.com`,
      username: `inactive_${i + 1}`,
      bio: randomElement(["Haven't played in a while.", "Taking a break.", "Will be back soon.", "On hiatus."]),
      area: randomElement(areas),
      gender: isMale ? "MALE" : "FEMALE",
      status: UserStatus.INACTIVE,
      completedOnboarding: true,
      createdAt: new Date(Date.now() - randomInt(90, 180) * 24 * 60 * 60 * 1000),
    });
  }

  // Add 5 suspended users
  for (let i = 0; i < 5; i++) {
    const isMale = i % 2 === 0;
    const firstName = randomElement(isMale ? malaysianFirstNames.male : malaysianFirstNames.female);
    const lastName = randomElement(malaysianLastNames);
    testUsers.push({
      name: `${firstName} ${lastName}`,
      email: `suspended${i + 1}@test.com`,
      username: `suspended_${i + 1}`,
      bio: "Account suspended.",
      area: randomElement(areas),
      gender: isMale ? "MALE" : "FEMALE",
      status: UserStatus.SUSPENDED,
      completedOnboarding: true,
      createdAt: new Date(Date.now() - randomInt(30, 120) * 24 * 60 * 60 * 1000),
    });
  }

  // Add 10 users with incomplete onboarding (new signups)
  for (let i = 0; i < 10; i++) {
    testUsers.push({
      name: `New User ${i + 1}`,
      email: `newuser${i + 1}@test.com`,
      username: `newuser${i + 1}`,
      bio: null,
      area: null,
      gender: null,
      status: UserStatus.ACTIVE,
      completedOnboarding: false,
      createdAt: new Date(Date.now() - randomInt(0, 14) * 24 * 60 * 60 * 1000), // Recent signups
    });
  }

  const createdUsers: User[] = [];

  for (const userData of testUsers) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      createdUsers.push(existingUser);
      continue;
    }

    // Generate a random birth date between 1970 and 2000
    const birthYear = 1970 + randomInt(0, 30);
    const birthMonth = randomInt(0, 11);
    const birthDay = randomInt(1, 28);

    const user = await prisma.user.create({
      data: {
        name: userData.name,
        email: userData.email,
        username: userData.username,
        bio: userData.bio,
        area: userData.area,
        gender: userData.gender,
        status: userData.status,
        completedOnboarding: userData.completedOnboarding,
        role: Role.USER,
        emailVerified: true,
        dateOfBirth: new Date(birthYear, birthMonth, birthDay),
        lastLogin: userData.completedOnboarding ? new Date() : null,
        lastActivityCheck: userData.status === UserStatus.ACTIVE ? new Date() : null,
        createdAt: userData.createdAt || new Date(),
      },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    // Add ratings for completed users
    if (userData.completedOnboarding) {
      const response = await prisma.questionnaireResponse.create({
        data: {
          userId: user.id,
          sport: "PICKLEBALL",
          qVersion: 1,
          qHash: `hash-${user.id}`,
          answersJson: { answers: ["option1", "option2"] },
          completedAt: new Date(),
        },
      });

      const doublesRating = 1200 + Math.floor(Math.random() * 400);
      await prisma.initialRatingResult.create({
        data: {
          responseId: response.id,
          source: "questionnaire",
          doubles: doublesRating,
          singles: doublesRating - 50,
          rd: 150,
          confidence: "MEDIUM",
        },
      });
    }

    createdUsers.push(user);
  }

  return createdUsers;
}

// =============================================
// SEED CATEGORIES
// =============================================

async function seedCategories() {
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
  return createdCategories;
}

// =============================================
// SEED SPONSORSHIPS
// =============================================

async function seedSponsorships(adminId: string) {
  const sponsorships = [
    { packageTier: TierType.PLATINUM, contractAmount: 50000, sponsoredName: "Wilson Sports" },
    { packageTier: TierType.GOLD, contractAmount: 25000, sponsoredName: "Nike Athletics" },
    { packageTier: TierType.SILVER, contractAmount: 10000, sponsoredName: "Adidas" },
    { packageTier: TierType.BRONZE, contractAmount: 5000, sponsoredName: "Local Sports Shop" },
    { packageTier: TierType.GOLD, contractAmount: 20000, sponsoredName: "Head Rackets" },
    { packageTier: TierType.SILVER, contractAmount: 8000, sponsoredName: "Babolat" },
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
  return createdSponsorships;
}

// =============================================
// SEED LEAGUES AND SEASONS
// =============================================

async function seedLeaguesAndSeasons(adminId: string, categories: any[], sponsorships: any[]) {
  const leagues = [
    { name: "Subang Pickleball League", location: "Subang Jaya", sportType: SportType.PICKLEBALL, gameType: GameType.DOUBLES },
    { name: "KL Tennis League", location: "Kuala Lumpur", sportType: SportType.TENNIS, gameType: GameType.SINGLES },
    { name: "PJ Padel League", location: "Petaling Jaya", sportType: SportType.PADEL, gameType: GameType.DOUBLES },
    { name: "Selangor Mixed League", location: "Selangor", sportType: SportType.PICKLEBALL, gameType: GameType.DOUBLES },
    { name: "Penang Tennis Club", location: "Penang", sportType: SportType.TENNIS, gameType: GameType.SINGLES },
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
        },
      });
    }
    createdLeagues.push(league);

    // Create seasons for this league with different statuses
    const seasonStatuses: SeasonStatus[] = [SeasonStatus.ACTIVE, SeasonStatus.UPCOMING, SeasonStatus.FINISHED, SeasonStatus.CANCELLED];

    for (let s = 0; s < 4; s++) {
      const status = seasonStatuses[s]!;
      const seasonName = `${leagueData.name} - Season ${s + 1}`;

      let season = await prisma.season.findFirst({ where: { name: seasonName } });

      if (!season) {
        const startOffset = status === SeasonStatus.FINISHED ? -90 :
                           status === SeasonStatus.ACTIVE ? -30 :
                           status === SeasonStatus.UPCOMING ? 30 : -60;
        const endOffset = status === SeasonStatus.FINISHED ? -1 :
                         status === SeasonStatus.ACTIVE ? 60 :
                         status === SeasonStatus.UPCOMING ? 120 : -30;

        season = await prisma.season.create({
          data: {
            name: seasonName,
            entryFee: new Prisma.Decimal(50 + s * 10),
            status: status,
            isActive: status === SeasonStatus.ACTIVE,
            description: `Season ${s + 1} of ${leagueData.name}`,
            paymentRequired: s % 2 === 0,
            promoCodeSupported: s % 3 === 0,
            withdrawalEnabled: status !== SeasonStatus.FINISHED,
            startDate: new Date(Date.now() + startOffset * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + endOffset * 24 * 60 * 60 * 1000),
            regiDeadline: new Date(Date.now() + (startOffset - 7) * 24 * 60 * 60 * 1000),
            categoryId: categories[i % categories.length]?.id,
            sponsorId: sponsorships[i % sponsorships.length]?.id,
            leagues: { connect: { id: league.id } },
          },
        });
      }

      // Create divisions for active and finished seasons (always check, regardless of season creation)
      if (status === SeasonStatus.ACTIVE || status === SeasonStatus.FINISHED) {
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
                isActiveDivision: status === SeasonStatus.ACTIVE,
                divisionSponsorId: sponsorships[d % sponsorships.length]?.id,
                prizePoolTotal: new Prisma.Decimal(1000 + d * 500),
              },
            });
          }
          createdDivisions.push(division);
        }
      }
      createdSeasons.push(season);
    }
  }

  return { leagues: createdLeagues, seasons: createdSeasons, divisions: createdDivisions };
}

// =============================================
// SEED SEASON MEMBERSHIPS
// =============================================

async function seedSeasonMemberships(users: User[], seasons: Season[], divisions: Division[]) {
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const activeSeasons = seasons.filter(s => s.status === SeasonStatus.ACTIVE || s.status === SeasonStatus.FINISHED);

  const memberships = [];
  const membershipStatuses: MembershipStatus[] = [MembershipStatus.ACTIVE, MembershipStatus.PENDING, MembershipStatus.FLAGGED, MembershipStatus.INACTIVE, MembershipStatus.REMOVED];
  const paymentStatuses: PaymentStatus[] = [PaymentStatus.COMPLETED, PaymentStatus.PENDING, PaymentStatus.FAILED];

  for (const season of activeSeasons) {
    const seasonDivisions = divisions.filter(d => d.seasonId === season.id);

    for (let i = 0; i < Math.min(activeUsers.length, 15); i++) {
      const user = activeUsers[i]!;
      const division = seasonDivisions[i % seasonDivisions.length];

      const existing = await prisma.seasonMembership.findFirst({
        where: { userId: user.id, seasonId: season.id },
      });

      if (existing) {
        memberships.push(existing);
        continue;
      }

      // Most users should be ACTIVE with COMPLETED payment
      const membershipStatus = i < 10 ? MembershipStatus.ACTIVE : membershipStatuses[i % membershipStatuses.length]!;
      const paymentStatus = i < 10 ? PaymentStatus.COMPLETED : paymentStatuses[i % paymentStatuses.length]!;

      const membership = await prisma.seasonMembership.create({
        data: {
          userId: user.id,
          seasonId: season.id,
          divisionId: division?.id,
          status: membershipStatus,
          paymentStatus: paymentStatus,
          joinedAt: randomDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), new Date()),
          withdrawalReason: membershipStatus === MembershipStatus.REMOVED ? "Personal reasons" : null,
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

  return memberships;
}

// =============================================
// SEED MATCHES WITH ALL STATUS VARIATIONS
// =============================================

async function seedMatches(users: User[], divisions: Division[], seasons: Season[], admins: SeededAdmin[]) {
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const activeDivisions = divisions.filter(d => d.isActiveDivision);
  const adminId = admins[0]!.adminId;

  const createdMatches: Match[] = [];

  // Match configurations for different scenarios - significantly increased counts for better chart data
  const matchConfigs = [
    // COMPLETED matches - various outcomes (80 total completed matches spread across 12 weeks)
    { status: MatchStatus.COMPLETED, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 60 },
    { status: MatchStatus.COMPLETED, isWalkover: true, isDisputed: false, isLateCancellation: false, count: 8, walkoverReason: WalkoverReason.NO_SHOW },
    { status: MatchStatus.COMPLETED, isWalkover: true, isDisputed: false, isLateCancellation: false, count: 4, walkoverReason: WalkoverReason.LATE_CANCELLATION },
    { status: MatchStatus.COMPLETED, isWalkover: true, isDisputed: false, isLateCancellation: false, count: 2, walkoverReason: WalkoverReason.INJURY },
    { status: MatchStatus.COMPLETED, isDisputed: true, isWalkover: false, isLateCancellation: false, count: 6 },

    // SCHEDULED matches - future matches
    { status: MatchStatus.SCHEDULED, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 20 },

    // ONGOING matches - currently playing
    { status: MatchStatus.ONGOING, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 5 },

    // DRAFT matches - incomplete setup
    { status: MatchStatus.DRAFT, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 8 },

    // CANCELLED matches - various reasons
    { status: MatchStatus.CANCELLED, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 6, cancellationReason: CancellationReason.WEATHER },
    { status: MatchStatus.CANCELLED, isWalkover: false, isDisputed: false, isLateCancellation: true, count: 4, cancellationReason: CancellationReason.PERSONAL_EMERGENCY },
    { status: MatchStatus.CANCELLED, isWalkover: false, isDisputed: false, isLateCancellation: true, count: 4, cancellationReason: CancellationReason.ILLNESS },

    // VOID matches - admin voided
    { status: MatchStatus.VOID, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 3 },

    // UNFINISHED matches - started but not completed
    { status: MatchStatus.UNFINISHED, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 4 },
  ];

  let matchIndex = 0;

  for (const config of matchConfigs) {
    for (let i = 0; i < config.count; i++) {
      const division = activeDivisions[matchIndex % activeDivisions.length];
      if (!division) continue;

      const season = seasons.find(s => s.id === division.seasonId);
      if (!season) continue;

      // Select players for the match
      const player1Index = (matchIndex * 2) % activeUsers.length;
      const player2Index = (matchIndex * 2 + 1) % activeUsers.length;
      const player1 = activeUsers[player1Index]!;
      const player2 = activeUsers[player2Index]!;

      // Determine match date based on status - spread over 12 weeks (84 days) for better chart data
      let matchDate: Date;
      if (config.status === MatchStatus.COMPLETED || config.status === MatchStatus.VOID || config.status === MatchStatus.UNFINISHED) {
        // Spread completed matches evenly across the last 12 weeks
        matchDate = randomDate(new Date(Date.now() - 84 * 24 * 60 * 60 * 1000), new Date());
      } else if (config.status === MatchStatus.ONGOING) {
        matchDate = new Date();
      } else if (config.status === MatchStatus.SCHEDULED) {
        matchDate = randomDate(new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
      } else {
        matchDate = randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      }

      // Generate scores for completed matches
      let playerScore: number | null = null;
      let opponentScore: number | null = null;
      let setScores: any = null;

      if (config.status === MatchStatus.COMPLETED && !config.isWalkover) {
        playerScore = randomInt(0, 2);
        opponentScore = playerScore === 2 ? randomInt(0, 1) : 2;
        setScores = {
          sets: [
            { player1: randomInt(4, 6), player2: randomInt(2, 6) },
            { player1: randomInt(2, 6), player2: randomInt(4, 6) },
            playerScore + opponentScore === 3 ? { player1: randomInt(4, 7), player2: randomInt(2, 7) } : null,
          ].filter(Boolean),
        };
      } else if (config.isWalkover) {
        playerScore = 2;
        opponentScore = 0;
        setScores = { sets: [{ player1: 6, player2: 0 }, { player1: 6, player2: 0 }] };
      }

      const match = await prisma.match.create({
        data: {
          divisionId: division.id,
          leagueId: division.leagueId,
          seasonId: season.id,
          sport: division.gameType === GameType.SINGLES ? "TENNIS" : "PICKLEBALL",
          matchType: division.gameType === GameType.SINGLES ? MatchType.SINGLES : MatchType.DOUBLES,
          format: MatchFormat.STANDARD,
          status: config.status,
          matchDate: matchDate,
          location: randomElement(["Subang Sports Center", "KL Arena", "PJ Stadium", "Selangor Courts"]),
          venue: `Court ${randomInt(1, 8)}`,

          // Scores
          playerScore: playerScore,
          opponentScore: opponentScore,
          team1Score: division.gameType === GameType.DOUBLES ? playerScore : null,
          team2Score: division.gameType === GameType.DOUBLES ? opponentScore : null,
          setScores: setScores,

          // Flags
          isWalkover: config.isWalkover,
          isDisputed: config.isDisputed,
          isLateCancellation: config.isLateCancellation,
          walkoverReason: config.walkoverReason as WalkoverReason || null,
          cancellationReason: config.cancellationReason as CancellationReason || null,

          // Result tracking for completed matches
          resultSubmittedById: config.status === MatchStatus.COMPLETED ? player1.id : null,
          resultSubmittedAt: config.status === MatchStatus.COMPLETED ? new Date() : null,
          resultConfirmedById: config.status === MatchStatus.COMPLETED ? player2.id : null,
          resultConfirmedAt: config.status === MatchStatus.COMPLETED ? new Date() : null,

          // Cancellation tracking
          cancelledById: config.status === MatchStatus.CANCELLED ? player1.id : null,
          cancelledAt: config.status === MatchStatus.CANCELLED ? new Date() : null,
          cancellationComment: config.status === MatchStatus.CANCELLED ? "Match cancelled due to circumstances" : null,

          // Creator tracking
          createdById: player1.id,

          // Admin notes for special cases
          adminNotes: config.isDisputed ? "Match disputed - requires review" :
                      config.isWalkover ? "Walkover recorded" :
                      config.status === MatchStatus.VOID ? "Match voided by admin" : null,
          requiresAdminReview: config.isDisputed || config.isLateCancellation,
        },
      });

      // Create match participants
      await prisma.matchParticipant.createMany({
        data: [
          {
            matchId: match.id,
            userId: player1.id,
            role: ParticipantRole.CREATOR,
            team: division.gameType === GameType.DOUBLES ? "team1" : null,
            invitationStatus: InvitationStatus.ACCEPTED,
            acceptedAt: new Date(),
            didAttend: config.status === MatchStatus.COMPLETED || config.status === MatchStatus.ONGOING,
          },
          {
            matchId: match.id,
            userId: player2.id,
            role: ParticipantRole.OPPONENT,
            team: division.gameType === GameType.DOUBLES ? "team2" : null,
            invitationStatus: config.status === MatchStatus.DRAFT ? InvitationStatus.PENDING : InvitationStatus.ACCEPTED,
            acceptedAt: config.status !== MatchStatus.DRAFT ? new Date() : null,
            didAttend: config.status === MatchStatus.COMPLETED && !config.isWalkover,
          },
        ],
        skipDuplicates: true,
      });

      // Add partners for doubles matches
      if (division.gameType === GameType.DOUBLES && activeUsers.length > player2Index + 2) {
        const partner1 = activeUsers[(player1Index + activeUsers.length / 2) % activeUsers.length]!;
        const partner2 = activeUsers[(player2Index + activeUsers.length / 2) % activeUsers.length]!;

        await prisma.matchParticipant.createMany({
          data: [
            {
              matchId: match.id,
              userId: partner1.id,
              role: ParticipantRole.PARTNER,
              team: "team1",
              invitationStatus: InvitationStatus.ACCEPTED,
              acceptedAt: new Date(),
              didAttend: config.status === MatchStatus.COMPLETED || config.status === MatchStatus.ONGOING,
            },
            {
              matchId: match.id,
              userId: partner2.id,
              role: ParticipantRole.PARTNER,
              team: "team2",
              invitationStatus: config.status === MatchStatus.DRAFT ? InvitationStatus.PENDING : InvitationStatus.ACCEPTED,
              acceptedAt: config.status !== MatchStatus.DRAFT ? new Date() : null,
              didAttend: config.status === MatchStatus.COMPLETED && !config.isWalkover,
            },
          ],
          skipDuplicates: true,
        });
      }

      // Create match scores for completed non-walkover matches
      if (config.status === MatchStatus.COMPLETED && !config.isWalkover && setScores) {
        for (let setNum = 0; setNum < setScores.sets.length; setNum++) {
          const set = setScores.sets[setNum];
          await prisma.matchScore.create({
            data: {
              matchId: match.id,
              setNumber: setNum + 1,
              player1Games: set.player1,
              player2Games: set.player2,
              hasTiebreak: set.player1 === 7 || set.player2 === 7,
              player1Tiebreak: set.player1 === 7 ? randomInt(7, 10) : null,
              player2Tiebreak: set.player2 === 7 ? randomInt(7, 10) : null,
            },
          });
        }
      }

      createdMatches.push(match);
      matchIndex++;
    }
  }

  return createdMatches;
}

// =============================================
// SEED DISPUTES
// =============================================

async function seedDisputes(matches: Match[], users: User[], admins: SeededAdmin[]) {
  const disputedMatches = matches.filter(m => m.isDisputed);
  const adminId = admins[0]!.adminId;

  const disputeCategories = [DisputeCategory.WRONG_SCORE, DisputeCategory.NO_SHOW, DisputeCategory.BEHAVIOR, DisputeCategory.OTHER];
  const disputeStatuses = [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW, DisputeStatus.RESOLVED, DisputeStatus.REJECTED];
  const disputePriorities = [DisputePriority.LOW, DisputePriority.NORMAL, DisputePriority.HIGH, DisputePriority.URGENT];

  const createdDisputes = [];

  for (let i = 0; i < disputedMatches.length; i++) {
    const match = disputedMatches[i]!;
    const participants = await prisma.matchParticipant.findMany({ where: { matchId: match.id } });
    const raiser = participants[0];
    if (!raiser) continue;

    const status = disputeStatuses[i % disputeStatuses.length]!;
    const category = disputeCategories[i % disputeCategories.length]!;

    const dispute = await prisma.matchDispute.create({
      data: {
        matchId: match.id,
        raisedByUserId: raiser.userId,
        disputeCategory: category,
        disputeComment: `Dispute raised regarding ${category.toLowerCase().replace('_', ' ')}`,
        disputerScore: { player1: 6, player2: 4, set: 1 },
        evidenceUrl: i % 2 === 0 ? "https://example.com/evidence.jpg" : null,
        status: status,
        priority: disputePriorities[i % disputePriorities.length],
        flaggedForReview: status === DisputeStatus.OPEN,
        reviewedByAdminId: status !== DisputeStatus.OPEN ? adminId : null,
        resolvedByAdminId: status === DisputeStatus.RESOLVED || status === DisputeStatus.REJECTED ? adminId : null,
        adminResolution: status === DisputeStatus.RESOLVED ? "After reviewing evidence, the original score stands" :
                        status === DisputeStatus.REJECTED ? "Insufficient evidence to support claim" : null,
        resolutionAction: status === DisputeStatus.RESOLVED ? DisputeResolutionAction.UPHOLD_ORIGINAL :
                         status === DisputeStatus.REJECTED ? DisputeResolutionAction.UPHOLD_ORIGINAL : null,
        resolvedAt: status === DisputeStatus.RESOLVED || status === DisputeStatus.REJECTED ? new Date() : null,
      },
    });

    // Add admin notes
    if (status !== DisputeStatus.OPEN) {
      await prisma.disputeAdminNote.create({
        data: {
          disputeId: dispute.id,
          adminId: adminId,
          note: "Reviewed evidence and player statements",
          isInternalOnly: true,
        },
      });
    }

    // Add dispute comments
    await prisma.disputeComment.create({
      data: {
        disputeId: dispute.id,
        senderId: raiser.userId,
        comment: "I believe the score was recorded incorrectly",
      },
    });

    createdDisputes.push(dispute);
  }

  return createdDisputes;
}

// =============================================
// SEED WALKOVERS
// =============================================

async function seedWalkovers(matches: Match[], users: User[], admins: SeededAdmin[]) {
  const walkoverMatches = matches.filter(m => m.isWalkover);
  const adminId = admins[0]!.adminId;

  const createdWalkovers = [];

  for (const match of walkoverMatches) {
    const participants = await prisma.matchParticipant.findMany({ where: { matchId: match.id } });
    if (participants.length < 2) continue;

    const defaultingPlayer = participants.find(p => p.role === ParticipantRole.OPPONENT);
    const winningPlayer = participants.find(p => p.role === ParticipantRole.CREATOR);
    if (!defaultingPlayer || !winningPlayer) continue;

    const existing = await prisma.matchWalkover.findUnique({ where: { matchId: match.id } });
    if (existing) {
      createdWalkovers.push(existing);
      continue;
    }

    const walkover = await prisma.matchWalkover.create({
      data: {
        matchId: match.id,
        walkoverReason: match.walkoverReason || WalkoverReason.NO_SHOW,
        walkoverReasonDetail: `Player did not ${match.walkoverReason === WalkoverReason.LATE_CANCELLATION ? 'provide adequate notice' : 'show up for the match'}`,
        defaultingPlayerId: defaultingPlayer.userId,
        winningPlayerId: winningPlayer.userId,
        reportedBy: winningPlayer.userId,
        confirmedBy: defaultingPlayer.userId,
        adminVerified: true,
        adminVerifiedBy: adminId,
        adminVerifiedAt: new Date(),
        penaltyApplied: match.walkoverReason === WalkoverReason.NO_SHOW,
        penaltyType: match.walkoverReason === WalkoverReason.NO_SHOW ? PenaltyType.POINTS_DEDUCTION : PenaltyType.WARNING,
        penaltyDetails: match.walkoverReason === WalkoverReason.NO_SHOW ? "-5 points deducted" : "Warning issued",
      },
    });

    createdWalkovers.push(walkover);
  }

  return createdWalkovers;
}

// =============================================
// SEED PENALTIES
// =============================================

async function seedPenalties(users: User[], matches: Match[], admins: SeededAdmin[]) {
  const adminId = admins[0]!.adminId;
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE).slice(0, 5);

  const penaltyConfigs = [
    { type: PenaltyType.WARNING, severity: PenaltySeverity.WARNING, status: PenaltyStatus.ACTIVE },
    { type: PenaltyType.POINTS_DEDUCTION, severity: PenaltySeverity.POINTS_DEDUCTION, status: PenaltyStatus.ACTIVE, points: 5 },
    { type: PenaltyType.SUSPENSION, severity: PenaltySeverity.SUSPENSION, status: PenaltyStatus.ACTIVE, suspensionDays: 7 },
    { type: PenaltyType.WARNING, severity: PenaltySeverity.WARNING, status: PenaltyStatus.EXPIRED },
    { type: PenaltyType.POINTS_DEDUCTION, severity: PenaltySeverity.POINTS_DEDUCTION, status: PenaltyStatus.APPEALED, points: 3 },
    { type: PenaltyType.WARNING, severity: PenaltySeverity.WARNING, status: PenaltyStatus.OVERTURNED },
  ];

  const createdPenalties = [];

  for (let i = 0; i < Math.min(activeUsers.length, penaltyConfigs.length); i++) {
    const user = activeUsers[i]!;
    const config = penaltyConfigs[i]!;
    const relatedMatch = matches[i % matches.length];

    const penalty = await prisma.playerPenalty.create({
      data: {
        userId: user.id,
        penaltyType: config.type,
        severity: config.severity,
        status: config.status,
        relatedMatchId: relatedMatch?.id,
        pointsDeducted: config.points || null,
        suspensionDays: config.suspensionDays || null,
        suspensionStartDate: config.suspensionDays ? new Date() : null,
        suspensionEndDate: config.suspensionDays ? new Date(Date.now() + config.suspensionDays * 24 * 60 * 60 * 1000) : null,
        issuedByAdminId: adminId,
        reason: `Penalty issued for ${config.type.toLowerCase().replace('_', ' ')}`,
        expiresAt: config.status === PenaltyStatus.EXPIRED ? new Date(Date.now() - 24 * 60 * 60 * 1000) :
                  config.type === PenaltyType.WARNING ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
        appealSubmittedAt: config.status === PenaltyStatus.APPEALED ? new Date() : null,
        appealReason: config.status === PenaltyStatus.APPEALED ? "I believe this penalty was unfairly applied" : null,
        appealResolvedBy: config.status === PenaltyStatus.OVERTURNED ? adminId : null,
        appealResolvedAt: config.status === PenaltyStatus.OVERTURNED ? new Date() : null,
        appealResolutionNotes: config.status === PenaltyStatus.OVERTURNED ? "Appeal upheld - insufficient evidence" : null,
      },
    });

    createdPenalties.push(penalty);
  }

  return createdPenalties;
}

// =============================================
// SEED ADMIN ACTIONS
// =============================================

async function seedAdminActions(matches: Match[], admins: SeededAdmin[]) {
  const adminId = admins[0]!.adminId;
  const actionTypes = [
    MatchAdminActionType.EDIT_RESULT,
    MatchAdminActionType.VOID_MATCH,
    MatchAdminActionType.CONVERT_TO_WALKOVER,
    MatchAdminActionType.APPLY_PENALTY,
    MatchAdminActionType.EDIT_SCHEDULE,
  ];

  const createdActions = [];

  for (let i = 0; i < Math.min(10, matches.length); i++) {
    const match = matches[i]!;
    const actionType = actionTypes[i % actionTypes.length]!;

    const action = await prisma.matchAdminAction.create({
      data: {
        matchId: match.id,
        adminId: adminId,
        actionType: actionType,
        oldValue: { status: "SCHEDULED", score: null },
        newValue: { status: match.status, score: { player1: match.playerScore, player2: match.opponentScore } },
        reason: `Admin action: ${actionType.toLowerCase().replace(/_/g, ' ')}`,
        triggeredRecalculation: actionType === MatchAdminActionType.EDIT_RESULT,
        ipAddress: "192.168.1.1",
      },
    });

    createdActions.push(action);
  }

  return createdActions;
}

// =============================================
// SEED WITHDRAWAL REQUESTS
// =============================================

async function seedWithdrawalRequests(users: User[], seasons: Season[]) {
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE).slice(10, 15);
  const activeSeasons = seasons.filter(s => s.status === SeasonStatus.ACTIVE);

  const withdrawalStatuses = [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED, WithdrawalStatus.REJECTED];
  const createdRequests = [];

  for (let i = 0; i < Math.min(activeUsers.length, activeSeasons.length); i++) {
    const user = activeUsers[i]!;
    const season = activeSeasons[i % activeSeasons.length]!;
    const status = withdrawalStatuses[i % withdrawalStatuses.length]!;

    const request = await prisma.withdrawalRequest.create({
      data: {
        userId: user.id,
        seasonId: season.id,
        reason: randomElement(["Personal reasons", "Injury", "Relocation", "Work commitments", "Family emergency"]),
        status: status,
        processedByAdminId: status !== WithdrawalStatus.PENDING ? activeUsers[0]!.id : null,
      },
    });

    createdRequests.push(request);
  }

  return createdRequests;
}

// =============================================
// SEED CHAT THREADS AND MESSAGES
// =============================================

async function seedChatData(users: User[], divisions: Division[]) {
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const createdThreads = [];
  const createdMessages = [];

  // Create division threads
  for (const division of divisions.slice(0, 3)) {
    const existing = await prisma.thread.findFirst({ where: { divisionId: division.id } });
    if (existing) {
      createdThreads.push(existing);
      continue;
    }

    const thread = await prisma.thread.create({
      data: {
        name: `${division.name} Chat`,
        isGroup: true,
        divisionId: division.id,
      },
    });

    // Add members to the thread
    for (let i = 0; i < Math.min(5, activeUsers.length); i++) {
      await prisma.userThread.create({
        data: {
          threadId: thread.id,
          userId: activeUsers[i]!.id,
          unreadCount: randomInt(0, 5),
        },
      });
    }

    // Add messages
    for (let m = 0; m < 10; m++) {
      const sender = activeUsers[m % activeUsers.length]!;
      const message = await prisma.message.create({
        data: {
          threadId: thread.id,
          senderId: sender.id,
          content: randomElement([
            "Anyone free for a match this weekend?",
            "Great game today!",
            "Looking for a doubles partner",
            "What time works for everyone?",
            "See you at the courts!",
            "Nice rally earlier!",
            "Who's up for practice?",
            "Check out the updated schedule",
          ]),
          messageType: MessageType.TEXT,
          createdAt: randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()),
        },
      });
      createdMessages.push(message);
    }

    createdThreads.push(thread);
  }

  // Create direct message threads
  for (let i = 0; i < 5; i++) {
    const user1 = activeUsers[i * 2]!;
    const user2 = activeUsers[i * 2 + 1]!;

    const thread = await prisma.thread.create({
      data: {
        isGroup: false,
      },
    });

    await prisma.userThread.createMany({
      data: [
        { threadId: thread.id, userId: user1.id, unreadCount: randomInt(0, 3) },
        { threadId: thread.id, userId: user2.id, unreadCount: randomInt(0, 3) },
      ],
    });

    // Add messages
    for (let m = 0; m < 5; m++) {
      const sender = m % 2 === 0 ? user1 : user2;
      await prisma.message.create({
        data: {
          threadId: thread.id,
          senderId: sender.id,
          content: randomElement([
            "Hey, want to play this week?",
            "Sure, what day works for you?",
            "How about Saturday afternoon?",
            "Perfect, see you then!",
            "Great match today!",
          ]),
          messageType: MessageType.TEXT,
          createdAt: randomDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), new Date()),
        },
      });
    }

    createdThreads.push(thread);
  }

  return { threads: createdThreads, messages: createdMessages };
}

// =============================================
// SEED NOTIFICATIONS
// =============================================

async function seedNotifications(users: User[], matches: Match[], seasons: Season[]) {
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE);
  const notificationTypes = [
    { category: NotificationCategory.MATCH, type: "MATCH_SCHEDULED", title: "Match Scheduled", message: "Your match has been scheduled" },
    { category: NotificationCategory.MATCH, type: "MATCH_REMINDER", title: "Match Reminder", message: "Your match starts in 24 hours" },
    { category: NotificationCategory.MATCH, type: "MATCH_COMPLETED", title: "Match Completed", message: "Your match result has been recorded" },
    { category: NotificationCategory.SEASON, type: "SEASON_STARTING", title: "Season Starting", message: "The season starts next week!" },
    { category: NotificationCategory.DIVISION, type: "DIVISION_UPDATE", title: "Division Update", message: "Your division standings have been updated" },
    { category: NotificationCategory.CHAT, type: "NEW_MESSAGE", title: "New Message", message: "You have a new message" },
    { category: NotificationCategory.ADMIN, type: "ADMIN_NOTICE", title: "Admin Notice", message: "Important announcement from admin" },
    { category: NotificationCategory.PAYMENT, type: "PAYMENT_RECEIVED", title: "Payment Received", message: "Your payment has been processed" },
  ];

  const createdNotifications = [];

  for (let i = 0; i < 50; i++) {
    const user = activeUsers[i % activeUsers.length]!;
    const notifType = notificationTypes[i % notificationTypes.length]!;
    const match = matches[i % matches.length];
    const season = seasons[i % seasons.length];

    const notification = await prisma.notification.create({
      data: {
        title: notifType.title,
        message: notifType.message,
        category: notifType.category,
        type: notifType.type,
        userId: user.id,
        matchId: notifType.category === NotificationCategory.MATCH ? match?.id : null,
        seasonId: notifType.category === NotificationCategory.SEASON ? season?.id : null,
        createdAt: randomDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), new Date()),
      },
    });

    // Create user notification record
    await prisma.userNotification.create({
      data: {
        userId: user.id,
        notificationId: notification.id,
        read: i % 3 === 0, // 1/3 are read
        readAt: i % 3 === 0 ? new Date() : null,
        archive: i % 10 === 0, // 1/10 are archived
      },
    });

    createdNotifications.push(notification);
  }

  return createdNotifications;
}

// =============================================
// SEED FRIENDSHIPS AND PAIR REQUESTS
// =============================================

async function seedSocialData(users: User[], seasons: Season[]) {
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const activeSeasons = seasons.filter(s => s.status === SeasonStatus.ACTIVE);

  // Create friendships
  const friendshipStatuses = [FriendshipStatus.PENDING, FriendshipStatus.ACCEPTED, FriendshipStatus.REJECTED, FriendshipStatus.BLOCKED];

  for (let i = 0; i < Math.min(20, activeUsers.length - 1); i++) {
    const requester = activeUsers[i]!;
    const recipient = activeUsers[(i + 1) % activeUsers.length]!;
    const status = friendshipStatuses[i % friendshipStatuses.length]!;

    const existing = await prisma.friendship.findFirst({
      where: { requesterId: requester.id, recipientId: recipient.id },
    });

    if (!existing) {
      await prisma.friendship.create({
        data: {
          requesterId: requester.id,
          recipientId: recipient.id,
          status: status,
          respondedAt: status !== FriendshipStatus.PENDING ? new Date() : null,
        },
      });
    }
  }

  // Create pair requests
  const pairStatuses = [PairRequestStatus.PENDING, PairRequestStatus.ACCEPTED, PairRequestStatus.DENIED, PairRequestStatus.EXPIRED];

  for (let i = 0; i < Math.min(10, activeUsers.length - 1, activeSeasons.length); i++) {
    const requester = activeUsers[i * 2]!;
    const recipient = activeUsers[i * 2 + 1]!;
    const season = activeSeasons[i % activeSeasons.length]!;
    const status = pairStatuses[i % pairStatuses.length]!;

    const existing = await prisma.pairRequest.findFirst({
      where: { requesterId: requester.id, recipientId: recipient.id, seasonId: season.id },
    });

    if (!existing) {
      await prisma.pairRequest.create({
        data: {
          requesterId: requester.id,
          recipientId: recipient.id,
          seasonId: season.id,
          message: "Would you like to be my partner this season?",
          status: status,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          respondedAt: status !== PairRequestStatus.PENDING ? new Date() : null,
        },
      });
    }
  }

  // Create partnerships from accepted pair requests
  for (let i = 0; i < Math.min(5, activeUsers.length - 1, activeSeasons.length); i++) {
    const captain = activeUsers[i * 2]!;
    const partner = activeUsers[i * 2 + 1]!;
    const season = activeSeasons[i % activeSeasons.length]!;

    const existing = await prisma.partnership.findFirst({
      where: { captainId: captain.id, partnerId: partner.id, seasonId: season.id },
    });

    if (!existing) {
      await prisma.partnership.create({
        data: {
          captainId: captain.id,
          partnerId: partner.id,
          seasonId: season.id,
          pairRating: 1400 + randomInt(-200, 200),
          status: PartnershipStatus.ACTIVE,
        },
      });
    }
  }

  // Create favorites
  for (let i = 0; i < Math.min(15, activeUsers.length - 1); i++) {
    const user = activeUsers[i]!;
    const favorited = activeUsers[(i + 5) % activeUsers.length]!;

    const existing = await prisma.favorite.findFirst({
      where: { userId: user.id, favoritedId: favorited.id },
    });

    if (!existing) {
      await prisma.favorite.create({
        data: {
          userId: user.id,
          favoritedId: favorited.id,
        },
      });
    }
  }
}

// =============================================
// SEED PLAYER RATINGS AND STANDINGS
// =============================================

async function seedRatingsAndStandings(users: User[], seasons: Season[], divisions: Division[], admins: SeededAdmin[]) {
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const activeSeasons = seasons.filter(s => s.status === SeasonStatus.ACTIVE || s.status === SeasonStatus.FINISHED);
  const adminId = admins[0]!.adminId;

  // Create player ratings
  for (const season of activeSeasons) {
    const seasonDivisions = divisions.filter(d => d.seasonId === season.id);

    for (let i = 0; i < Math.min(10, activeUsers.length); i++) {
      const user = activeUsers[i]!;
      const division = seasonDivisions[i % seasonDivisions.length];

      const existingRating = await prisma.playerRating.findFirst({
        where: { userId: user.id, seasonId: season.id },
      });

      if (!existingRating) {
        const rating = await prisma.playerRating.create({
          data: {
            userId: user.id,
            seasonId: season.id,
            divisionId: division?.id,
            sport: SportType.PICKLEBALL,
            gameType: division?.gameType || GameType.DOUBLES,
            currentRating: 1400 + randomInt(-200, 300),
            ratingDeviation: 150 - randomInt(0, 50),
            volatility: 0.06,
            isProvisional: i > 5,
            matchesPlayed: randomInt(0, 15),
            peakRating: 1500 + randomInt(0, 200),
            peakRatingDate: new Date(),
            lowestRating: 1300 + randomInt(0, 100),
          },
        });

        // Create rating history
        for (let h = 0; h < 5; h++) {
          await prisma.ratingHistory.create({
            data: {
              playerRatingId: rating.id,
              ratingBefore: rating.currentRating - randomInt(-20, 20),
              ratingAfter: rating.currentRating,
              delta: randomInt(-15, 25),
              rdBefore: 160,
              rdAfter: 150,
              reason: randomElement([RatingChangeReason.MATCH_WIN, RatingChangeReason.MATCH_LOSS, RatingChangeReason.WALKOVER_WIN]),
              notes: "Rating updated after match",
            },
          });
        }
      }
    }

    // Create division standings
    for (const division of seasonDivisions) {
      for (let i = 0; i < Math.min(8, activeUsers.length); i++) {
        const user = activeUsers[i]!;

        const existingStanding = await prisma.divisionStanding.findFirst({
          where: { divisionId: division.id, seasonId: season.id, userId: user.id },
        });

        if (!existingStanding) {
          const wins = randomInt(0, 6);
          const losses = randomInt(0, 6 - wins);
          const matchesPlayed = wins + losses;

          await prisma.divisionStanding.create({
            data: {
              divisionId: division.id,
              seasonId: season.id,
              userId: user.id,
              rank: i + 1,
              wins: wins,
              losses: losses,
              matchesPlayed: matchesPlayed,
              matchesScheduled: 9,
              totalPoints: wins * 3 + matchesPlayed, // 3 points per win + 1 for playing
              countedWins: Math.min(wins, 6),
              countedLosses: Math.min(losses, 6 - Math.min(wins, 6)),
              setsWon: wins * 2 + randomInt(0, losses),
              setsLost: losses * 2 + randomInt(0, wins),
              gamesWon: (wins * 2 + randomInt(0, losses)) * 6 + randomInt(0, 20),
              gamesLost: (losses * 2 + randomInt(0, wins)) * 6 + randomInt(0, 20),
              best6SetsWon: Math.min(wins, 6) * 2,
              best6SetsTotal: Math.min(matchesPlayed, 6) * 2,
              best6GamesWon: Math.min(wins, 6) * 12,
              best6GamesTotal: Math.min(matchesPlayed, 6) * 12,
              headToHead: {},
              isLocked: season.status === SeasonStatus.FINISHED,
            },
          });
        }
      }
    }
  }

  // Create rating parameters
  const existingParams = await prisma.ratingParameters.findFirst({ where: { isActive: true } });
  if (!existingParams) {
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
        effectiveFrom: new Date(),
        isActive: true,
        createdByAdminId: adminId,
        notes: "Default rating parameters",
      },
    });
  }
}

// =============================================
// SEED ACHIEVEMENTS
// =============================================

async function seedAchievements(users: User[]) {
  const achievements = [
    { title: "First Match", description: "Complete your first match", category: "Beginner", points: 10 },
    { title: "5 Matches", description: "Complete 5 matches", category: "Beginner", points: 25 },
    { title: "10 Matches", description: "Complete 10 matches", category: "Intermediate", points: 50 },
    { title: "25 Matches", description: "Complete 25 matches", category: "Advanced", points: 100 },
    { title: "First Win", description: "Win your first match", category: "Beginner", points: 15 },
    { title: "5 Wins", description: "Win 5 matches", category: "Intermediate", points: 30 },
    { title: "Win Streak 3", description: "Win 3 matches in a row", category: "Intermediate", points: 40 },
    { title: "Win Streak 5", description: "Win 5 matches in a row", category: "Advanced", points: 75 },
    { title: "First League", description: "Complete your first league season", category: "Beginner", points: 50 },
    { title: "Division Champion", description: "Finish 1st in your division", category: "Champion", points: 200 },
    { title: "Top 3 Finish", description: "Finish in top 3 of your division", category: "Advanced", points: 100 },
    { title: "Perfect Attendance", description: "Play all 9 scheduled matches in a season", category: "Dedication", points: 75 },
  ];

  const createdAchievements = [];
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);

  for (const ach of achievements) {
    let achievement = await prisma.achievement.findFirst({ where: { title: ach.title } });

    if (!achievement) {
      achievement = await prisma.achievement.create({
        data: {
          title: ach.title,
          description: ach.description,
          category: ach.category,
          points: ach.points,
          isActive: true,
        },
      });
    }

    createdAchievements.push(achievement);

    // Award some achievements to users
    const usersToAward = activeUsers.slice(0, randomInt(3, 8));
    for (const user of usersToAward) {
      const existing = await prisma.userAchievement.findFirst({
        where: { userId: user.id, achievementId: achievement.id },
      });

      if (!existing) {
        await prisma.userAchievement.create({
          data: {
            userId: user.id,
            achievementId: achievement.id,
            unlockedAt: randomDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), new Date()),
            isCompleted: true,
          },
        });
      }
    }
  }

  return createdAchievements;
}

// =============================================
// SEED PROMO CODES
// =============================================

async function seedPromoCodes(seasons: Season[]) {
  const promoCodes = [
    { code: "WELCOME10", description: "Welcome discount - 10%", discountValue: 10, isPercentage: true },
    { code: "EARLYBIRD", description: "Early bird discount - RM20", discountValue: 20, isPercentage: false },
    { code: "SUMMER2024", description: "Summer promotion - 15%", discountValue: 15, isPercentage: true },
    { code: "REFERRAL5", description: "Referral discount - RM5", discountValue: 5, isPercentage: false },
    { code: "VIP25", description: "VIP member discount - 25%", discountValue: 25, isPercentage: true },
    { code: "EXPIRED2023", description: "Expired code", discountValue: 10, isPercentage: true, isActive: false },
  ];

  const activeSeasons = seasons.filter(s => s.promoCodeSupported);

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
          expiresAt: promo.isActive !== false ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          seasons: {
            connect: activeSeasons.slice(0, 2).map(s => ({ id: s.id })),
          },
        },
      });
    }
  }
}

// =============================================
// SEED INACTIVITY SETTINGS
// =============================================

async function seedInactivitySettings(leagues: any[], seasons: Season[], admins: SeededAdmin[]) {
  const adminId = admins[0]!.adminId;

  // Create global default settings
  const existingGlobal = await prisma.inactivitySettings.findFirst({
    where: { leagueId: null, seasonId: null },
  });

  if (!existingGlobal) {
    await prisma.inactivitySettings.create({
      data: {
        leagueId: null,
        seasonId: null,
        inactivityThresholdDays: 14,
        warningThresholdDays: 10,
        autoMarkInactive: true,
        excludeFromPairing: false,
        sendReminderEmail: true,
        reminderDaysBefore: 3,
        updatedByAdminId: adminId,
      },
    });
  }

  // Create league-specific settings
  for (const league of leagues.slice(0, 2)) {
    const existing = await prisma.inactivitySettings.findFirst({
      where: { leagueId: league.id, seasonId: null },
    });

    if (!existing) {
      await prisma.inactivitySettings.create({
        data: {
          leagueId: league.id,
          seasonId: null,
          inactivityThresholdDays: 10, // Stricter for leagues
          warningThresholdDays: 7,
          autoMarkInactive: true,
          excludeFromPairing: true,
          sendReminderEmail: true,
          reminderDaysBefore: 2,
          updatedByAdminId: adminId,
        },
      });
    }
  }

  // Create season-specific settings
  const activeSeasons = seasons.filter(s => s.status === SeasonStatus.ACTIVE);
  for (const season of activeSeasons.slice(0, 2)) {
    const existing = await prisma.inactivitySettings.findFirst({
      where: { seasonId: season.id },
    });

    if (!existing) {
      await prisma.inactivitySettings.create({
        data: {
          leagueId: null,
          seasonId: season.id,
          inactivityThresholdDays: 7, // Very strict for active seasons
          warningThresholdDays: 5,
          autoMarkInactive: true,
          excludeFromPairing: true,
          sendReminderEmail: true,
          reminderDaysBefore: 1,
          updatedByAdminId: adminId,
        },
      });
    }
  }
}

// =============================================
// SEED SEASON INVITATIONS
// =============================================

async function seedSeasonInvitations(users: User[], seasons: Season[]) {
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const activeSeasons = seasons.filter(s => s.status === SeasonStatus.ACTIVE || s.status === SeasonStatus.UPCOMING);

  if (activeUsers.length < 2) {
    console.log("   ⚠️ Not enough active users to create invitations");
    return [];
  }

  const invitationStatuses: SeasonInvitationStatus[] = [
    SeasonInvitationStatus.PENDING,
    SeasonInvitationStatus.ACCEPTED,
    SeasonInvitationStatus.DENIED,
    SeasonInvitationStatus.EXPIRED,
  ];

  const createdInvitations = [];

  for (const season of activeSeasons) {
    // Create 10-15 invitations per season
    const inviteCount = Math.min(randomInt(10, 15), Math.floor(activeUsers.length / 2));

    for (let i = 0; i < inviteCount; i++) {
      // Pick a sender and recipient (different users)
      const senderIndex = (i * 2) % activeUsers.length;
      const recipientIndex = (i * 2 + 1) % activeUsers.length;
      const sender = activeUsers[senderIndex]!;
      const recipient = activeUsers[recipientIndex]!;
      const status = invitationStatuses[i % invitationStatuses.length]!;

      const existing = await prisma.seasonInvitation.findFirst({
        where: { senderId: sender.id, recipientId: recipient.id, seasonId: season.id },
      });

      if (!existing) {
        const invitation = await prisma.seasonInvitation.create({
          data: {
            senderId: sender.id,
            recipientId: recipient.id,
            seasonId: season.id,
            status: status,
            message: randomElement([
              "We'd love to have you join this season!",
              "Based on your skill level, this division would be perfect for you.",
              "Join us for an exciting season of competitive play!",
              "You've been recommended for this league!",
              null,
            ]),
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            respondedAt: status !== SeasonInvitationStatus.PENDING ? new Date() : null,
          },
        });
        createdInvitations.push(invitation);
      }
    }
  }

  return createdInvitations;
}

// =============================================
// SEED FRIENDLY MATCHES (Non-league matches)
// =============================================

async function seedFriendlyMatches(users: User[], leagues: any[]) {
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const createdMatches: Match[] = [];

  // Create 30 friendly matches spread across sports
  for (let i = 0; i < 30; i++) {
    const player1Index = (i * 2) % activeUsers.length;
    const player2Index = (i * 2 + 1) % activeUsers.length;
    const player1 = activeUsers[player1Index]!;
    const player2 = activeUsers[player2Index]!;

    const league = leagues[i % leagues.length];
    const isCompleted = i < 20; // 20 completed, 10 scheduled
    const matchDate = isCompleted
      ? randomDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), new Date())
      : randomDate(new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

    const match = await prisma.match.create({
      data: {
        divisionId: null, // No division = friendly match
        leagueId: league?.id || null,
        seasonId: null,
        sport: randomElement(["TENNIS", "PICKLEBALL", "PADEL"]),
        matchType: randomElement([MatchType.SINGLES, MatchType.DOUBLES]),
        format: MatchFormat.STANDARD,
        status: isCompleted ? MatchStatus.COMPLETED : MatchStatus.SCHEDULED,
        matchDate: matchDate,
        location: randomElement(["Community Courts", "Private Club", "Public Park", "Sports Center"]),
        venue: `Court ${randomInt(1, 6)}`,
        playerScore: isCompleted ? randomInt(0, 2) : null,
        opponentScore: isCompleted ? randomInt(0, 2) : null,
        createdById: player1.id,
        createdAt: randomDate(new Date(Date.now() - 84 * 24 * 60 * 60 * 1000), matchDate),
      },
    });

    // Add participants
    await prisma.matchParticipant.createMany({
      data: [
        {
          matchId: match.id,
          userId: player1.id,
          role: ParticipantRole.CREATOR,
          invitationStatus: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
        {
          matchId: match.id,
          userId: player2.id,
          role: ParticipantRole.OPPONENT,
          invitationStatus: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      ],
      skipDuplicates: true,
    });

    createdMatches.push(match);
  }

  return createdMatches;
}

// =============================================
// SEED BUG TRACKING APPS
// =============================================

async function seedBugTrackingApps(adminId: string) {
  const existingApp = await prisma.app.findUnique({
    where: { code: "DLA" },
    include: { bugSettings: true },
  });

  if (existingApp) {
    console.log("   Bug tracking apps already exist, skipping seed...");
    return existingApp;
  }

  // Create DeuceLeague Admin app
  const dlaApp = await prisma.app.create({
    data: {
      code: "DLA",
      name: "deuceleague-admin",
      displayName: "DeuceLeague Admin",
      description: "Admin dashboard for managing DeuceLeague",
      appUrl: "https://admin.deuceleague.com",
      isActive: true,
      bugModules: {
        create: [
          { name: "Dashboard", code: "DASHBOARD", description: "Main dashboard and analytics", sortOrder: 1 },
          { name: "Players", code: "PLAYERS", description: "Player management", sortOrder: 2 },
          { name: "Leagues", code: "LEAGUES", description: "League management", sortOrder: 3 },
          { name: "Seasons", code: "SEASONS", description: "Season management", sortOrder: 4 },
          { name: "Divisions", code: "DIVISIONS", description: "Division management", sortOrder: 5 },
          { name: "Matches", code: "MATCHES", description: "Match scheduling and results", sortOrder: 6 },
          { name: "Payments", code: "PAYMENTS", description: "Payment processing", sortOrder: 7 },
          { name: "Chat", code: "CHAT", description: "Chat and messaging", sortOrder: 8 },
          { name: "Notifications", code: "NOTIFICATIONS", description: "Notification system", sortOrder: 9 },
          { name: "Settings", code: "SETTINGS", description: "App settings", sortOrder: 10 },
          { name: "Authentication", code: "AUTH", description: "Login, registration, password", sortOrder: 11 },
          { name: "Other", code: "OTHER", description: "Other issues", sortOrder: 99 },
        ],
      },
      bugSettings: {
        create: {
          enableScreenshots: true,
          enableAutoCapture: true,
          enableConsoleCapture: true,
          enableNetworkCapture: false,
          maxScreenshots: 5,
          maxFileSize: 5242880,
          notifyOnNew: true,
          notifyOnStatusChange: true,
          defaultPriority: BugPriority.NORMAL,
          notifyEmails: [],
          syncEnabled: false,
          defaultAssigneeId: adminId,
        },
      },
    },
    include: {
      bugModules: true,
      bugSettings: true,
    },
  });

  // Create DeuceLeague Mobile app
  await prisma.app.create({
    data: {
      code: "DLM",
      name: "deuceleague-mobile",
      displayName: "DeuceLeague Mobile",
      description: "Mobile app for players",
      isActive: true,
      bugModules: {
        create: [
          { name: "Home", code: "HOME", description: "Home screen", sortOrder: 1 },
          { name: "Profile", code: "PROFILE", description: "User profile", sortOrder: 2 },
          { name: "Matches", code: "MATCHES", description: "Match viewing and scheduling", sortOrder: 3 },
          { name: "Pairing", code: "PAIRING", description: "Partner pairing system", sortOrder: 4 },
          { name: "Leaderboard", code: "LEADERBOARD", description: "Rankings and standings", sortOrder: 5 },
          { name: "Chat", code: "CHAT", description: "In-app messaging", sortOrder: 6 },
          { name: "Notifications", code: "NOTIFICATIONS", description: "Push notifications", sortOrder: 7 },
          { name: "Registration", code: "REGISTRATION", description: "Season registration", sortOrder: 8 },
          { name: "Authentication", code: "AUTH", description: "Login, signup, password", sortOrder: 9 },
          { name: "Other", code: "OTHER", description: "Other issues", sortOrder: 99 },
        ],
      },
      bugSettings: {
        create: {
          enableScreenshots: true,
          enableAutoCapture: true,
          enableConsoleCapture: false,
          enableNetworkCapture: false,
          maxScreenshots: 3,
          maxFileSize: 5242880,
          notifyOnNew: true,
          notifyOnStatusChange: true,
          defaultPriority: BugPriority.NORMAL,
          notifyEmails: [],
          syncEnabled: false,
          defaultAssigneeId: adminId,
        },
      },
    },
  });

  return dlaApp;
}

// =============================================
// SEED TEAM CHANGE REQUESTS
// =============================================

async function seedTeamChangeRequests(users: User[], seasons: Season[], divisions: Division[], admins: SeededAdmin[]) {
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const activeSeasons = seasons.filter(s => s.status === SeasonStatus.ACTIVE);
  const adminId = admins[0]!.adminId;

  if (activeSeasons.length === 0 || divisions.length === 0) {
    console.log("   ⚠️ Not enough active seasons or divisions to create team change requests");
    return [];
  }

  const createdRequests = [];

  // Reasons for requesting team changes
  const reasons = [
    "I want to play with more competitive players",
    "My schedule conflicts with current division match times",
    "I believe I'm ready for a higher division",
    "I'd prefer to play with players closer to my skill level",
    "Looking for a more challenging competition",
    "Work schedule changed, need different match times",
    "Moving to a different area, prefer local division",
    "Want to play with friends in another division",
  ];

  const adminNotes = [
    "Reviewed player history, request approved based on performance.",
    "Player has shown consistent improvement, moving to higher division.",
    "Request denied - player rating doesn't match requested division level.",
    "Approved after reviewing player's match history and win rate.",
    "Denied - player should complete current season first.",
    "Player's skills assessment confirms eligibility for requested division.",
  ];

  // Create requests for each active season
  for (const season of activeSeasons) {
    const seasonDivisions = divisions.filter(d => d.seasonId === season.id);

    if (seasonDivisions.length < 2) {
      continue; // Need at least 2 divisions to transfer between
    }

    // Create 8-12 requests per season covering all statuses
    const requestCount = Math.min(12, Math.floor(activeUsers.length / 3));

    for (let i = 0; i < requestCount; i++) {
      const user = activeUsers[i % activeUsers.length]!;
      const currentDivision = seasonDivisions[i % seasonDivisions.length]!;
      const requestedDivision = seasonDivisions[(i + 1) % seasonDivisions.length]!;

      // Skip if same division
      if (currentDivision.id === requestedDivision.id) {
        continue;
      }

      // Check if request already exists
      const existing = await prisma.teamChangeRequest.findFirst({
        where: {
          userId: user.id,
          seasonId: season.id,
          currentDivisionId: currentDivision.id,
          requestedDivisionId: requestedDivision.id,
        },
      });

      if (existing) {
        createdRequests.push(existing);
        continue;
      }

      // Determine status based on index for variety
      let status: TeamChangeRequestStatus;
      let reviewedByAdminId: string | null = null;
      let reviewedAt: Date | null = null;
      let adminNotesText: string | null = null;

      if (i < 4) {
        // First 4: PENDING (no admin review yet)
        status = TeamChangeRequestStatus.PENDING;
      } else if (i < 7) {
        // Next 3: APPROVED (admin reviewed and approved)
        status = TeamChangeRequestStatus.APPROVED;
        reviewedByAdminId = adminId;
        reviewedAt = randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date());
        adminNotesText = adminNotes[i % adminNotes.length];
      } else if (i < 10) {
        // Next 3: DENIED (admin reviewed and denied)
        status = TeamChangeRequestStatus.DENIED;
        reviewedByAdminId = adminId;
        reviewedAt = randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date());
        adminNotesText = adminNotes[(i + 2) % adminNotes.length];
      } else {
        // Remaining: CANCELLED (user cancelled their own request)
        status = TeamChangeRequestStatus.CANCELLED;
      }

      const request = await prisma.teamChangeRequest.create({
        data: {
          userId: user.id,
          currentDivisionId: currentDivision.id,
          requestedDivisionId: requestedDivision.id,
          seasonId: season.id,
          reason: reasons[i % reasons.length],
          status: status,
          reviewedByAdminId: reviewedByAdminId,
          reviewedAt: reviewedAt,
          adminNotes: adminNotesText,
          createdAt: randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()),
        },
      });

      createdRequests.push(request);
    }
  }

  return createdRequests;
}

// =============================================
// SEED ADMIN LOGS (NEW - Admin Action Tracking)
// =============================================

async function seedAdminLogs(admins: SeededAdmin[], users: User[], matches: Match[], seasons: Season[]) {
  const adminId = admins[0]!.adminId;
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE);

  const logEntries: Array<{
    actionType: AdminActionType;
    targetType: AdminTargetType;
    targetId: string | null;
    description: string;
    oldValue?: object;
    newValue?: object;
    metadata?: object;
  }> = [];

  // Player management logs
  for (let i = 0; i < 5; i++) {
    const user = activeUsers[i];
    if (user) {
      logEntries.push({
        actionType: AdminActionType.PLAYER_UPDATE,
        targetType: AdminTargetType.PLAYER,
        targetId: user.id,
        description: `Updated player profile for ${user.name}`,
        oldValue: { bio: "Old bio" },
        newValue: { bio: user.bio },
        metadata: { ipAddress: "192.168.1.1", userAgent: "Mozilla/5.0" },
      });
    }
  }

  // Player ban/unban logs
  const suspendedUsers = users.filter(u => u.status === UserStatus.SUSPENDED);
  for (const user of suspendedUsers) {
    logEntries.push({
      actionType: AdminActionType.PLAYER_BAN,
      targetType: AdminTargetType.PLAYER,
      targetId: user.id,
      description: `Banned player ${user.name} for violation of terms`,
      oldValue: { status: "ACTIVE" },
      newValue: { status: "SUSPENDED" },
      metadata: { reason: "Terms violation", ipAddress: "192.168.1.1" },
    });
  }

  // Match management logs
  const voidMatches = matches.filter(m => m.status === MatchStatus.VOID);
  for (const match of voidMatches.slice(0, 3)) {
    logEntries.push({
      actionType: AdminActionType.MATCH_VOID,
      targetType: AdminTargetType.MATCH,
      targetId: match.id,
      description: `Voided match due to dispute resolution`,
      oldValue: { status: "COMPLETED" },
      newValue: { status: "VOID" },
    });
  }

  // Match result edits
  for (const match of matches.slice(0, 5)) {
    logEntries.push({
      actionType: AdminActionType.MATCH_EDIT_RESULT,
      targetType: AdminTargetType.MATCH,
      targetId: match.id,
      description: `Edited match result after dispute review`,
      oldValue: { playerScore: 1, opponentScore: 2 },
      newValue: { playerScore: match.playerScore, opponentScore: match.opponentScore },
    });
  }

  // Season management logs
  for (const season of seasons.slice(0, 3)) {
    logEntries.push({
      actionType: AdminActionType.SEASON_UPDATE,
      targetType: AdminTargetType.SEASON,
      targetId: season.id,
      description: `Updated season "${season.name}" settings`,
      oldValue: { withdrawalEnabled: false },
      newValue: { withdrawalEnabled: season.withdrawalEnabled },
    });
  }

  // Dispute resolution logs
  logEntries.push({
    actionType: AdminActionType.DISPUTE_RESOLVE,
    targetType: AdminTargetType.DISPUTE,
    targetId: null,
    description: `Resolved match dispute - upheld original score`,
  });

  logEntries.push({
    actionType: AdminActionType.DISPUTE_OVERRIDE,
    targetType: AdminTargetType.DISPUTE,
    targetId: null,
    description: `Overrode match result based on evidence`,
  });

  // Settings update logs
  logEntries.push({
    actionType: AdminActionType.SETTINGS_UPDATE,
    targetType: AdminTargetType.SETTINGS,
    targetId: null,
    description: `Updated inactivity threshold settings`,
    oldValue: { inactivityThresholdDays: 14 },
    newValue: { inactivityThresholdDays: 10 },
  });

  // Bug report logs
  logEntries.push({
    actionType: AdminActionType.BUG_ASSIGN,
    targetType: AdminTargetType.BUG_REPORT,
    targetId: null,
    description: `Assigned bug report to admin for review`,
  });

  logEntries.push({
    actionType: AdminActionType.BUG_RESOLVE,
    targetType: AdminTargetType.BUG_REPORT,
    targetId: null,
    description: `Resolved bug report - issue fixed in latest release`,
  });

  const createdLogs = [];
  for (let i = 0; i < logEntries.length; i++) {
    const entry = logEntries[i]!;
    const log = await prisma.adminLog.create({
      data: {
        adminId: adminId,
        actionType: entry.actionType,
        targetType: entry.targetType,
        targetId: entry.targetId,
        description: entry.description,
        oldValue: entry.oldValue || null,
        newValue: entry.newValue || null,
        metadata: entry.metadata || null,
        createdAt: randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()),
      },
    });
    createdLogs.push(log);
  }

  return createdLogs;
}

// =============================================
// SEED ADMIN INVITE TOKENS
// =============================================

async function seedAdminInviteTokens(admins: SeededAdmin[]) {
  const pendingAdmin = await prisma.admin.findFirst({
    where: { status: AdminStatus.PENDING },
  });

  if (!pendingAdmin) return [];

  const existingToken = await prisma.adminInviteToken.findUnique({
    where: { adminId: pendingAdmin.id },
  });

  if (existingToken) return [existingToken];

  const token = await prisma.adminInviteToken.create({
    data: {
      adminId: pendingAdmin.id,
      email: "pending_admin@dleague.com",
      token: `invite_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return [token];
}

// =============================================
// SEED MATCH RESULTS (Best 6 System)
// =============================================

async function seedMatchResults(matches: Match[], users: User[]) {
  const completedMatches = matches.filter(m => m.status === MatchStatus.COMPLETED && !m.isWalkover);
  const createdResults = [];

  for (const match of completedMatches) {
    const participants = await prisma.matchParticipant.findMany({
      where: { matchId: match.id },
    });

    const player1 = participants.find(p => p.role === ParticipantRole.CREATOR);
    const player2 = participants.find(p => p.role === ParticipantRole.OPPONENT);

    if (!player1 || !player2) continue;

    // Check if results already exist
    const existingResult = await prisma.matchResult.findFirst({
      where: { matchId: match.id },
    });
    if (existingResult) continue;

    const player1Won = (match.playerScore || 0) > (match.opponentScore || 0);
    const setsWon1 = match.playerScore || 0;
    const setsLost1 = match.opponentScore || 0;
    const gamesWon1 = setsWon1 * 6 + randomInt(0, 10);
    const gamesLost1 = setsLost1 * 6 + randomInt(0, 10);

    // Player 1 result
    const result1 = await prisma.matchResult.create({
      data: {
        matchId: match.id,
        playerId: player1.userId,
        opponentId: player2.userId,
        sportType: SportType.PICKLEBALL,
        gameType: match.matchType === MatchType.SINGLES ? GameType.SINGLES : GameType.DOUBLES,
        isWin: player1Won,
        matchPoints: player1Won ? randomInt(3, 5) : randomInt(1, 2),
        participationPoints: 1,
        setsWonPoints: Math.min(setsWon1, 2),
        winBonusPoints: player1Won ? 2 : 0,
        margin: gamesWon1 - gamesLost1,
        setsWon: setsWon1,
        setsLost: setsLost1,
        gamesWon: gamesWon1,
        gamesLost: gamesLost1,
        datePlayed: match.matchDate,
        countsForStandings: true,
        resultSequence: randomInt(1, 6),
      },
    });
    createdResults.push(result1);

    // Player 2 result (inverse)
    const result2 = await prisma.matchResult.create({
      data: {
        matchId: match.id,
        playerId: player2.userId,
        opponentId: player1.userId,
        sportType: SportType.PICKLEBALL,
        gameType: match.matchType === MatchType.SINGLES ? GameType.SINGLES : GameType.DOUBLES,
        isWin: !player1Won,
        matchPoints: !player1Won ? randomInt(3, 5) : randomInt(1, 2),
        participationPoints: 1,
        setsWonPoints: Math.min(setsLost1, 2),
        winBonusPoints: !player1Won ? 2 : 0,
        margin: gamesLost1 - gamesWon1,
        setsWon: setsLost1,
        setsLost: setsWon1,
        gamesWon: gamesLost1,
        gamesLost: gamesWon1,
        datePlayed: match.matchDate,
        countsForStandings: true,
        resultSequence: randomInt(1, 6),
      },
    });
    createdResults.push(result2);
  }

  return createdResults;
}

// =============================================
// SEED PICKLEBALL GAME SCORES
// =============================================

async function seedPickleballGameScores(matches: Match[]) {
  const pickleballMatches = matches.filter(
    m => m.sport === "PICKLEBALL" && m.status === MatchStatus.COMPLETED && !m.isWalkover
  );
  const createdScores = [];

  for (const match of pickleballMatches.slice(0, 20)) {
    const existingScore = await prisma.pickleballGameScore.findFirst({
      where: { matchId: match.id },
    });
    if (existingScore) continue;

    const gamesCount = match.playerScore === 2 || match.opponentScore === 2 ? 3 : 2;

    for (let gameNum = 1; gameNum <= gamesCount; gameNum++) {
      const score = await prisma.pickleballGameScore.create({
        data: {
          matchId: match.id,
          gameNumber: gameNum,
          player1Points: randomInt(5, 11),
          player2Points: randomInt(5, 11),
        },
      });
      createdScores.push(score);
    }
  }

  return createdScores;
}

// =============================================
// SEED PLAYER STATUS CHANGES
// =============================================

async function seedPlayerStatusChanges(users: User[], admins: SeededAdmin[], matches: Match[]) {
  const adminId = admins[0]!.adminId;
  const createdChanges = [];

  // Status changes for suspended users (ban actions)
  const suspendedUsers = users.filter(u => u.status === UserStatus.SUSPENDED);
  for (const user of suspendedUsers) {
    const change = await prisma.playerStatusChange.create({
      data: {
        userId: user.id,
        previousStatus: UserStatus.ACTIVE,
        newStatus: UserStatus.SUSPENDED,
        reason: StatusChangeReason.ADMIN_BAN,
        notes: "Banned for violation of community guidelines",
        triggeredById: adminId,
      },
    });
    createdChanges.push(change);
  }

  // Status changes for inactive users
  const inactiveUsers = users.filter(u => u.status === UserStatus.INACTIVE);
  for (const user of inactiveUsers) {
    const change = await prisma.playerStatusChange.create({
      data: {
        userId: user.id,
        previousStatus: UserStatus.ACTIVE,
        newStatus: UserStatus.INACTIVE,
        reason: StatusChangeReason.INACTIVITY_THRESHOLD,
        notes: "Marked inactive due to no activity for 14+ days",
        triggeredById: adminId,
      },
    });
    createdChanges.push(change);
  }

  // Activity warnings for some active users
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE).slice(0, 5);
  for (const user of activeUsers) {
    await prisma.playerStatusChange.create({
      data: {
        userId: user.id,
        previousStatus: UserStatus.ACTIVE,
        newStatus: UserStatus.ACTIVE,
        reason: StatusChangeReason.INACTIVITY_WARNING,
        notes: "Warning: No matches played in 10 days",
        triggeredById: adminId,
      },
    });
  }

  // Match played reactivations
  for (let i = 0; i < 3; i++) {
    const user = activeUsers[i];
    const match = matches[i];
    if (user && match) {
      await prisma.playerStatusChange.create({
        data: {
          userId: user.id,
          previousStatus: UserStatus.INACTIVE,
          newStatus: UserStatus.ACTIVE,
          reason: StatusChangeReason.MATCH_PLAYED,
          notes: "Reactivated after playing a match",
          matchId: match.id,
        },
      });
    }
  }

  // Season start activations
  for (let i = 5; i < 8; i++) {
    const user = activeUsers[i];
    if (user) {
      await prisma.playerStatusChange.create({
        data: {
          userId: user.id,
          previousStatus: UserStatus.INACTIVE,
          newStatus: UserStatus.ACTIVE,
          reason: StatusChangeReason.SEASON_START,
          notes: "Reactivated for new season",
        },
      });
    }
  }

  return createdChanges;
}

// =============================================
// SEED BUG REPORTS AND RELATED
// =============================================

async function seedBugReports(users: User[], admins: SeededAdmin[]) {
  const adminId = admins[0]!.adminId;
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE);

  // Get apps and modules
  const dlaApp = await prisma.app.findUnique({
    where: { code: "DLA" },
    include: { bugModules: true },
  });

  const dlmApp = await prisma.app.findUnique({
    where: { code: "DLM" },
    include: { bugModules: true },
  });

  if (!dlaApp || !dlmApp) {
    console.log("   ⚠️ Apps not found, skipping bug reports");
    return [];
  }

  const bugReportData = [
    // DLA bugs
    { app: dlaApp, title: "Dashboard charts not loading", description: "The match statistics charts on the dashboard fail to load on Firefox", severity: BugSeverity.HIGH, status: BugStatus.IN_PROGRESS, priority: BugPriority.HIGH, moduleCode: "DASHBOARD" },
    { app: dlaApp, title: "Export to Excel fails for large datasets", description: "When exporting more than 1000 records, the Excel export times out", severity: BugSeverity.MEDIUM, status: BugStatus.NEW, priority: BugPriority.NORMAL, moduleCode: "PLAYERS" },
    { app: dlaApp, title: "Season filter not persisting", description: "The season filter resets when navigating between pages", severity: BugSeverity.LOW, status: BugStatus.TRIAGED, priority: BugPriority.LOW, moduleCode: "SEASONS" },
    { app: dlaApp, title: "Cannot void completed match", description: "Getting 500 error when trying to void a match that was completed more than 24 hours ago", severity: BugSeverity.HIGH, status: BugStatus.RESOLVED, priority: BugPriority.URGENT, moduleCode: "MATCHES", resolvedAt: new Date() },
    { app: dlaApp, title: "Dispute notification not sending", description: "Admin notifications for new disputes are not being sent", severity: BugSeverity.CRITICAL, status: BugStatus.IN_PROGRESS, priority: BugPriority.URGENT, moduleCode: "NOTIFICATIONS" },

    // DLM bugs
    { app: dlmApp, title: "Push notifications delayed", description: "Match reminder notifications arriving 30+ minutes late", severity: BugSeverity.HIGH, status: BugStatus.NEEDS_INFO, priority: BugPriority.HIGH, moduleCode: "NOTIFICATIONS" },
    { app: dlmApp, title: "Profile photo upload crashes app", description: "App crashes when uploading large photos (>5MB)", severity: BugSeverity.MEDIUM, status: BugStatus.NEW, priority: BugPriority.NORMAL, moduleCode: "PROFILE" },
    { app: dlmApp, title: "Leaderboard showing stale data", description: "Division standings not updating after match completion", severity: BugSeverity.HIGH, status: BugStatus.TRIAGED, priority: BugPriority.HIGH, moduleCode: "LEADERBOARD" },
    { app: dlmApp, title: "Chat messages out of order", description: "Messages sometimes appear in wrong chronological order", severity: BugSeverity.MEDIUM, status: BugStatus.IN_REVIEW, priority: BugPriority.NORMAL, moduleCode: "CHAT" },
    { app: dlmApp, title: "Login session expires too quickly", description: "Users getting logged out every few hours", severity: BugSeverity.HIGH, status: BugStatus.RESOLVED, priority: BugPriority.HIGH, moduleCode: "AUTH", resolvedAt: new Date() },

    // More variety
    { app: dlaApp, title: "Date picker timezone issue", description: "Dates showing wrong timezone for Malaysian users", severity: BugSeverity.MEDIUM, status: BugStatus.CLOSED, priority: BugPriority.NORMAL, moduleCode: "OTHER", resolvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    { app: dlmApp, title: "Duplicate registration entries", description: "Some users showing twice in season registration list", severity: BugSeverity.HIGH, status: BugStatus.WONT_FIX, priority: BugPriority.LOW, moduleCode: "REGISTRATION" },
    { app: dlaApp, title: "Memory leak in player list", description: "Browser memory usage increases significantly when scrolling through large player lists", severity: BugSeverity.MEDIUM, status: BugStatus.DUPLICATE, priority: BugPriority.NORMAL, moduleCode: "PLAYERS" },
  ];

  const createdReports = [];
  let reportNumber = 1001;

  for (const bugData of bugReportData) {
    const module = bugData.app.bugModules.find(m => m.code === bugData.moduleCode);
    if (!module) continue;

    const reporter = activeUsers[Math.floor(Math.random() * activeUsers.length)];

    const report = await prisma.bugReport.create({
      data: {
        reportNumber: `BUG-${reportNumber++}`,
        title: bugData.title,
        description: bugData.description,
        moduleId: module.id,
        appId: bugData.app.id,
        reportType: BugReportType.BUG,
        severity: bugData.severity,
        status: bugData.status,
        priority: bugData.priority,
        stepsToReproduce: "1. Navigate to the page\n2. Perform the action\n3. Observe the error",
        expectedBehavior: "The feature should work correctly",
        actualBehavior: bugData.description,
        reporterId: reporter?.id,
        assignedToId: bugData.status !== BugStatus.NEW ? adminId : null,
        resolvedById: bugData.resolvedAt ? adminId : null,
        resolvedAt: bugData.resolvedAt,
        resolutionNotes: bugData.resolvedAt ? "Fixed in the latest release" : null,
        pageUrl: `https://${bugData.app.code === "DLA" ? "admin" : "app"}.deuceleague.com/${bugData.moduleCode.toLowerCase()}`,
        browserName: "Chrome",
        browserVersion: "120.0.0",
        osName: "Windows",
        osVersion: "11",
        screenWidth: 1920,
        screenHeight: 1080,
        appVersion: "1.2.3",
        createdAt: randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()),
      },
    });

    createdReports.push(report);

    // Add screenshots for some reports
    if (Math.random() > 0.5) {
      await prisma.bugScreenshot.create({
        data: {
          bugReportId: report.id,
          fileName: `screenshot_${report.reportNumber}.png`,
          fileSize: randomInt(50000, 500000),
          mimeType: "image/png",
          imageUrl: `https://storage.example.com/bugs/${report.id}/screenshot.png`,
          thumbnailUrl: `https://storage.example.com/bugs/${report.id}/screenshot_thumb.png`,
          width: 1920,
          height: 1080,
          caption: "Screenshot showing the issue",
        },
      });
    }

    // Add comments for some reports
    if (bugData.status !== BugStatus.NEW) {
      await prisma.bugComment.create({
        data: {
          bugReportId: report.id,
          authorId: reporter?.id || activeUsers[0]!.id,
          content: "I can reproduce this issue consistently",
          isInternal: false,
        },
      });

      if (bugData.status === BugStatus.IN_PROGRESS || bugData.status === BugStatus.RESOLVED) {
        await prisma.bugComment.create({
          data: {
            bugReportId: report.id,
            authorId: activeUsers[0]!.id,
            content: "We are investigating this issue",
            isInternal: true,
          },
        });
      }
    }

    // Add status changes
    await prisma.bugStatusChange.create({
      data: {
        bugReportId: report.id,
        previousStatus: null,
        newStatus: BugStatus.NEW,
        newPriority: bugData.priority,
        changedById: reporter?.id,
        notes: "Bug report submitted",
      },
    });

    if (bugData.status !== BugStatus.NEW) {
      await prisma.bugStatusChange.create({
        data: {
          bugReportId: report.id,
          previousStatus: BugStatus.NEW,
          newStatus: bugData.status,
          previousPriority: BugPriority.NORMAL,
          newPriority: bugData.priority,
          changedById: activeUsers[0]!.id,
          notes: `Status changed to ${bugData.status}`,
        },
      });
    }
  }

  return createdReports;
}

// =============================================
// SEED WAITLIST SYSTEM
// =============================================

async function seedWaitlists(seasons: Season[], users: User[]) {
  const upcomingSeasons = seasons.filter(s => s.status === SeasonStatus.UPCOMING);
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const createdWaitlists = [];

  for (const season of upcomingSeasons.slice(0, 2)) {
    let waitlist = await prisma.waitlist.findUnique({
      where: { seasonId: season.id },
    });

    if (!waitlist) {
      waitlist = await prisma.waitlist.create({
        data: {
          seasonId: season.id,
          enabled: true,
          maxParticipants: 50,
        },
      });
    }

    createdWaitlists.push(waitlist);

    // Add users to waitlist
    for (let i = 0; i < Math.min(5, activeUsers.length); i++) {
      const user = activeUsers[i];
      if (!user) continue;

      const existing = await prisma.waitlistUser.findFirst({
        where: { waitlistId: waitlist.id, userId: user.id },
      });

      if (!existing) {
        await prisma.waitlistUser.create({
          data: {
            waitlistId: waitlist.id,
            userId: user.id,
            waitlistDate: randomDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), new Date()),
            promotedToRegistered: i < 2, // First 2 promoted
          },
        });
      }
    }
  }

  return createdWaitlists;
}

// =============================================
// SEED MATCH INVITATIONS
// =============================================

async function seedMatchInvitations(matches: Match[], users: User[]) {
  const scheduledMatches = matches.filter(m => m.status === MatchStatus.SCHEDULED || m.status === MatchStatus.DRAFT);
  const createdInvitations = [];

  for (const match of scheduledMatches.slice(0, 15)) {
    const participants = await prisma.matchParticipant.findMany({
      where: { matchId: match.id },
    });

    if (participants.length < 2) continue;

    const inviter = participants[0];
    const invitee = participants[1];

    if (!inviter || !invitee) continue;

    const existing = await prisma.matchInvitation.findFirst({
      where: { matchId: match.id, inviteeId: invitee.userId },
    });

    if (existing) {
      createdInvitations.push(existing);
      continue;
    }

    const status = match.status === MatchStatus.DRAFT
      ? randomElement([InvitationStatus.PENDING, InvitationStatus.EXPIRED, InvitationStatus.DECLINED])
      : InvitationStatus.ACCEPTED;

    const invitation = await prisma.matchInvitation.create({
      data: {
        matchId: match.id,
        inviterId: inviter.userId,
        inviteeId: invitee.userId,
        status: status,
        message: status === InvitationStatus.PENDING ? "Would you like to play a match?" : null,
        declineReason: status === InvitationStatus.DECLINED ? "Schedule conflict" : null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        respondedAt: status !== InvitationStatus.PENDING ? new Date() : null,
        reminderSentAt: status === InvitationStatus.PENDING ? new Date() : null,
        reminderCount: status === InvitationStatus.PENDING ? 1 : 0,
      },
    });

    createdInvitations.push(invitation);
  }

  return createdInvitations;
}

// =============================================
// SEED BRACKET SYSTEM
// =============================================

async function seedBrackets(seasons: Season[], divisions: Division[], users: User[], admins: SeededAdmin[]) {
  const adminId = admins[0]!.adminId;
  const finishedSeasons = seasons.filter(s => s.status === SeasonStatus.FINISHED);
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const createdBrackets = [];

  for (const season of finishedSeasons.slice(0, 2)) {
    const seasonDivisions = divisions.filter(d => d.seasonId === season.id);

    for (const division of seasonDivisions.slice(0, 1)) {
      const existing = await prisma.bracket.findFirst({
        where: { seasonId: season.id, divisionId: division.id },
      });

      if (existing) {
        createdBrackets.push(existing);
        continue;
      }

      const bracket = await prisma.bracket.create({
        data: {
          seasonId: season.id,
          divisionId: division.id,
          bracketName: `${division.name} Finals`,
          bracketType: BracketType.SINGLE_ELIMINATION,
          status: BracketStatus.COMPLETED,
          isLocked: true,
          seedingSource: SeedingSource.STANDINGS,
          numPlayers: 8,
          startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          publishedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
          publishedById: adminId,
        },
      });

      createdBrackets.push(bracket);

      // Create rounds
      const roundNames = ["Quarter-Finals", "Semi-Finals", "Finals"];
      const rounds = [];

      for (let r = 0; r < 3; r++) {
        const round = await prisma.bracketRound.create({
          data: {
            bracketId: bracket.id,
            roundNumber: r + 1,
            roundName: roundNames[r]!,
            startDate: new Date(Date.now() - (21 - r * 3) * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() - (18 - r * 3) * 24 * 60 * 60 * 1000),
          },
        });
        rounds.push(round);
      }

      // Create bracket matches
      const matchesPerRound = [4, 2, 1]; // QF, SF, F

      for (let r = 0; r < rounds.length; r++) {
        const round = rounds[r]!;
        const matchCount = matchesPerRound[r]!;

        for (let m = 0; m < matchCount; m++) {
          const player1 = activeUsers[(r * 4 + m * 2) % activeUsers.length];
          const player2 = activeUsers[(r * 4 + m * 2 + 1) % activeUsers.length];

          await prisma.bracketMatch.create({
            data: {
              bracketId: bracket.id,
              roundId: round.id,
              matchNumber: m + 1,
              seed1: m * 2 + 1,
              seed2: 8 - m * 2,
              player1Id: player1?.id,
              player2Id: player2?.id,
              winnerId: player1?.id, // First player wins
              status: BracketMatchStatus.COMPLETED,
              scheduledTime: randomDate(round.startDate!, round.endDate!),
              courtLocation: `Court ${randomInt(1, 4)}`,
            },
          });
        }
      }
    }
  }

  return createdBrackets;
}

// =============================================
// SEED RATING ADJUSTMENTS
// =============================================

async function seedRatingAdjustments(users: User[], seasons: Season[], admins: SeededAdmin[]) {
  const adminId = admins[0]!.adminId;
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const activeSeasons = seasons.filter(s => s.status === SeasonStatus.ACTIVE);
  const createdAdjustments = [];

  const adjustmentTypes = [
    AdjustmentType.CORRECTION,
    AdjustmentType.APPEAL_RESOLUTION,
    AdjustmentType.ADMIN_OVERRIDE,
    AdjustmentType.MIGRATION,
  ];

  for (let i = 0; i < Math.min(5, activeUsers.length); i++) {
    const user = activeUsers[i]!;
    const season = activeSeasons[i % activeSeasons.length];

    if (!season) continue;

    const playerRating = await prisma.playerRating.findFirst({
      where: { userId: user.id, seasonId: season.id },
    });

    if (!playerRating) continue;

    const adjustmentType = adjustmentTypes[i % adjustmentTypes.length]!;
    const delta = randomInt(-50, 50);

    const adjustment = await prisma.ratingAdjustment.create({
      data: {
        playerRatingId: playerRating.id,
        adminId: adminId,
        adjustmentType: adjustmentType,
        ratingBefore: playerRating.currentRating - delta,
        ratingAfter: playerRating.currentRating,
        delta: delta,
        reason: adjustmentType === AdjustmentType.CORRECTION
          ? "Corrected rating calculation error"
          : adjustmentType === AdjustmentType.APPEAL_RESOLUTION
          ? "Rating adjusted after successful appeal"
          : "Manual rating adjustment by admin",
        internalNotes: "Verified by admin team",
        playerNotified: true,
        notifiedAt: new Date(),
        ipAddress: "192.168.1.1",
      },
    });

    createdAdjustments.push(adjustment);
  }

  return createdAdjustments;
}

// =============================================
// SEED RATING RECALCULATIONS
// =============================================

async function seedRatingRecalculations(admins: SeededAdmin[], seasons: Season[]) {
  const adminId = admins[0]!.adminId;
  const createdRecalculations = [];

  const recalcData = [
    { scope: RecalculationScope.MATCH, status: RecalculationStatus.APPLIED },
    { scope: RecalculationScope.PLAYER, status: RecalculationStatus.APPLIED },
    { scope: RecalculationScope.DIVISION, status: RecalculationStatus.PREVIEW_READY },
    { scope: RecalculationScope.SEASON, status: RecalculationStatus.PENDING },
    { scope: RecalculationScope.MATCH, status: RecalculationStatus.FAILED },
  ];

  for (const data of recalcData) {
    const recalc = await prisma.ratingRecalculation.create({
      data: {
        scope: data.scope,
        status: data.status,
        initiatedByAdminId: adminId,
        seasonId: seasons[0]?.id,
        affectedPlayersCount: data.status !== RecalculationStatus.PENDING ? randomInt(5, 50) : null,
        changesPreview: data.status === RecalculationStatus.PREVIEW_READY ? { changes: [{ userId: "test", delta: 10 }] } : null,
        previewGeneratedAt: data.status !== RecalculationStatus.PENDING ? new Date() : null,
        appliedAt: data.status === RecalculationStatus.APPLIED ? new Date() : null,
        failedAt: data.status === RecalculationStatus.FAILED ? new Date() : null,
        errorMessage: data.status === RecalculationStatus.FAILED ? "Database connection timeout" : null,
      },
    });
    createdRecalculations.push(recalc);
  }

  return createdRecalculations;
}

// =============================================
// SEED SEASON LOCKS
// =============================================

async function seedSeasonLocks(seasons: Season[], admins: SeededAdmin[]) {
  const adminId = admins[0]!.adminId;
  const finishedSeasons = seasons.filter(s => s.status === SeasonStatus.FINISHED);
  const createdLocks = [];

  for (const season of finishedSeasons.slice(0, 2)) {
    const existing = await prisma.seasonLock.findUnique({
      where: { seasonId: season.id },
    });

    if (existing) {
      createdLocks.push(existing);
      continue;
    }

    const lock = await prisma.seasonLock.create({
      data: {
        seasonId: season.id,
        isLocked: true,
        lockedByAdminId: adminId,
        finalExportUrl: `https://storage.example.com/exports/season_${season.id}_final.xlsx`,
        exportGeneratedAt: new Date(),
        overrideAllowed: false,
      },
    });
    createdLocks.push(lock);
  }

  return createdLocks;
}

// =============================================
// SEED NOTIFICATION PREFERENCES
// =============================================

async function seedNotificationPreferences(users: User[]) {
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const createdPrefs = [];

  for (const user of activeUsers.slice(0, 20)) {
    const existing = await prisma.notificationPreference.findUnique({
      where: { userId: user.id },
    });

    if (existing) {
      createdPrefs.push(existing);
      continue;
    }

    const pref = await prisma.notificationPreference.create({
      data: {
        userId: user.id,
        matchReminders: true,
        matchRescheduled: true,
        matchCancelled: true,
        matchResults: true,
        partnerChange: randomElement([true, false]),
        opponentChange: true,
        ratingChange: true,
        inactivityAlerts: randomElement([true, false]),
        chatNotifications: true,
        invitations: true,
        seasonRegistration: true,
        seasonUpdates: randomElement([true, false]),
        disputeAlerts: true,
        teamChangeRequests: true,
        withdrawalRequests: true,
        playerReports: true,
        seasonJoinRequests: true,
        pushEnabled: true,
        emailEnabled: randomElement([true, false]),
      },
    });
    createdPrefs.push(pref);
  }

  return createdPrefs;
}

// =============================================
// SEED USER PUSH TOKENS
// =============================================

async function seedUserPushTokens(users: User[]) {
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const createdTokens = [];

  for (const user of activeUsers.slice(0, 30)) {
    const existing = await prisma.userPushToken.findFirst({
      where: { userId: user.id },
    });

    if (existing) {
      createdTokens.push(existing);
      continue;
    }

    const platform = randomElement(["ios", "android", "web"]);
    const token = await prisma.userPushToken.create({
      data: {
        userId: user.id,
        token: `${platform}_token_${user.id}_${Date.now()}`,
        platform: platform,
        deviceId: `device_${user.id.slice(0, 8)}`,
        isActive: true,
        failureCount: 0,
        lastUsedAt: randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()),
      },
    });
    createdTokens.push(token);
  }

  return createdTokens;
}

// =============================================
// SEED ADMIN MESSAGE LOGS
// =============================================

async function seedAdminMessageLogs(admins: SeededAdmin[], matches: Match[], seasons: Season[], users: User[]) {
  const adminId = admins[0]!.adminId;
  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE);
  const createdLogs = [];

  const messageData = [
    { subject: "Match Reminder", message: "Your match is scheduled for tomorrow at 3 PM. Please confirm your attendance.", sendEmail: true, sendPush: true },
    { subject: "Season Registration Open", message: "Registration for the new season is now open. Don't miss out!", sendEmail: true, sendPush: true },
    { subject: "Match Rescheduled", message: "Your match has been rescheduled due to venue unavailability.", sendEmail: true, sendPush: false },
    { subject: "Important Update", message: "There have been changes to the scoring rules. Please review the updated guidelines.", sendEmail: false, sendPush: true },
    { subject: "Welcome to DeuceLeague", message: "Welcome to the league! We're excited to have you join us.", sendEmail: true, sendPush: false },
  ];

  for (let i = 0; i < messageData.length; i++) {
    const data = messageData[i]!;
    const recipients = activeUsers.slice(0, randomInt(5, 15)).map(u => u.id);

    const log = await prisma.adminMessageLog.create({
      data: {
        adminId: adminId,
        matchId: matches[i % matches.length]?.id,
        seasonId: seasons[i % seasons.length]?.id,
        subject: data.subject,
        message: data.message,
        recipientIds: recipients,
        sendEmail: data.sendEmail,
        sendPush: data.sendPush,
        inAppCount: recipients.length,
        emailCount: data.sendEmail ? recipients.length - randomInt(0, 2) : 0,
        emailSkipped: data.sendEmail ? randomInt(0, 2) : 0,
        pushCount: data.sendPush ? recipients.length - randomInt(0, 3) : 0,
        pushSkipped: data.sendPush ? randomInt(0, 3) : 0,
        createdAt: randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()),
      },
    });
    createdLogs.push(log);
  }

  return createdLogs;
}

// =============================================
// MAIN SEED FUNCTION
// =============================================

async function main() {
  console.log("🌱 Starting comprehensive database seed...\n");

  try {
    // 1. Seed admins
    console.log("👤 Seeding admin users...");
    const admins = await seedAdmins();
    console.log(`   ✅ Created ${admins.length} admins`);
    console.log("   - superadmin@dleague.com / Admin@123 (SUPERADMIN)");
    console.log("   - admin@dleague.com / Admin@123 (ACTIVE)");
    console.log("   - manager@dleague.com / Admin@123 (ACTIVE)");
    console.log("   - pending_admin@dleague.com / Admin@123 (PENDING)");
    console.log("   - suspended_admin@dleague.com / Admin@123 (SUSPENDED)\n");

    // 2. Seed test users
    console.log("👥 Seeding test users...");
    const users = await seedTestUsers();
    console.log(`   ✅ Created ${users.length} test users (password: Test@123)`);
    console.log("   - 50 active users with complete profiles");
    console.log("   - 10 inactive users");
    console.log("   - 5 suspended users");
    console.log("   - 10 users with incomplete onboarding\n");

    // 3. Seed categories
    console.log("📋 Seeding categories...");
    const categories = await seedCategories();
    console.log(`   ✅ Created ${categories.length} categories\n`);

    // 4. Seed sponsorships
    console.log("💰 Seeding sponsorships...");
    const sponsorships = await seedSponsorships(admins[0]!.adminId);
    console.log(`   ✅ Created ${sponsorships.length} sponsorships\n`);

    // 5. Seed leagues, seasons, and divisions
    console.log("🏆 Seeding leagues, seasons, and divisions...");
    const { leagues, seasons, divisions } = await seedLeaguesAndSeasons(admins[0]!.adminId, categories, sponsorships);
    console.log(`   ✅ Created ${leagues.length} leagues`);
    console.log(`   ✅ Created ${seasons.length} seasons (ACTIVE, UPCOMING, FINISHED, CANCELLED)`);
    console.log(`   ✅ Created ${divisions.length} divisions\n`);

    // 6. Seed season memberships
    console.log("🎫 Seeding season memberships...");
    const memberships = await seedSeasonMemberships(users, seasons, divisions);
    console.log(`   ✅ Created ${memberships.length} season memberships\n`);

    // 7. Seed matches with all status variations
    console.log("🎾 Seeding matches with all status variations...");
    const matches = await seedMatches(users, divisions, seasons, admins);
    console.log(`   ✅ Created ${matches.length} matches`);
    console.log("   - COMPLETED (normal, walkover, disputed)");
    console.log("   - SCHEDULED, ONGOING, DRAFT");
    console.log("   - CANCELLED (normal, late cancellation)");
    console.log("   - VOID, UNFINISHED\n");

    // 8. Seed disputes
    console.log("⚖️ Seeding match disputes...");
    const disputes = await seedDisputes(matches, users, admins);
    console.log(`   ✅ Created ${disputes.length} disputes (OPEN, UNDER_REVIEW, RESOLVED, REJECTED)\n`);

    // 9. Seed walkovers
    console.log("🚶 Seeding walkovers...");
    const walkovers = await seedWalkovers(matches, users, admins);
    console.log(`   ✅ Created ${walkovers.length} walkovers\n`);

    // 10. Seed penalties
    console.log("⚠️ Seeding penalties...");
    const penalties = await seedPenalties(users, matches, admins);
    console.log(`   ✅ Created ${penalties.length} penalties (WARNING, POINTS_DEDUCTION, SUSPENSION)\n`);

    // 11. Seed admin actions
    console.log("📝 Seeding admin actions...");
    const adminActions = await seedAdminActions(matches, admins);
    console.log(`   ✅ Created ${adminActions.length} admin action logs\n`);

    // 12. Seed withdrawal requests
    console.log("📤 Seeding withdrawal requests...");
    const withdrawals = await seedWithdrawalRequests(users, seasons);
    console.log(`   ✅ Created ${withdrawals.length} withdrawal requests\n`);

    // 13. Seed chat data
    console.log("💬 Seeding chat threads and messages...");
    const { threads, messages } = await seedChatData(users, divisions);
    console.log(`   ✅ Created ${threads.length} threads`);
    console.log(`   ✅ Created ${messages.length} messages\n`);

    // 14. Seed notifications
    console.log("🔔 Seeding notifications...");
    const notifications = await seedNotifications(users, matches, seasons);
    console.log(`   ✅ Created ${notifications.length} notifications\n`);

    // 15. Seed social data (friendships, pair requests, partnerships)
    console.log("🤝 Seeding social data...");
    await seedSocialData(users, seasons);
    console.log("   ✅ Created friendships, pair requests, partnerships, favorites\n");

    // 16. Seed ratings and standings
    console.log("📊 Seeding player ratings and standings...");
    await seedRatingsAndStandings(users, seasons, divisions, admins);
    console.log("   ✅ Created player ratings, rating history, division standings\n");

    // 17. Seed achievements
    console.log("🏅 Seeding achievements...");
    const achievements = await seedAchievements(users);
    console.log(`   ✅ Created ${achievements.length} achievements\n`);

    // 18. Seed promo codes
    console.log("🎟️ Seeding promo codes...");
    await seedPromoCodes(seasons);
    console.log("   ✅ Created promo codes\n");

    // 19. Seed inactivity settings
    console.log("⏰ Seeding inactivity settings...");
    await seedInactivitySettings(leagues, seasons, admins);
    console.log("   ✅ Created inactivity settings (global, league-specific, season-specific)\n");

    // 20. Seed season invitations
    console.log("📧 Seeding season invitations...");
    const invitations = await seedSeasonInvitations(users, seasons);
    console.log(`   ✅ Created ${invitations.length} season invitations\n`);

    // 21. Seed friendly matches (non-league)
    console.log("🏓 Seeding friendly matches...");
    const friendlyMatches = await seedFriendlyMatches(users, leagues);
    console.log(`   ✅ Created ${friendlyMatches.length} friendly matches\n`);

    // 22. Seed bug tracking apps
    console.log("🐛 Seeding bug tracking apps...");
    await seedBugTrackingApps(admins[0]!.adminId);
    console.log("   ✅ Created bug tracking apps and modules\n");

    // 23. Seed team change requests
    console.log("🔄 Seeding team change requests...");
    const teamChangeRequests = await seedTeamChangeRequests(users, seasons, divisions, admins);
    console.log(`   ✅ Created ${teamChangeRequests.length} team change requests (PENDING, APPROVED, DENIED, CANCELLED)\n`);

    // =============================================
    // NEW SEED FUNCTIONS FOR 100% COVERAGE
    // =============================================

    // 24. Seed admin logs (NEW)
    console.log("📝 Seeding admin logs...");
    const adminLogs = await seedAdminLogs(admins, users, matches, seasons);
    console.log(`   ✅ Created ${adminLogs.length} admin action logs\n`);

    // 25. Seed admin invite tokens
    console.log("🎫 Seeding admin invite tokens...");
    const inviteTokens = await seedAdminInviteTokens(admins);
    console.log(`   ✅ Created ${inviteTokens.length} admin invite tokens\n`);

    // 26. Seed match results (Best 6 System)
    console.log("📈 Seeding match results (Best 6 system)...");
    const matchResults = await seedMatchResults(matches, users);
    console.log(`   ✅ Created ${matchResults.length} match results\n`);

    // 27. Seed pickleball game scores
    console.log("🏓 Seeding pickleball game scores...");
    const pickleballScores = await seedPickleballGameScores(matches);
    console.log(`   ✅ Created ${pickleballScores.length} pickleball game scores\n`);

    // 28. Seed player status changes
    console.log("📊 Seeding player status changes...");
    const statusChanges = await seedPlayerStatusChanges(users, admins, matches);
    console.log(`   ✅ Created ${statusChanges.length} player status changes\n`);

    // 29. Seed bug reports
    console.log("🐞 Seeding bug reports...");
    const bugReports = await seedBugReports(users, admins);
    console.log(`   ✅ Created ${bugReports.length} bug reports with screenshots, comments, and status changes\n`);

    // 30. Seed waitlists
    console.log("📋 Seeding waitlists...");
    const waitlists = await seedWaitlists(seasons, users);
    console.log(`   ✅ Created ${waitlists.length} season waitlists with users\n`);

    // 31. Seed match invitations
    console.log("✉️ Seeding match invitations...");
    const matchInvitations = await seedMatchInvitations(matches, users);
    console.log(`   ✅ Created ${matchInvitations.length} match invitations\n`);

    // 32. Seed brackets
    console.log("🏆 Seeding brackets...");
    const brackets = await seedBrackets(seasons, divisions, users, admins);
    console.log(`   ✅ Created ${brackets.length} brackets with rounds and matches\n`);

    // 33. Seed rating adjustments
    console.log("⚖️ Seeding rating adjustments...");
    const ratingAdjustments = await seedRatingAdjustments(users, seasons, admins);
    console.log(`   ✅ Created ${ratingAdjustments.length} rating adjustments\n`);

    // 34. Seed rating recalculations
    console.log("🔄 Seeding rating recalculations...");
    const recalculations = await seedRatingRecalculations(admins, seasons);
    console.log(`   ✅ Created ${recalculations.length} rating recalculation jobs\n`);

    // 35. Seed season locks
    console.log("🔒 Seeding season locks...");
    const seasonLocks = await seedSeasonLocks(seasons, admins);
    console.log(`   ✅ Created ${seasonLocks.length} season locks\n`);

    // 36. Seed notification preferences
    console.log("🔔 Seeding notification preferences...");
    const notifPrefs = await seedNotificationPreferences(users);
    console.log(`   ✅ Created ${notifPrefs.length} notification preferences\n`);

    // 37. Seed user push tokens
    console.log("📱 Seeding user push tokens...");
    const pushTokens = await seedUserPushTokens(users);
    console.log(`   ✅ Created ${pushTokens.length} user push tokens\n`);

    // 38. Seed admin message logs
    console.log("💬 Seeding admin message logs...");
    const messageLogs = await seedAdminMessageLogs(admins, matches, seasons, users);
    console.log(`   ✅ Created ${messageLogs.length} admin message logs\n`);

    console.log("═══════════════════════════════════════════════════════");
    console.log("🎉 100% COMPREHENSIVE DATABASE SEED COMPLETED!");
    console.log("═══════════════════════════════════════════════════════");
    console.log("\n📝 FULL MODEL COVERAGE SUMMARY:");
    console.log("\n   👤 USER & AUTH MODELS:");
    console.log("   • Users: 75 (50 active, 10 inactive, 5 suspended, 10 incomplete)");
    console.log("   • Admins: 5 (various statuses)");
    console.log("   • Accounts, Sessions, Verification: Auto-seeded");
    console.log("   • Admin Invite Tokens: Pending invites");
    console.log("   • Admin Logs: Action tracking history");
    console.log("   • Questionnaire Responses & Initial Ratings");

    console.log("\n   🏆 LEAGUE & SEASON MODELS:");
    console.log("   • Leagues: 5 (Tennis, Pickleball, Padel)");
    console.log("   • Categories: 7 types");
    console.log("   • Sponsorships: 6 (all tiers)");
    console.log("   • Seasons: 20 (ACTIVE, UPCOMING, FINISHED, CANCELLED)");
    console.log("   • Divisions: Multiple per season (all levels)");
    console.log("   • Season Memberships & Division Assignments");
    console.log("   • Waitlists & Waitlist Users");
    console.log("   • Promo Codes");
    console.log("   • Season Locks: For finished seasons");

    console.log("\n   🎾 MATCH MODELS:");
    console.log("   • League Matches: 130+ (all 7 status variations)");
    console.log("   • Friendly Matches: 30 (non-league)");
    console.log("   • Match Participants");
    console.log("   • Match Invitations: PENDING, ACCEPTED, DECLINED, EXPIRED");
    console.log("   • Match Scores & Pickleball Game Scores");
    console.log("   • Match Results: Best 6 system tracking");

    console.log("\n   ⚖️ DISPUTE & PENALTY MODELS:");
    console.log("   • Match Disputes: All statuses");
    console.log("   • Dispute Admin Notes & Comments");
    console.log("   • Match Walkovers");
    console.log("   • Player Penalties: WARNING, POINTS_DEDUCTION, SUSPENSION");
    console.log("   • Match Admin Actions");

    console.log("\n   🏆 BRACKET SYSTEM:");
    console.log("   • Brackets: COMPLETED for finished seasons");
    console.log("   • Bracket Rounds: Quarter-Finals, Semi-Finals, Finals");
    console.log("   • Bracket Matches: With winners");

    console.log("\n   📊 RATING SYSTEM:");
    console.log("   • Player Ratings & Rating History");
    console.log("   • Division Standings: Best 6 fields");
    console.log("   • Rating Adjustments: Manual admin adjustments");
    console.log("   • Rating Recalculations: Various statuses");
    console.log("   • Rating Parameters");

    console.log("\n   ⏰ INACTIVITY SYSTEM:");
    console.log("   • Inactivity Settings: Global, league, season-specific");
    console.log("   • Player Status Changes: All change reasons");

    console.log("\n   🐛 BUG TRACKING:");
    console.log("   • Apps: DLA, DLM");
    console.log("   • Bug Modules");
    console.log("   • Bug Reports: All statuses");
    console.log("   • Bug Screenshots, Comments, Status Changes");
    console.log("   • Bug Report Settings");

    console.log("\n   🤝 SOCIAL MODELS:");
    console.log("   • Friendships: All statuses");
    console.log("   • Favorites");
    console.log("   • Pair Requests & Partnerships");
    console.log("   • Season Invitations");

    console.log("\n   💬 MESSAGING:");
    console.log("   • Threads (Division & DM)");
    console.log("   • User Threads & Messages");
    console.log("   • Admin Message Logs");

    console.log("\n   🔔 NOTIFICATIONS:");
    console.log("   • Notifications & User Notifications");
    console.log("   • Notification Preferences");
    console.log("   • User Push Tokens");

    console.log("\n   🏅 OTHER MODELS:");
    console.log("   • Achievements & User Achievements");
    console.log("   • Withdrawal Requests");
    console.log("   • Team Change Requests\n");

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
