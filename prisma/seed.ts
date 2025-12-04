/// <reference types="node" />
import {
  Prisma,
  PrismaClient,
  GameType,
  SportType,
  Statuses,
  BugPriority,
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

  const testUsers = [
    // Active users with complete profiles
    { name: "Alice Johnson", email: "alice@test.com", username: "alice_j", bio: "Love playing doubles! Looking for partners.", area: "Kuala Lumpur", gender: "FEMALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Bob Smith", email: "bob@test.com", username: "bob_smith", bio: "Intermediate player, play for fun.", area: "Kuala Lumpur", gender: "MALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Charlie Brown", email: "charlie@test.com", username: "charlie_b", bio: "Advanced player, competitive mindset.", area: "Petaling Jaya", gender: "MALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Diana Prince", email: "diana@test.com", username: "diana_prince", bio: "Beginner looking to improve!", area: "Subang Jaya", gender: "FEMALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Ethan Hunt", email: "ethan@test.com", username: "ethan_h", bio: "Experienced doubles player.", area: "Kuala Lumpur", gender: "MALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Frank Miller", email: "frank@test.com", username: "frank_m", bio: "Weekend warrior, love the game!", area: "Subang Jaya", gender: "MALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Grace Lee", email: "grace@test.com", username: "grace_l", bio: "Competitive player, looking for tournaments.", area: "Petaling Jaya", gender: "FEMALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Henry Chen", email: "henry@test.com", username: "henry_c", bio: "Doubles specialist, team player.", area: "Kuala Lumpur", gender: "MALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Iris Wong", email: "iris@test.com", username: "iris_w", bio: "Intermediate player, improving steadily.", area: "Subang Jaya", gender: "FEMALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Jack Robinson", email: "jack@test.com", username: "jack_r", bio: "Advanced singles and doubles player.", area: "Petaling Jaya", gender: "MALE", status: UserStatus.ACTIVE, completedOnboarding: true },

    // More active users for doubles matches
    { name: "Karen Smith", email: "karen@test.com", username: "karen_s", bio: "Tennis enthusiast.", area: "Kuala Lumpur", gender: "FEMALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Leo Martinez", email: "leo@test.com", username: "leo_m", bio: "Padel lover.", area: "Petaling Jaya", gender: "MALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Mia Johnson", email: "mia@test.com", username: "mia_j", bio: "New to the game but learning fast!", area: "Subang Jaya", gender: "FEMALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Nathan Brown", email: "nathan@test.com", username: "nathan_b", bio: "Competitive spirit!", area: "Kuala Lumpur", gender: "MALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Olivia Davis", email: "olivia@test.com", username: "olivia_d", bio: "Weekend player.", area: "Petaling Jaya", gender: "FEMALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Peter Wilson", email: "peter@test.com", username: "peter_w", bio: "Love the competition!", area: "Subang Jaya", gender: "MALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Quinn Taylor", email: "quinn@test.com", username: "quinn_t", bio: "All-around player.", area: "Kuala Lumpur", gender: "FEMALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Ryan Anderson", email: "ryan@test.com", username: "ryan_a", bio: "Doubles fanatic.", area: "Petaling Jaya", gender: "MALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Sarah Thomas", email: "sarah@test.com", username: "sarah_t", bio: "Playing for fun!", area: "Subang Jaya", gender: "FEMALE", status: UserStatus.ACTIVE, completedOnboarding: true },
    { name: "Tom Jackson", email: "tom@test.com", username: "tom_j", bio: "Former tennis player.", area: "Kuala Lumpur", gender: "MALE", status: UserStatus.ACTIVE, completedOnboarding: true },

    // Inactive users
    { name: "Inactive User 1", email: "inactive1@test.com", username: "inactive1", bio: "Haven't played in a while.", area: "Kuala Lumpur", gender: "MALE", status: UserStatus.INACTIVE, completedOnboarding: true },
    { name: "Inactive User 2", email: "inactive2@test.com", username: "inactive2", bio: "Taking a break.", area: "Petaling Jaya", gender: "FEMALE", status: UserStatus.INACTIVE, completedOnboarding: true },
    { name: "Inactive User 3", email: "inactive3@test.com", username: "inactive3", bio: "Will be back soon.", area: "Subang Jaya", gender: "MALE", status: UserStatus.INACTIVE, completedOnboarding: true },

    // Suspended users
    { name: "Suspended User 1", email: "suspended1@test.com", username: "suspended1", bio: "Account suspended.", area: "Kuala Lumpur", gender: "MALE", status: UserStatus.SUSPENDED, completedOnboarding: true },
    { name: "Suspended User 2", email: "suspended2@test.com", username: "suspended2", bio: "Under review.", area: "Petaling Jaya", gender: "FEMALE", status: UserStatus.SUSPENDED, completedOnboarding: true },

    // Incomplete onboarding users
    { name: "New User 1", email: "newuser1@test.com", username: "newuser1", bio: null, area: null, gender: null, status: UserStatus.ACTIVE, completedOnboarding: false },
    { name: "New User 2", email: "newuser2@test.com", username: "newuser2", bio: null, area: null, gender: null, status: UserStatus.ACTIVE, completedOnboarding: false },
    { name: "New User 3", email: "newuser3@test.com", username: "newuser3", bio: null, area: null, gender: null, status: UserStatus.ACTIVE, completedOnboarding: false },
  ];

  const createdUsers: User[] = [];

  for (const userData of testUsers) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      createdUsers.push(existingUser);
      continue;
    }

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
        dateOfBirth: new Date("1995-01-01"),
        lastLogin: userData.completedOnboarding ? new Date() : null,
        lastActivityCheck: userData.status === UserStatus.ACTIVE ? new Date() : null,
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

        // Create divisions for active and finished seasons
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

  // Match configurations for different scenarios
  const matchConfigs = [
    // COMPLETED matches - various outcomes
    { status: MatchStatus.COMPLETED, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 10 },
    { status: MatchStatus.COMPLETED, isWalkover: true, isDisputed: false, isLateCancellation: false, count: 3, walkoverReason: WalkoverReason.NO_SHOW },
    { status: MatchStatus.COMPLETED, isWalkover: true, isDisputed: false, isLateCancellation: false, count: 2, walkoverReason: WalkoverReason.LATE_CANCELLATION },
    { status: MatchStatus.COMPLETED, isWalkover: true, isDisputed: false, isLateCancellation: false, count: 1, walkoverReason: WalkoverReason.INJURY },
    { status: MatchStatus.COMPLETED, isDisputed: true, isWalkover: false, isLateCancellation: false, count: 3 },

    // SCHEDULED matches - future matches
    { status: MatchStatus.SCHEDULED, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 8 },

    // ONGOING matches - currently playing
    { status: MatchStatus.ONGOING, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 3 },

    // DRAFT matches - incomplete setup
    { status: MatchStatus.DRAFT, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 4 },

    // CANCELLED matches - various reasons
    { status: MatchStatus.CANCELLED, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 3, cancellationReason: CancellationReason.WEATHER },
    { status: MatchStatus.CANCELLED, isWalkover: false, isDisputed: false, isLateCancellation: true, count: 2, cancellationReason: CancellationReason.PERSONAL_EMERGENCY },
    { status: MatchStatus.CANCELLED, isWalkover: false, isDisputed: false, isLateCancellation: true, count: 2, cancellationReason: CancellationReason.ILLNESS },

    // VOID matches - admin voided
    { status: MatchStatus.VOID, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 2 },

    // UNFINISHED matches - started but not completed
    { status: MatchStatus.UNFINISHED, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 2 },
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

      // Determine match date based on status
      let matchDate: Date;
      if (config.status === MatchStatus.COMPLETED || config.status === MatchStatus.VOID || config.status === MatchStatus.UNFINISHED) {
        matchDate = randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date());
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
          scheduledStartTime: matchDate,
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
    console.log("   - 20 active users with complete profiles");
    console.log("   - 3 inactive users");
    console.log("   - 2 suspended users");
    console.log("   - 3 users with incomplete onboarding\n");

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

    // 19. Seed bug tracking apps
    console.log("🐛 Seeding bug tracking apps...");
    await seedBugTrackingApps(admins[0]!.adminId);
    console.log("   ✅ Created bug tracking apps and modules\n");

    console.log("═══════════════════════════════════════════════════════");
    console.log("🎉 COMPREHENSIVE DATABASE SEED COMPLETED SUCCESSFULLY!");
    console.log("═══════════════════════════════════════════════════════");
    console.log("\n📝 SUMMARY:");
    console.log("   • Admins: 5 (various statuses)");
    console.log("   • Users: 28 (active, inactive, suspended, incomplete)");
    console.log("   • Leagues: 5 (different sports)");
    console.log("   • Seasons: 20 (all statuses)");
    console.log("   • Divisions: Multiple per active season");
    console.log("   • Matches: 45+ (all 7 status variations + flags)");
    console.log("   • Disputes, Walkovers, Penalties");
    console.log("   • Chat threads and messages");
    console.log("   • Notifications");
    console.log("   • Ratings and standings");
    console.log("   • Achievements");
    console.log("   • And more...\n");

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
