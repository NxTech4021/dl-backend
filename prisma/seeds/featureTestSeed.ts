/**
 * Feature Test Seed - COMPREHENSIVE
 *
 * Creates test data for ALL sports and scenarios:
 * - Pickleball Singles & Doubles (both supported)
 * - Tennis Singles & Doubles (both supported, with tiebreaks)
 * - Padel Doubles ONLY (Padel is exclusively doubles)
 * - Division Chat
 * - Match Listing (all statuses)
 * - Match Details Screen
 * - Standings Page
 * - Disputed Matches
 * - Walkover Scenarios
 * - Partnerships (for doubles)
 * - Mixed Doubles (via GenderType.MIXED, not a separate GameType)
 *
 * SPORT/GAMETYPE RESTRICTIONS:
 * - Pickleball: SINGLES ✓, DOUBLES ✓
 * - Tennis:     SINGLES ✓, DOUBLES ✓
 * - Padel:      SINGLES ✗, DOUBLES ✓ (Padel is DOUBLES-ONLY)
 *
 * Run with: npx tsx prisma/seeds/featureTestSeed.ts
 */

import {
  PrismaClient,
  MatchStatus,
  MatchType,
  MatchFormat,
  MatchFeeType,
  ParticipantRole,
  InvitationStatus,
  WalkoverReason,
  SportType,
  GameType,
  DivisionLevel,
  SeasonStatus,
  MembershipStatus,
  PaymentStatus,
  MessageType,
  UserStatus,
  Role,
  Statuses,
  Set3Format,
  TiebreakType,
  DisputeCategory,
  DisputeStatus,
  DisputePriority,
  PartnershipStatus,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

// =============================================
// DATE HELPERS
// =============================================

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// =============================================
// TEST DATA CONFIGURATION
// =============================================

const TEST_PASSWORD = "Test@123";
const TEST_LEAGUE_NAME = "Feature Test League";
const TEST_SEASON_NAME = "Test Season Q1";

const TEST_USERS = [
  // Pickleball players (1-6)
  { email: "player1@test.com", name: "Player One", username: "player1" },
  { email: "player2@test.com", name: "Player Two", username: "player2" },
  { email: "player3@test.com", name: "Player Three", username: "player3" },
  { email: "player4@test.com", name: "Player Four", username: "player4" },
  { email: "player5@test.com", name: "Player Five", username: "player5" },
  { email: "player6@test.com", name: "Player Six", username: "player6" },
  // Tennis players (7-10)
  { email: "tennis1@test.com", name: "Tennis Player A", username: "tennis1" },
  { email: "tennis2@test.com", name: "Tennis Player B", username: "tennis2" },
  { email: "tennis3@test.com", name: "Tennis Player C", username: "tennis3" },
  { email: "tennis4@test.com", name: "Tennis Player D", username: "tennis4" },
  // Padel players (11-14) - Padel is always doubles
  { email: "padel1@test.com", name: "Padel Player A", username: "padel1" },
  { email: "padel2@test.com", name: "Padel Player B", username: "padel2" },
  { email: "padel3@test.com", name: "Padel Player C", username: "padel3" },
  { email: "padel4@test.com", name: "Padel Player D", username: "padel4" },
  // Admin
  { email: "testadmin@test.com", name: "Test Admin", username: "testadmin" },
];

// =============================================
// MAIN SEED FUNCTION
// =============================================

async function seedFeatureTests() {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       COMPREHENSIVE FEATURE TEST SEEDING                     ║");
  console.log("║       All Sports: Pickleball, Tennis, Padel                  ║");
  console.log("║       Singles & Doubles, Disputes, Walkovers                 ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("\n");

  // =============================================
  // STEP 1: Create or find test users
  // =============================================
  console.log("📝 Step 1: Creating test users...\n");

  const { hashPassword } = await import("better-auth/crypto");
  const hashedPassword = await hashPassword(TEST_PASSWORD);

  const users: Record<string, { id: string; name: string; email: string }> = {};

  for (const userData of TEST_USERS) {
    let user = await prisma.user.findFirst({
      where: { email: userData.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          username: userData.username,
          emailVerified: true,
          status: UserStatus.ACTIVE,
          completedOnboarding: true,
        },
      });

      // Create account for auth
      await prisma.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log(`   ✅ Created user: ${userData.email}`);
    } else {
      console.log(`   ℹ️  User exists: ${userData.email}`);
    }

    users[userData.username] = { id: user.id, name: user.name || userData.name, email: userData.email };
  }

  // Create admin record for testadmin
  const adminUser = users["testadmin"]!;
  let admin = await prisma.admin.findFirst({
    where: { userId: adminUser.id },
  });

  if (!admin) {
    admin = await prisma.admin.create({
      data: {
        userId: adminUser.id,
      },
    });
    console.log(`   ✅ Created admin record for testadmin`);
  }

  // =============================================
  // STEP 2: Create League and Season
  // =============================================
  console.log("\n📝 Step 2: Creating league and season...\n");

  // Clean up existing test data
  const existingLeague = await prisma.league.findFirst({
    where: { name: TEST_LEAGUE_NAME },
  });

  if (existingLeague) {
    console.log(`   🧹 Cleaning up existing test league...`);

    // Get all seasons and divisions
    const seasons = await prisma.season.findMany({
      where: { leagues: { some: { id: existingLeague.id } } },
      include: { divisions: true },
    });

    for (const season of seasons) {
      for (const division of season.divisions) {
        // Delete matches and related records
        const matches = await prisma.match.findMany({
          where: { divisionId: division.id },
        });

        for (const match of matches) {
          await prisma.matchDispute.deleteMany({ where: { matchId: match.id } });
          await prisma.matchParticipant.deleteMany({ where: { matchId: match.id } });
          await prisma.matchInvitation.deleteMany({ where: { matchId: match.id } });
          await prisma.matchScore.deleteMany({ where: { matchId: match.id } });
          await prisma.pickleballGameScore.deleteMany({ where: { matchId: match.id } });
          await prisma.matchResult.deleteMany({ where: { matchId: match.id } });
          await prisma.match.delete({ where: { id: match.id } });
        }

        // Delete thread and messages
        const thread = await prisma.thread.findFirst({
          where: { divisionId: division.id },
        });

        if (thread) {
          await prisma.message.deleteMany({ where: { threadId: thread.id } });
          await prisma.userThread.deleteMany({ where: { threadId: thread.id } });
          await prisma.thread.delete({ where: { id: thread.id } });
        }

        // Delete standings and memberships
        await prisma.divisionStanding.deleteMany({ where: { divisionId: division.id } });
        await prisma.divisionAssignment.deleteMany({ where: { divisionId: division.id } });
      }

      await prisma.seasonMembership.deleteMany({ where: { seasonId: season.id } });
      await prisma.division.deleteMany({ where: { seasonId: season.id } });
    }

    await prisma.season.deleteMany({
      where: { leagues: { some: { id: existingLeague.id } } },
    });
    await prisma.league.delete({ where: { id: existingLeague.id } });
    console.log(`   ✅ Cleaned up existing test data`);
  }

  // Create new league
  const league = await prisma.league.create({
    data: {
      name: TEST_LEAGUE_NAME,
      sportType: SportType.PICKLEBALL,
      gameType: GameType.SINGLES,
      location: "Test City",
      description: "League for feature testing",
      status: Statuses.ACTIVE,
    },
  });
  console.log(`   ✅ Created league: ${league.name}`);

  // Create season
  const season = await prisma.season.create({
    data: {
      name: TEST_SEASON_NAME,
      startDate: daysAgo(7),
      endDate: daysFromNow(30),
      status: SeasonStatus.ACTIVE,
      isActive: true,
      entryFee: new Decimal(0),
      leagues: { connect: { id: league.id } },
    },
  });
  console.log(`   ✅ Created season: ${season.name}`);

  // =============================================
  // STEP 3: Create Divisions with Threads
  // =============================================
  console.log("\n📝 Step 3: Creating divisions with chat threads...\n");

  // Division A - Beginner (players 1, 2, 3)
  const divisionA = await prisma.division.create({
    data: {
      seasonId: season.id,
      leagueId: league.id,
      name: "Beginner Division",
      description: "For beginner players",
      level: DivisionLevel.BEGINNER,
      gameType: GameType.SINGLES,
      isActiveDivision: true,
      pointsThreshold: 1200,
    },
  });

  // Create thread for Division A
  const threadA = await prisma.thread.create({
    data: {
      name: `${divisionA.name} Chat`,
      isGroup: true,
      divisionId: divisionA.id,
    },
  });
  console.log(`   ✅ Created Division A: ${divisionA.name} with chat thread`);

  // Division B - Intermediate (players 4, 5, 6)
  const divisionB = await prisma.division.create({
    data: {
      seasonId: season.id,
      leagueId: league.id,
      name: "Intermediate Division",
      description: "For intermediate players",
      level: DivisionLevel.INTERMEDIATE,
      gameType: GameType.SINGLES,
      isActiveDivision: true,
      pointsThreshold: 1500,
    },
  });

  // Create thread for Division B
  const threadB = await prisma.thread.create({
    data: {
      name: `${divisionB.name} Chat`,
      isGroup: true,
      divisionId: divisionB.id,
    },
  });
  console.log(`   ✅ Created Division B: ${divisionB.name} with chat thread`);

  // =============================================
  // STEP 4: Assign players to divisions
  // =============================================
  console.log("\n📝 Step 4: Assigning players to divisions...\n");

  // Division A players
  const divisionAPlayers = [users["player1"]!, users["player2"]!, users["player3"]!];
  for (const player of divisionAPlayers) {
    // Create season membership
    await prisma.seasonMembership.create({
      data: {
        userId: player.id,
        seasonId: season.id,
        divisionId: divisionA.id,
        status: MembershipStatus.ACTIVE,
        paymentStatus: PaymentStatus.COMPLETED,
        joinedAt: new Date(),
      },
    });

    // Create division assignment
    await prisma.divisionAssignment.create({
      data: {
        userId: player.id,
        divisionId: divisionA.id,
        assignedAt: new Date(),
      },
    });

    // Add to division chat
    await prisma.userThread.create({
      data: {
        userId: player.id,
        threadId: threadA.id,
        role: "member",
      },
    });

    // Create division standing
    await prisma.divisionStanding.create({
      data: {
        divisionId: divisionA.id,
        seasonId: season.id,
        userId: player.id,
        rank: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        totalPoints: 0,
      },
    });

    console.log(`   ✅ Assigned ${player.name} to Division A`);
  }

  // Division B players
  const divisionBPlayers = [users["player4"]!, users["player5"]!, users["player6"]!];
  for (const player of divisionBPlayers) {
    await prisma.seasonMembership.create({
      data: {
        userId: player.id,
        seasonId: season.id,
        divisionId: divisionB.id,
        status: MembershipStatus.ACTIVE,
        paymentStatus: PaymentStatus.COMPLETED,
        joinedAt: new Date(),
      },
    });

    await prisma.divisionAssignment.create({
      data: {
        userId: player.id,
        divisionId: divisionB.id,
        assignedAt: new Date(),
      },
    });

    await prisma.userThread.create({
      data: {
        userId: player.id,
        threadId: threadB.id,
        role: "member",
      },
    });

    await prisma.divisionStanding.create({
      data: {
        divisionId: divisionB.id,
        seasonId: season.id,
        userId: player.id,
        rank: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        totalPoints: 0,
      },
    });

    console.log(`   ✅ Assigned ${player.name} to Division B`);
  }

  // =============================================
  // STEP 5: Create test matches
  // =============================================
  console.log("\n📝 Step 5: Creating test matches...\n");

  const player1 = users["player1"]!;
  const player2 = users["player2"]!;
  const player3 = users["player3"]!;

  // Match 1: SCHEDULED (future, 1 slot open) - for testing joining
  const match1 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.SCHEDULED,
      matchDate: daysFromNow(3),
      location: "Test Court 1",
      venue: "Main Building",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: player1.id,
      notes: "Match 1: SCHEDULED - Open for joining",
    },
  });

  await prisma.matchParticipant.create({
    data: {
      matchId: match1.id,
      userId: player1.id,
      role: ParticipantRole.CREATOR,
      team: "team1",
      invitationStatus: InvitationStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  });
  console.log(`   ✅ Match 1: SCHEDULED (open slot) - ID: ${match1.id}`);

  // Match 2: SCHEDULED (full) - for testing full match display
  const match2 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.SCHEDULED,
      matchDate: daysFromNow(5),
      location: "Test Court 2",
      venue: "Main Building",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: player1.id,
      notes: "Match 2: SCHEDULED - Full match",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      {
        matchId: match2.id,
        userId: player1.id,
        role: ParticipantRole.CREATOR,
        team: "team1",
        invitationStatus: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
      {
        matchId: match2.id,
        userId: player2.id,
        role: ParticipantRole.OPPONENT,
        team: "team2",
        invitationStatus: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    ],
  });
  console.log(`   ✅ Match 2: SCHEDULED (full) - ID: ${match2.id}`);

  // Match 3: COMPLETED (2-0) - for standings
  const match3 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(5),
      location: "Test Court 1",
      venue: "Main Building",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: player1.id,
      resultSubmittedById: player1.id,
      resultSubmittedAt: daysAgo(5),
      resultConfirmedById: player2.id,
      resultConfirmedAt: daysAgo(5),
      playerScore: 2,
      opponentScore: 0,
      notes: "Match 3: COMPLETED (2-0) - Player1 wins",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      {
        matchId: match3.id,
        userId: player1.id,
        role: ParticipantRole.CREATOR,
        team: "team1",
        invitationStatus: InvitationStatus.ACCEPTED,
        acceptedAt: daysAgo(7),
        didAttend: true,
      },
      {
        matchId: match3.id,
        userId: player2.id,
        role: ParticipantRole.OPPONENT,
        team: "team2",
        invitationStatus: InvitationStatus.ACCEPTED,
        acceptedAt: daysAgo(7),
        didAttend: true,
      },
    ],
  });

  // Create Pickleball game scores
  await prisma.pickleballGameScore.createMany({
    data: [
      { matchId: match3.id, gameNumber: 1, player1Points: 15, player2Points: 8 },
      { matchId: match3.id, gameNumber: 2, player1Points: 15, player2Points: 10 },
    ],
  });

  // Create match results for standings (with resultSequence for Best 6 tracking)
  await prisma.matchResult.createMany({
    data: [
      {
        matchId: match3.id,
        playerId: player1.id,
        opponentId: player2.id,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
        isWin: true,
        matchPoints: 5, // 1 (participation) + 2 (games won) + 2 (win bonus)
        participationPoints: 1,
        setsWonPoints: 2,
        winBonusPoints: 2,
        margin: 12, // 30 - 18
        setsWon: 2,
        setsLost: 0,
        gamesWon: 30,
        gamesLost: 18,
        datePlayed: daysAgo(5),
        countsForStandings: true,
        resultSequence: 6, // Player1's 6th result (chronological order)
      },
      {
        matchId: match3.id,
        playerId: player2.id,
        opponentId: player1.id,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
        isWin: false,
        matchPoints: 1, // 1 (participation) + 0 (games won)
        participationPoints: 1,
        setsWonPoints: 0,
        winBonusPoints: 0,
        margin: -12, // 18 - 30
        setsWon: 0,
        setsLost: 2,
        gamesWon: 18,
        gamesLost: 30,
        datePlayed: daysAgo(5),
        countsForStandings: true,
        resultSequence: 1, // Player2's 1st result
      },
    ],
  });
  console.log(`   ✅ Match 3: COMPLETED (2-0) - ID: ${match3.id}`);

  // Match 4: COMPLETED (2-1) with tiebreak-like score
  const match4 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(3),
      location: "Test Court 2",
      venue: "Main Building",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: player2.id,
      resultSubmittedById: player2.id,
      resultSubmittedAt: daysAgo(3),
      resultConfirmedById: player3.id,
      resultConfirmedAt: daysAgo(3),
      playerScore: 2,
      opponentScore: 1,
      notes: "Match 4: COMPLETED (2-1) - Player2 wins close match",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      {
        matchId: match4.id,
        userId: player2.id,
        role: ParticipantRole.CREATOR,
        team: "team1",
        invitationStatus: InvitationStatus.ACCEPTED,
        acceptedAt: daysAgo(5),
        didAttend: true,
      },
      {
        matchId: match4.id,
        userId: player3.id,
        role: ParticipantRole.OPPONENT,
        team: "team2",
        invitationStatus: InvitationStatus.ACCEPTED,
        acceptedAt: daysAgo(5),
        didAttend: true,
      },
    ],
  });

  await prisma.pickleballGameScore.createMany({
    data: [
      { matchId: match4.id, gameNumber: 1, player1Points: 15, player2Points: 12 },
      { matchId: match4.id, gameNumber: 2, player1Points: 8, player2Points: 15 },
      { matchId: match4.id, gameNumber: 3, player1Points: 15, player2Points: 11 },
    ],
  });

  await prisma.matchResult.createMany({
    data: [
      {
        matchId: match4.id,
        playerId: player2.id,
        opponentId: player3.id,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
        isWin: true,
        matchPoints: 5,
        participationPoints: 1,
        setsWonPoints: 2,
        winBonusPoints: 2,
        margin: 0, // 38 - 38
        setsWon: 2,
        setsLost: 1,
        gamesWon: 38,
        gamesLost: 38,
        datePlayed: daysAgo(3),
        countsForStandings: true,
        resultSequence: 2, // Player2's 2nd result
      },
      {
        matchId: match4.id,
        playerId: player3.id,
        opponentId: player2.id,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
        isWin: false,
        matchPoints: 2, // 1 + 1 (one game won)
        participationPoints: 1,
        setsWonPoints: 1,
        winBonusPoints: 0,
        margin: 0, // 38 - 38
        setsWon: 1,
        setsLost: 2,
        gamesWon: 38,
        gamesLost: 38,
        datePlayed: daysAgo(3),
        countsForStandings: true,
        resultSequence: 1, // Player3's 1st result
      },
    ],
  });
  console.log(`   ✅ Match 4: COMPLETED (2-1) - ID: ${match4.id}`);

  // Match 5: COMPLETED (walkover)
  const match5 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(2),
      location: "Test Court 1",
      venue: "Main Building",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: player1.id,
      resultSubmittedById: player1.id,
      resultSubmittedAt: daysAgo(2),
      playerScore: 2,
      opponentScore: 0,
      isWalkover: true,
      walkoverReason: WalkoverReason.NO_SHOW,
      notes: "Match 5: COMPLETED (Walkover) - Player3 no-show",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      {
        matchId: match5.id,
        userId: player1.id,
        role: ParticipantRole.CREATOR,
        team: "team1",
        invitationStatus: InvitationStatus.ACCEPTED,
        acceptedAt: daysAgo(4),
        didAttend: true,
      },
      {
        matchId: match5.id,
        userId: player3.id,
        role: ParticipantRole.OPPONENT,
        team: "team2",
        invitationStatus: InvitationStatus.ACCEPTED,
        acceptedAt: daysAgo(4),
        didAttend: false,
      },
    ],
  });

  await prisma.matchResult.createMany({
    data: [
      {
        matchId: match5.id,
        playerId: player1.id,
        opponentId: player3.id,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
        isWin: true,
        matchPoints: 3, // 1 (participation) + 0 (no games) + 2 (win bonus)
        participationPoints: 1,
        setsWonPoints: 0,
        winBonusPoints: 2,
        margin: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        datePlayed: daysAgo(2),
        countsForStandings: true,
        resultSequence: 7, // Player1's 7th result (does NOT count - beyond Best 6)
      },
      {
        matchId: match5.id,
        playerId: player3.id,
        opponentId: player1.id,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
        isWin: false,
        matchPoints: 1,
        participationPoints: 1,
        setsWonPoints: 0,
        winBonusPoints: 0,
        margin: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        datePlayed: daysAgo(2),
        countsForStandings: true,
        resultSequence: 2, // Player3's 2nd result
      },
    ],
  });
  console.log(`   ✅ Match 5: COMPLETED (Walkover) - ID: ${match5.id}`);

  // Match 6: ONGOING (awaiting confirmation)
  const match6 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.ONGOING,
      matchDate: hoursAgo(3),
      location: "Test Court 2",
      venue: "Main Building",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: player2.id,
      resultSubmittedById: player2.id,
      resultSubmittedAt: new Date(),
      playerScore: 2,
      opponentScore: 0,
      notes: "Match 6: ONGOING - Awaiting Player1 confirmation",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      {
        matchId: match6.id,
        userId: player2.id,
        role: ParticipantRole.CREATOR,
        team: "team1",
        invitationStatus: InvitationStatus.ACCEPTED,
        acceptedAt: daysAgo(1),
        didAttend: true,
      },
      {
        matchId: match6.id,
        userId: player1.id,
        role: ParticipantRole.OPPONENT,
        team: "team2",
        invitationStatus: InvitationStatus.ACCEPTED,
        acceptedAt: daysAgo(1),
        didAttend: true,
      },
    ],
  });

  await prisma.pickleballGameScore.createMany({
    data: [
      { matchId: match6.id, gameNumber: 1, player1Points: 15, player2Points: 9 },
      { matchId: match6.id, gameNumber: 2, player1Points: 15, player2Points: 11 },
    ],
  });
  console.log(`   ✅ Match 6: ONGOING - ID: ${match6.id}`);

  // Match 7: CANCELLED
  const match7 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.CANCELLED,
      matchDate: daysAgo(1),
      location: "Test Court 1",
      venue: "Main Building",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: player3.id,
      cancelledById: player3.id,
      cancelledAt: daysAgo(2),
      cancellationReason: "WEATHER",
      notes: "Match 7: CANCELLED - Weather",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      {
        matchId: match7.id,
        userId: player3.id,
        role: ParticipantRole.CREATOR,
        team: "team1",
        invitationStatus: InvitationStatus.ACCEPTED,
      },
      {
        matchId: match7.id,
        userId: player1.id,
        role: ParticipantRole.OPPONENT,
        team: "team2",
        invitationStatus: InvitationStatus.ACCEPTED,
      },
    ],
  });
  console.log(`   ✅ Match 7: CANCELLED - ID: ${match7.id}`);

  // Match 8: DRAFT (invitations expired)
  const match8 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.DRAFT,
      matchDate: daysAgo(1),
      location: "Test Court 2",
      venue: "Main Building",
      courtBooked: false,
      fee: MatchFeeType.FREE,
      createdById: player1.id,
      notes: "Match 8: DRAFT - Invitation expired",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      {
        matchId: match8.id,
        userId: player1.id,
        role: ParticipantRole.CREATOR,
        team: "team1",
        invitationStatus: InvitationStatus.ACCEPTED,
      },
      {
        matchId: match8.id,
        userId: player2.id,
        role: ParticipantRole.OPPONENT,
        team: "team2",
        invitationStatus: InvitationStatus.EXPIRED,
      },
    ],
  });

  await prisma.matchInvitation.create({
    data: {
      matchId: match8.id,
      inviterId: player1.id,
      inviteeId: player2.id,
      status: InvitationStatus.EXPIRED,
      expiresAt: daysAgo(1),
    },
  });
  console.log(`   ✅ Match 8: DRAFT - ID: ${match8.id}`);

  // =============================================
  // STEP 6: Create chat messages
  // =============================================
  console.log("\n📝 Step 6: Creating chat messages...\n");

  // Text messages in Division A chat
  const messages = [
    { senderId: player1.id, content: "Hey everyone! Welcome to the Beginner Division chat! 🎾" },
    { senderId: player2.id, content: "Thanks! Excited to play with you all!" },
    { senderId: player3.id, content: "When's the next match?" },
    { senderId: player1.id, content: "I've got a match scheduled for next week. Anyone want to practice tomorrow?" },
    { senderId: player2.id, content: "I'm free tomorrow afternoon. Let's do it!" },
  ];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    await prisma.message.create({
      data: {
        threadId: threadA.id,
        senderId: msg.senderId,
        content: msg.content,
        messageType: MessageType.TEXT,
        createdAt: new Date(Date.now() - (messages.length - i) * 60 * 60 * 1000), // Stagger by 1 hour
      },
    });
  }
  console.log(`   ✅ Created ${messages.length} text messages in Division A chat`);

  // Create a MATCH type message for Match 1
  await prisma.message.create({
    data: {
      threadId: threadA.id,
      senderId: player1.id,
      content: "New match posted!",
      messageType: MessageType.MATCH,
      matchId: match1.id,
      matchData: JSON.stringify({
        matchId: match1.id,
        matchDate: match1.matchDate,
        location: match1.location,
        venue: match1.venue,
        status: match1.status,
        sport: match1.sport,
      }),
      createdAt: new Date(),
    },
  });
  console.log(`   ✅ Created MATCH type message for Match 1`);

  // Create a reply chain
  const originalMessage = await prisma.message.create({
    data: {
      threadId: threadA.id,
      senderId: player1.id,
      content: "Who wants to play this weekend?",
      messageType: MessageType.TEXT,
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  });

  await prisma.message.create({
    data: {
      threadId: threadA.id,
      senderId: player2.id,
      content: "I'm in! Saturday works for me.",
      messageType: MessageType.TEXT,
      repliesToId: originalMessage.id,
      createdAt: new Date(Date.now() - 25 * 60 * 1000),
    },
  });
  console.log(`   ✅ Created reply chain`);

  // =============================================
  // STEP 7: Update standings (will be recalculated after Best 6 matches added)
  // =============================================
  console.log("\n📝 Step 7: Creating initial division standings (will be updated after Best 6 matches)...\n");

  // NOTE: These standings are PLACEHOLDERS - will be updated after Best 6 matches are created in Step 9b
  // The actual Best 6 calculation will be:
  // Player1: 7 wins total, but only Best 6 count = 5+5+5+5+5+5 = 30 points (max)
  // Player2: Has wins and losses - calculated in Step 9e
  // Player3: Has wins and losses - calculated in Step 9e

  await prisma.divisionStanding.update({
    where: {
      divisionId_seasonId_userId: {
        divisionId: divisionA.id,
        seasonId: season.id,
        userId: player1.id,
      },
    },
    data: {
      rank: 1,
      matchesPlayed: 2,
      wins: 2,
      losses: 0,
      totalPoints: 10, // Placeholder - will be updated
    },
  });

  await prisma.divisionStanding.update({
    where: {
      divisionId_seasonId_userId: {
        divisionId: divisionA.id,
        seasonId: season.id,
        userId: player2.id,
      },
    },
    data: {
      rank: 2,
      matchesPlayed: 2,
      wins: 1,
      losses: 1,
      totalPoints: 6, // Placeholder - will be updated
    },
  });

  await prisma.divisionStanding.update({
    where: {
      divisionId_seasonId_userId: {
        divisionId: divisionA.id,
        seasonId: season.id,
        userId: player3.id,
      },
    },
    data: {
      rank: 3,
      matchesPlayed: 2,
      wins: 0,
      losses: 2,
      totalPoints: 3, // Placeholder - will be updated
    },
  });
  console.log(`   ✅ Created initial Division A standings (to be updated after Best 6 matches)`);

  // =============================================
  // STEP 8: Create Tennis League
  // =============================================
  console.log("\n📝 Step 8: Creating Tennis League...\n");

  // Tennis League
  const tennisLeague = await prisma.league.create({
    data: {
      name: "Tennis Test League",
      sportType: SportType.TENNIS,
      gameType: GameType.SINGLES,
      location: "Test City Tennis Club",
      description: "Tennis league for feature testing",
      status: Statuses.ACTIVE,
    },
  });
  console.log(`   ✅ Created league: ${tennisLeague.name}`);

  // Tennis Season
  const tennisSeason = await prisma.season.create({
    data: {
      name: "Tennis Test Season",
      startDate: daysAgo(7),
      endDate: daysFromNow(30),
      status: SeasonStatus.ACTIVE,
      isActive: true,
      entryFee: new Decimal(0),
      leagues: { connect: { id: tennisLeague.id } },
    },
  });
  console.log(`   ✅ Created season: ${tennisSeason.name}`);

  // Tennis Division
  const tennisDivision = await prisma.division.create({
    data: {
      seasonId: tennisSeason.id,
      leagueId: tennisLeague.id,
      name: "Tennis Singles Division",
      description: "Tennis singles matches",
      level: DivisionLevel.INTERMEDIATE,
      gameType: GameType.SINGLES,
      isActiveDivision: true,
    },
  });

  // Create thread for Tennis Division
  const tennisThread = await prisma.thread.create({
    data: {
      name: `${tennisDivision.name} Chat`,
      isGroup: true,
      divisionId: tennisDivision.id,
    },
  });
  console.log(`   ✅ Created Tennis Division with chat thread`);

  // Assign Tennis players
  const tennisPlayers = [
    users["tennis1"]!,
    users["tennis2"]!,
    users["tennis3"]!,
    users["tennis4"]!,
  ];

  for (const player of tennisPlayers) {
    await prisma.seasonMembership.create({
      data: {
        userId: player.id,
        seasonId: tennisSeason.id,
        divisionId: tennisDivision.id,
        status: MembershipStatus.ACTIVE,
        paymentStatus: PaymentStatus.COMPLETED,
        joinedAt: new Date(),
      },
    });

    await prisma.divisionAssignment.create({
      data: {
        userId: player.id,
        divisionId: tennisDivision.id,
        assignedAt: new Date(),
      },
    });

    await prisma.userThread.create({
      data: {
        userId: player.id,
        threadId: tennisThread.id,
        role: "member",
      },
    });

    await prisma.divisionStanding.create({
      data: {
        divisionId: tennisDivision.id,
        seasonId: tennisSeason.id,
        userId: player.id,
        rank: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        totalPoints: 0,
      },
    });

    console.log(`   ✅ Assigned ${player.name} to Tennis Division`);
  }

  // Tennis Match 1: COMPLETED (6-4, 6-3) - Straight sets win
  const tennis1 = users["tennis1"]!;
  const tennis2 = users["tennis2"]!;
  const tennis3 = users["tennis3"]!;
  const tennis4 = users["tennis4"]!;

  const tennisMatch1 = await prisma.match.create({
    data: {
      divisionId: tennisDivision.id,
      leagueId: tennisLeague.id,
      seasonId: tennisSeason.id,
      sport: SportType.TENNIS,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(4),
      location: "Court 1",
      venue: "Tennis Center",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: tennis1.id,
      resultSubmittedById: tennis1.id,
      resultSubmittedAt: daysAgo(4),
      resultConfirmedById: tennis2.id,
      resultConfirmedAt: daysAgo(4),
      playerScore: 2,
      opponentScore: 0,
      notes: "Tennis Match: COMPLETED (6-4, 6-3) - Straight sets",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      {
        matchId: tennisMatch1.id,
        userId: tennis1.id,
        role: ParticipantRole.CREATOR,
        team: "team1",
        invitationStatus: InvitationStatus.ACCEPTED,
        didAttend: true,
      },
      {
        matchId: tennisMatch1.id,
        userId: tennis2.id,
        role: ParticipantRole.OPPONENT,
        team: "team2",
        invitationStatus: InvitationStatus.ACCEPTED,
        didAttend: true,
      },
    ],
  });

  // Tennis set scores
  await prisma.matchScore.createMany({
    data: [
      {
        matchId: tennisMatch1.id,
        setNumber: 1,
        player1Games: 6,
        player2Games: 4,
        hasTiebreak: false,
      },
      {
        matchId: tennisMatch1.id,
        setNumber: 2,
        player1Games: 6,
        player2Games: 3,
        hasTiebreak: false,
      },
    ],
  });

  // Tennis match results
  await prisma.matchResult.createMany({
    data: [
      {
        matchId: tennisMatch1.id,
        playerId: tennis1.id,
        opponentId: tennis2.id,
        sportType: SportType.TENNIS,
        gameType: GameType.SINGLES,
        isWin: true,
        matchPoints: 5,
        participationPoints: 1,
        setsWonPoints: 2,
        winBonusPoints: 2,
        margin: 5, // (6+6) - (4+3) = 12-7 = 5
        setsWon: 2,
        setsLost: 0,
        gamesWon: 12,
        gamesLost: 7,
        datePlayed: daysAgo(4),
        countsForStandings: true,
      },
      {
        matchId: tennisMatch1.id,
        playerId: tennis2.id,
        opponentId: tennis1.id,
        sportType: SportType.TENNIS,
        gameType: GameType.SINGLES,
        isWin: false,
        matchPoints: 1,
        participationPoints: 1,
        setsWonPoints: 0,
        winBonusPoints: 0,
        margin: -5,
        setsWon: 0,
        setsLost: 2,
        gamesWon: 7,
        gamesLost: 12,
        datePlayed: daysAgo(4),
        countsForStandings: true,
      },
    ],
  });
  console.log(`   ✅ Tennis Match 1: COMPLETED (6-4, 6-3) - ID: ${tennisMatch1.id}`);

  // Tennis Match 2: COMPLETED with TIEBREAK (7-6(5), 3-6, 10-7 match tiebreak)
  const tennisMatch2 = await prisma.match.create({
    data: {
      divisionId: tennisDivision.id,
      leagueId: tennisLeague.id,
      seasonId: tennisSeason.id,
      sport: SportType.TENNIS,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(2),
      location: "Court 2",
      venue: "Tennis Center",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: tennis3.id,
      resultSubmittedById: tennis3.id,
      resultSubmittedAt: daysAgo(2),
      resultConfirmedById: tennis4.id,
      resultConfirmedAt: daysAgo(2),
      playerScore: 2,
      opponentScore: 1,
      set3Format: Set3Format.MATCH_TIEBREAK,
      notes: "Tennis Match: COMPLETED with 10-point match tiebreak",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      {
        matchId: tennisMatch2.id,
        userId: tennis3.id,
        role: ParticipantRole.CREATOR,
        team: "team1",
        invitationStatus: InvitationStatus.ACCEPTED,
        didAttend: true,
      },
      {
        matchId: tennisMatch2.id,
        userId: tennis4.id,
        role: ParticipantRole.OPPONENT,
        team: "team2",
        invitationStatus: InvitationStatus.ACCEPTED,
        didAttend: true,
      },
    ],
  });

  // Tennis set scores with tiebreaks
  await prisma.matchScore.createMany({
    data: [
      {
        matchId: tennisMatch2.id,
        setNumber: 1,
        player1Games: 7,
        player2Games: 6,
        hasTiebreak: true,
        player1Tiebreak: 7,
        player2Tiebreak: 5,
        tiebreakType: TiebreakType.STANDARD_7PT,
      },
      {
        matchId: tennisMatch2.id,
        setNumber: 2,
        player1Games: 3,
        player2Games: 6,
        hasTiebreak: false,
      },
      {
        matchId: tennisMatch2.id,
        setNumber: 3,
        player1Games: 10,
        player2Games: 7,
        hasTiebreak: true,
        player1Tiebreak: 10,
        player2Tiebreak: 7,
        tiebreakType: TiebreakType.MATCH_10PT,
      },
    ],
  });

  // Match results - tiebreak points count as games for margin
  await prisma.matchResult.createMany({
    data: [
      {
        matchId: tennisMatch2.id,
        playerId: tennis3.id,
        opponentId: tennis4.id,
        sportType: SportType.TENNIS,
        gameType: GameType.SINGLES,
        isWin: true,
        matchPoints: 5, // 1 + 2 + 2
        participationPoints: 1,
        setsWonPoints: 2,
        winBonusPoints: 2,
        margin: 3, // (7+3+10) - (6+6+7) = 20-19 = 1 (simplified: using tiebreak points for Set 3)
        setsWon: 2,
        setsLost: 1,
        gamesWon: 20,
        gamesLost: 19,
        datePlayed: daysAgo(2),
        countsForStandings: true,
      },
      {
        matchId: tennisMatch2.id,
        playerId: tennis4.id,
        opponentId: tennis3.id,
        sportType: SportType.TENNIS,
        gameType: GameType.SINGLES,
        isWin: false,
        matchPoints: 2, // 1 + 1 + 0
        participationPoints: 1,
        setsWonPoints: 1,
        winBonusPoints: 0,
        margin: -1,
        setsWon: 1,
        setsLost: 2,
        gamesWon: 19,
        gamesLost: 20,
        datePlayed: daysAgo(2),
        countsForStandings: true,
      },
    ],
  });
  console.log(`   ✅ Tennis Match 2: COMPLETED with tiebreak - ID: ${tennisMatch2.id}`);

  // Tennis Match 3: ONGOING with DISPUTE
  const tennisMatch3 = await prisma.match.create({
    data: {
      divisionId: tennisDivision.id,
      leagueId: tennisLeague.id,
      seasonId: tennisSeason.id,
      sport: SportType.TENNIS,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.ONGOING,
      matchDate: hoursAgo(5),
      location: "Court 3",
      venue: "Tennis Center",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: tennis1.id,
      resultSubmittedById: tennis1.id,
      resultSubmittedAt: hoursAgo(2),
      isDisputed: true,
      playerScore: 2,
      opponentScore: 1,
      notes: "Tennis Match: DISPUTED - Score disagreement",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      {
        matchId: tennisMatch3.id,
        userId: tennis1.id,
        role: ParticipantRole.CREATOR,
        team: "team1",
        invitationStatus: InvitationStatus.ACCEPTED,
        didAttend: true,
      },
      {
        matchId: tennisMatch3.id,
        userId: tennis3.id,
        role: ParticipantRole.OPPONENT,
        team: "team2",
        invitationStatus: InvitationStatus.ACCEPTED,
        didAttend: true,
      },
    ],
  });

  // Create the dispute
  await prisma.matchDispute.create({
    data: {
      matchId: tennisMatch3.id,
      raisedByUserId: tennis3.id,
      disputeCategory: DisputeCategory.WRONG_SCORE,
      disputeComment: "I won the match 6-4, 4-6, 10-8 not 6-4, 6-4, 10-7. The third set score is wrong.",
      disputerScore: { sets: [{ p1: 4, p2: 6 }, { p1: 6, p2: 4 }, { p1: 8, p2: 10 }] },
      status: DisputeStatus.OPEN,
      priority: DisputePriority.NORMAL,
    },
  });
  console.log(`   ✅ Tennis Match 3: DISPUTED - ID: ${tennisMatch3.id}`);

  // Update Tennis standings
  await prisma.divisionStanding.update({
    where: {
      divisionId_seasonId_userId: {
        divisionId: tennisDivision.id,
        seasonId: tennisSeason.id,
        userId: tennis1.id,
      },
    },
    data: { rank: 1, matchesPlayed: 1, wins: 1, losses: 0, totalPoints: 5 },
  });
  await prisma.divisionStanding.update({
    where: {
      divisionId_seasonId_userId: {
        divisionId: tennisDivision.id,
        seasonId: tennisSeason.id,
        userId: tennis3.id,
      },
    },
    data: { rank: 2, matchesPlayed: 1, wins: 1, losses: 0, totalPoints: 5 },
  });
  await prisma.divisionStanding.update({
    where: {
      divisionId_seasonId_userId: {
        divisionId: tennisDivision.id,
        seasonId: tennisSeason.id,
        userId: tennis2.id,
      },
    },
    data: { rank: 3, matchesPlayed: 1, wins: 0, losses: 1, totalPoints: 1 },
  });
  await prisma.divisionStanding.update({
    where: {
      divisionId_seasonId_userId: {
        divisionId: tennisDivision.id,
        seasonId: tennisSeason.id,
        userId: tennis4.id,
      },
    },
    data: { rank: 4, matchesPlayed: 1, wins: 0, losses: 1, totalPoints: 2 },
  });
  console.log(`   ✅ Updated Tennis standings`);

  // =============================================
  // STEP 8b: Add Tennis Doubles Division (Same League)
  // =============================================
  console.log("\n📝 Step 8b: Adding Tennis Doubles Division...\n");

  // Tennis Doubles Division (same league, different game type)
  const tennisDoublesDivision = await prisma.division.create({
    data: {
      seasonId: tennisSeason.id,
      leagueId: tennisLeague.id,
      name: "Tennis Doubles Division",
      description: "Tennis doubles matches with partnerships",
      level: DivisionLevel.INTERMEDIATE,
      gameType: GameType.DOUBLES,
      isActiveDivision: true,
    },
  });

  const tennisDoublesThread = await prisma.thread.create({
    data: {
      name: `${tennisDoublesDivision.name} Chat`,
      isGroup: true,
      divisionId: tennisDoublesDivision.id,
    },
  });
  console.log(`   ✅ Created Tennis Doubles Division`);

  // Create Tennis partnerships (reuse tennis1-4 for doubles)
  const tennisPartnership1 = await prisma.partnership.create({
    data: {
      captainId: tennis1.id,
      partnerId: tennis2.id,
      seasonId: tennisSeason.id,
      divisionId: tennisDoublesDivision.id,
      status: PartnershipStatus.ACTIVE,
      pairRating: 1520,
    },
  });
  console.log(`   ✅ Created Tennis Partnership: ${tennis1.name} & ${tennis2.name}`);

  const tennisPartnership2 = await prisma.partnership.create({
    data: {
      captainId: tennis3.id,
      partnerId: tennis4.id,
      seasonId: tennisSeason.id,
      divisionId: tennisDoublesDivision.id,
      status: PartnershipStatus.ACTIVE,
      pairRating: 1490,
    },
  });
  console.log(`   ✅ Created Tennis Partnership: ${tennis3.name} & ${tennis4.name}`);

  // Assign Tennis players to doubles division
  for (const player of tennisPlayers) {
    await prisma.divisionAssignment.create({
      data: {
        userId: player.id,
        divisionId: tennisDoublesDivision.id,
        assignedAt: new Date(),
      },
    });

    await prisma.userThread.create({
      data: {
        userId: player.id,
        threadId: tennisDoublesThread.id,
        role: "member",
      },
    });
  }

  // Create partnership standings for Tennis Doubles
  await prisma.divisionStanding.create({
    data: {
      divisionId: tennisDoublesDivision.id,
      seasonId: tennisSeason.id,
      partnershipId: tennisPartnership1.id,
      rank: 1,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      totalPoints: 0,
    },
  });
  await prisma.divisionStanding.create({
    data: {
      divisionId: tennisDoublesDivision.id,
      seasonId: tennisSeason.id,
      partnershipId: tennisPartnership2.id,
      rank: 2,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      totalPoints: 0,
    },
  });
  console.log(`   ✅ Created Tennis Doubles standings`);

  // =============================================
  // STEP 9: Create Padel League (Doubles)
  // =============================================
  console.log("\n📝 Step 9: Creating Padel League (Doubles)...\n");

  // Padel League
  const padelLeague = await prisma.league.create({
    data: {
      name: "Padel Test League",
      sportType: SportType.PADEL,
      gameType: GameType.DOUBLES,
      location: "Test City Padel Club",
      description: "Padel doubles league for feature testing",
      status: Statuses.ACTIVE,
    },
  });
  console.log(`   ✅ Created league: ${padelLeague.name}`);

  // Padel Season
  const padelSeason = await prisma.season.create({
    data: {
      name: "Padel Test Season",
      startDate: daysAgo(7),
      endDate: daysFromNow(30),
      status: SeasonStatus.ACTIVE,
      isActive: true,
      entryFee: new Decimal(0),
      leagues: { connect: { id: padelLeague.id } },
    },
  });
  console.log(`   ✅ Created season: ${padelSeason.name}`);

  // Padel Division
  const padelDivision = await prisma.division.create({
    data: {
      seasonId: padelSeason.id,
      leagueId: padelLeague.id,
      name: "Padel Doubles Division",
      description: "Padel doubles matches",
      level: DivisionLevel.INTERMEDIATE,
      gameType: GameType.DOUBLES,
      isActiveDivision: true,
    },
  });

  // Create thread for Padel Division
  const padelThread = await prisma.thread.create({
    data: {
      name: `${padelDivision.name} Chat`,
      isGroup: true,
      divisionId: padelDivision.id,
    },
  });
  console.log(`   ✅ Created Padel Division with chat thread`);

  // Get Padel players
  const padel1 = users["padel1"]!;
  const padel2 = users["padel2"]!;
  const padel3 = users["padel3"]!;
  const padel4 = users["padel4"]!;

  // Create Padel Partnerships
  const partnership1 = await prisma.partnership.create({
    data: {
      captainId: padel1.id,
      partnerId: padel2.id,
      seasonId: padelSeason.id,
      divisionId: padelDivision.id,
      status: PartnershipStatus.ACTIVE,
      pairRating: 1500,
    },
  });
  console.log(`   ✅ Created Partnership: ${padel1.name} & ${padel2.name}`);

  const partnership2 = await prisma.partnership.create({
    data: {
      captainId: padel3.id,
      partnerId: padel4.id,
      seasonId: padelSeason.id,
      divisionId: padelDivision.id,
      status: PartnershipStatus.ACTIVE,
      pairRating: 1480,
    },
  });
  console.log(`   ✅ Created Partnership: ${padel3.name} & ${padel4.name}`);

  // Assign Padel players to division
  const padelPlayers = [padel1, padel2, padel3, padel4];
  for (const player of padelPlayers) {
    await prisma.seasonMembership.create({
      data: {
        userId: player.id,
        seasonId: padelSeason.id,
        divisionId: padelDivision.id,
        status: MembershipStatus.ACTIVE,
        paymentStatus: PaymentStatus.COMPLETED,
        joinedAt: new Date(),
      },
    });

    await prisma.divisionAssignment.create({
      data: {
        userId: player.id,
        divisionId: padelDivision.id,
        assignedAt: new Date(),
      },
    });

    await prisma.userThread.create({
      data: {
        userId: player.id,
        threadId: padelThread.id,
        role: "member",
      },
    });

    console.log(`   ✅ Assigned ${player.name} to Padel Division`);
  }

  // Create partnership standings
  await prisma.divisionStanding.create({
    data: {
      divisionId: padelDivision.id,
      seasonId: padelSeason.id,
      partnershipId: partnership1.id,
      rank: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      totalPoints: 0,
    },
  });
  await prisma.divisionStanding.create({
    data: {
      divisionId: padelDivision.id,
      seasonId: padelSeason.id,
      partnershipId: partnership2.id,
      rank: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      totalPoints: 0,
    },
  });

  // Padel Match 1: COMPLETED DOUBLES (6-4, 4-6, 10-6 match tiebreak)
  const padelMatch1 = await prisma.match.create({
    data: {
      divisionId: padelDivision.id,
      leagueId: padelLeague.id,
      seasonId: padelSeason.id,
      sport: SportType.PADEL,
      matchType: MatchType.DOUBLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(3),
      location: "Padel Court 1",
      venue: "Padel Center",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: padel1.id,
      resultSubmittedById: padel1.id,
      resultSubmittedAt: daysAgo(3),
      resultConfirmedById: padel3.id,
      resultConfirmedAt: daysAgo(3),
      playerScore: 2,
      opponentScore: 1,
      set3Format: Set3Format.MATCH_TIEBREAK,
      notes: "Padel Doubles: COMPLETED with match tiebreak",
    },
  });

  // All 4 participants for doubles
  await prisma.matchParticipant.createMany({
    data: [
      {
        matchId: padelMatch1.id,
        userId: padel1.id,
        role: ParticipantRole.CREATOR,
        team: "team1",
        invitationStatus: InvitationStatus.ACCEPTED,
        didAttend: true,
      },
      {
        matchId: padelMatch1.id,
        userId: padel2.id,
        role: ParticipantRole.PARTNER,
        team: "team1",
        invitationStatus: InvitationStatus.ACCEPTED,
        didAttend: true,
      },
      {
        matchId: padelMatch1.id,
        userId: padel3.id,
        role: ParticipantRole.OPPONENT,
        team: "team2",
        invitationStatus: InvitationStatus.ACCEPTED,
        didAttend: true,
      },
      {
        matchId: padelMatch1.id,
        userId: padel4.id,
        role: ParticipantRole.OPPONENT,
        team: "team2",
        invitationStatus: InvitationStatus.ACCEPTED,
        didAttend: true,
      },
    ],
  });

  // Padel set scores
  await prisma.matchScore.createMany({
    data: [
      {
        matchId: padelMatch1.id,
        setNumber: 1,
        player1Games: 6,
        player2Games: 4,
        hasTiebreak: false,
      },
      {
        matchId: padelMatch1.id,
        setNumber: 2,
        player1Games: 4,
        player2Games: 6,
        hasTiebreak: false,
      },
      {
        matchId: padelMatch1.id,
        setNumber: 3,
        player1Games: 10,
        player2Games: 6,
        hasTiebreak: true,
        player1Tiebreak: 10,
        player2Tiebreak: 6,
        tiebreakType: TiebreakType.MATCH_10PT,
      },
    ],
  });

  // Match results for ALL 4 players in doubles
  await prisma.matchResult.createMany({
    data: [
      // Team 1 winners (padel1 & padel2)
      {
        matchId: padelMatch1.id,
        playerId: padel1.id,
        opponentId: padel3.id,
        sportType: SportType.PADEL,
        gameType: GameType.DOUBLES,
        isWin: true,
        matchPoints: 5,
        participationPoints: 1,
        setsWonPoints: 2,
        winBonusPoints: 2,
        margin: 4, // (6+4+10) - (4+6+6) = 20-16 = 4
        setsWon: 2,
        setsLost: 1,
        gamesWon: 20,
        gamesLost: 16,
        datePlayed: daysAgo(3),
        countsForStandings: true,
      },
      {
        matchId: padelMatch1.id,
        playerId: padel2.id,
        opponentId: padel3.id,
        sportType: SportType.PADEL,
        gameType: GameType.DOUBLES,
        isWin: true,
        matchPoints: 5,
        participationPoints: 1,
        setsWonPoints: 2,
        winBonusPoints: 2,
        margin: 4,
        setsWon: 2,
        setsLost: 1,
        gamesWon: 20,
        gamesLost: 16,
        datePlayed: daysAgo(3),
        countsForStandings: true,
      },
      // Team 2 losers (padel3 & padel4)
      {
        matchId: padelMatch1.id,
        playerId: padel3.id,
        opponentId: padel1.id,
        sportType: SportType.PADEL,
        gameType: GameType.DOUBLES,
        isWin: false,
        matchPoints: 2,
        participationPoints: 1,
        setsWonPoints: 1,
        winBonusPoints: 0,
        margin: -4,
        setsWon: 1,
        setsLost: 2,
        gamesWon: 16,
        gamesLost: 20,
        datePlayed: daysAgo(3),
        countsForStandings: true,
      },
      {
        matchId: padelMatch1.id,
        playerId: padel4.id,
        opponentId: padel1.id,
        sportType: SportType.PADEL,
        gameType: GameType.DOUBLES,
        isWin: false,
        matchPoints: 2,
        participationPoints: 1,
        setsWonPoints: 1,
        winBonusPoints: 0,
        margin: -4,
        setsWon: 1,
        setsLost: 2,
        gamesWon: 16,
        gamesLost: 20,
        datePlayed: daysAgo(3),
        countsForStandings: true,
      },
    ],
  });
  console.log(`   ✅ Padel Match 1: DOUBLES COMPLETED - ID: ${padelMatch1.id}`);

  // Update Padel standings (partnership-based)
  await prisma.divisionStanding.update({
    where: {
      divisionId_seasonId_partnershipId: {
        divisionId: padelDivision.id,
        seasonId: padelSeason.id,
        partnershipId: partnership1.id,
      },
    },
    data: { rank: 1, matchesPlayed: 1, wins: 1, losses: 0, totalPoints: 5 },
  });
  await prisma.divisionStanding.update({
    where: {
      divisionId_seasonId_partnershipId: {
        divisionId: padelDivision.id,
        seasonId: padelSeason.id,
        partnershipId: partnership2.id,
      },
    },
    data: { rank: 2, matchesPlayed: 1, wins: 0, losses: 1, totalPoints: 2 },
  });
  console.log(`   ✅ Updated Padel standings`);

  // =============================================
  // STEP 9b: Best 6 Testing - Add MORE matches to Division A
  // =============================================
  console.log("\n📝 Step 9b: Adding Best 6 edge case matches (7+ matches for Player1)...\n");

  // Best 6 System: Only top 6 match results count toward standings (max 30 points)
  // To test this, Player1 needs 7+ matches so we can verify the 7th doesn't count

  // Match 9: Player1 vs Player3 - COMPLETED (Player1 wins 2-0)
  const match9 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(6),
      location: "Test Court 1",
      venue: "Main Building",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: player1.id,
      resultSubmittedById: player1.id,
      resultSubmittedAt: daysAgo(6),
      resultConfirmedById: player3.id,
      resultConfirmedAt: daysAgo(6),
      playerScore: 2,
      opponentScore: 0,
      notes: "Match 9: Best 6 Test - Player1 win #3",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      { matchId: match9.id, userId: player1.id, role: ParticipantRole.CREATOR, team: "team1", invitationStatus: InvitationStatus.ACCEPTED, didAttend: true },
      { matchId: match9.id, userId: player3.id, role: ParticipantRole.OPPONENT, team: "team2", invitationStatus: InvitationStatus.ACCEPTED, didAttend: true },
    ],
  });

  await prisma.pickleballGameScore.createMany({
    data: [
      { matchId: match9.id, gameNumber: 1, player1Points: 15, player2Points: 7 },
      { matchId: match9.id, gameNumber: 2, player1Points: 15, player2Points: 9 },
    ],
  });

  await prisma.matchResult.createMany({
    data: [
      {
        matchId: match9.id, playerId: player1.id, opponentId: player3.id,
        sportType: SportType.PICKLEBALL, gameType: GameType.SINGLES,
        isWin: true, matchPoints: 5, participationPoints: 1, setsWonPoints: 2, winBonusPoints: 2,
        margin: 14, setsWon: 2, setsLost: 0, gamesWon: 30, gamesLost: 16,
        datePlayed: daysAgo(6), countsForStandings: true, resultSequence: 1,
      },
      {
        matchId: match9.id, playerId: player3.id, opponentId: player1.id,
        sportType: SportType.PICKLEBALL, gameType: GameType.SINGLES,
        isWin: false, matchPoints: 1, participationPoints: 1, setsWonPoints: 0, winBonusPoints: 0,
        margin: -14, setsWon: 0, setsLost: 2, gamesWon: 16, gamesLost: 30,
        datePlayed: daysAgo(6), countsForStandings: true, resultSequence: 1,
      },
    ],
  });
  console.log(`   ✅ Match 9: COMPLETED - Player1 win #3 - ID: ${match9.id}`);

  // Match 10: Player1 vs Player2 - COMPLETED (Player1 wins 2-1)
  const match10 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(7),
      location: "Test Court 2",
      venue: "Main Building",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: player1.id,
      resultSubmittedById: player1.id,
      resultSubmittedAt: daysAgo(7),
      resultConfirmedById: player2.id,
      resultConfirmedAt: daysAgo(7),
      playerScore: 2,
      opponentScore: 1,
      notes: "Match 10: Best 6 Test - Player1 win #4",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      { matchId: match10.id, userId: player1.id, role: ParticipantRole.CREATOR, team: "team1", invitationStatus: InvitationStatus.ACCEPTED, didAttend: true },
      { matchId: match10.id, userId: player2.id, role: ParticipantRole.OPPONENT, team: "team2", invitationStatus: InvitationStatus.ACCEPTED, didAttend: true },
    ],
  });

  await prisma.pickleballGameScore.createMany({
    data: [
      { matchId: match10.id, gameNumber: 1, player1Points: 15, player2Points: 11 },
      { matchId: match10.id, gameNumber: 2, player1Points: 10, player2Points: 15 },
      { matchId: match10.id, gameNumber: 3, player1Points: 15, player2Points: 13 },
    ],
  });

  await prisma.matchResult.createMany({
    data: [
      {
        matchId: match10.id, playerId: player1.id, opponentId: player2.id,
        sportType: SportType.PICKLEBALL, gameType: GameType.SINGLES,
        isWin: true, matchPoints: 5, participationPoints: 1, setsWonPoints: 2, winBonusPoints: 2,
        margin: 1, setsWon: 2, setsLost: 1, gamesWon: 40, gamesLost: 39,
        datePlayed: daysAgo(7), countsForStandings: true, resultSequence: 2,
      },
      {
        matchId: match10.id, playerId: player2.id, opponentId: player1.id,
        sportType: SportType.PICKLEBALL, gameType: GameType.SINGLES,
        isWin: false, matchPoints: 2, participationPoints: 1, setsWonPoints: 1, winBonusPoints: 0,
        margin: -1, setsWon: 1, setsLost: 2, gamesWon: 39, gamesLost: 40,
        datePlayed: daysAgo(7), countsForStandings: true, resultSequence: 2,
      },
    ],
  });
  console.log(`   ✅ Match 10: COMPLETED - Player1 win #4 - ID: ${match10.id}`);

  // Match 11: Player1 vs Player3 - COMPLETED (Player1 wins 2-0)
  const match11 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(8),
      location: "Test Court 1",
      venue: "Main Building",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: player3.id,
      resultSubmittedById: player3.id,
      resultSubmittedAt: daysAgo(8),
      resultConfirmedById: player1.id,
      resultConfirmedAt: daysAgo(8),
      playerScore: 0,
      opponentScore: 2,
      notes: "Match 11: Best 6 Test - Player1 win #5",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      { matchId: match11.id, userId: player3.id, role: ParticipantRole.CREATOR, team: "team1", invitationStatus: InvitationStatus.ACCEPTED, didAttend: true },
      { matchId: match11.id, userId: player1.id, role: ParticipantRole.OPPONENT, team: "team2", invitationStatus: InvitationStatus.ACCEPTED, didAttend: true },
    ],
  });

  await prisma.pickleballGameScore.createMany({
    data: [
      { matchId: match11.id, gameNumber: 1, player1Points: 8, player2Points: 15 },
      { matchId: match11.id, gameNumber: 2, player1Points: 6, player2Points: 15 },
    ],
  });

  await prisma.matchResult.createMany({
    data: [
      {
        matchId: match11.id, playerId: player1.id, opponentId: player3.id,
        sportType: SportType.PICKLEBALL, gameType: GameType.SINGLES,
        isWin: true, matchPoints: 5, participationPoints: 1, setsWonPoints: 2, winBonusPoints: 2,
        margin: 16, setsWon: 2, setsLost: 0, gamesWon: 30, gamesLost: 14,
        datePlayed: daysAgo(8), countsForStandings: true, resultSequence: 3,
      },
      {
        matchId: match11.id, playerId: player3.id, opponentId: player1.id,
        sportType: SportType.PICKLEBALL, gameType: GameType.SINGLES,
        isWin: false, matchPoints: 1, participationPoints: 1, setsWonPoints: 0, winBonusPoints: 0,
        margin: -16, setsWon: 0, setsLost: 2, gamesWon: 14, gamesLost: 30,
        datePlayed: daysAgo(8), countsForStandings: true, resultSequence: 3,
      },
    ],
  });
  console.log(`   ✅ Match 11: COMPLETED - Player1 win #5 - ID: ${match11.id}`);

  // Match 12: Player1 vs Player2 - COMPLETED (Player1 wins 2-0)
  const match12 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(9),
      location: "Test Court 2",
      venue: "Main Building",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: player2.id,
      resultSubmittedById: player2.id,
      resultSubmittedAt: daysAgo(9),
      resultConfirmedById: player1.id,
      resultConfirmedAt: daysAgo(9),
      playerScore: 0,
      opponentScore: 2,
      notes: "Match 12: Best 6 Test - Player1 win #6 (LAST COUNTED WIN)",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      { matchId: match12.id, userId: player2.id, role: ParticipantRole.CREATOR, team: "team1", invitationStatus: InvitationStatus.ACCEPTED, didAttend: true },
      { matchId: match12.id, userId: player1.id, role: ParticipantRole.OPPONENT, team: "team2", invitationStatus: InvitationStatus.ACCEPTED, didAttend: true },
    ],
  });

  await prisma.pickleballGameScore.createMany({
    data: [
      { matchId: match12.id, gameNumber: 1, player1Points: 9, player2Points: 15 },
      { matchId: match12.id, gameNumber: 2, player1Points: 7, player2Points: 15 },
    ],
  });

  await prisma.matchResult.createMany({
    data: [
      {
        matchId: match12.id, playerId: player1.id, opponentId: player2.id,
        sportType: SportType.PICKLEBALL, gameType: GameType.SINGLES,
        isWin: true, matchPoints: 5, participationPoints: 1, setsWonPoints: 2, winBonusPoints: 2,
        margin: 14, setsWon: 2, setsLost: 0, gamesWon: 30, gamesLost: 16,
        datePlayed: daysAgo(9), countsForStandings: true, resultSequence: 4,
      },
      {
        matchId: match12.id, playerId: player2.id, opponentId: player1.id,
        sportType: SportType.PICKLEBALL, gameType: GameType.SINGLES,
        isWin: false, matchPoints: 1, participationPoints: 1, setsWonPoints: 0, winBonusPoints: 0,
        margin: -14, setsWon: 0, setsLost: 2, gamesWon: 16, gamesLost: 30,
        datePlayed: daysAgo(9), countsForStandings: true, resultSequence: 4,
      },
    ],
  });
  console.log(`   ✅ Match 12: COMPLETED - Player1 win #6 (LAST COUNTED) - ID: ${match12.id}`);

  // Match 13: Player1 vs Player3 - COMPLETED (Player1 wins 2-1) - 7TH MATCH - SHOULD NOT COUNT
  const match13 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(10),
      location: "Test Court 1",
      venue: "Main Building",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: player1.id,
      resultSubmittedById: player1.id,
      resultSubmittedAt: daysAgo(10),
      resultConfirmedById: player3.id,
      resultConfirmedAt: daysAgo(10),
      playerScore: 2,
      opponentScore: 1,
      notes: "Match 13: Best 6 Test - Player1 win #7 (SHOULD NOT COUNT FOR STANDINGS)",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      { matchId: match13.id, userId: player1.id, role: ParticipantRole.CREATOR, team: "team1", invitationStatus: InvitationStatus.ACCEPTED, didAttend: true },
      { matchId: match13.id, userId: player3.id, role: ParticipantRole.OPPONENT, team: "team2", invitationStatus: InvitationStatus.ACCEPTED, didAttend: true },
    ],
  });

  await prisma.pickleballGameScore.createMany({
    data: [
      { matchId: match13.id, gameNumber: 1, player1Points: 15, player2Points: 11 },
      { matchId: match13.id, gameNumber: 2, player1Points: 12, player2Points: 15 },
      { matchId: match13.id, gameNumber: 3, player1Points: 15, player2Points: 10 },
    ],
  });

  await prisma.matchResult.createMany({
    data: [
      {
        matchId: match13.id, playerId: player1.id, opponentId: player3.id,
        sportType: SportType.PICKLEBALL, gameType: GameType.SINGLES,
        isWin: true, matchPoints: 5, participationPoints: 1, setsWonPoints: 2, winBonusPoints: 2,
        margin: 6, setsWon: 2, setsLost: 1, gamesWon: 42, gamesLost: 36,
        datePlayed: daysAgo(10), countsForStandings: false, resultSequence: 5, // 7th match - does not count!
      },
      {
        matchId: match13.id, playerId: player3.id, opponentId: player1.id,
        sportType: SportType.PICKLEBALL, gameType: GameType.SINGLES,
        isWin: false, matchPoints: 2, participationPoints: 1, setsWonPoints: 1, winBonusPoints: 0,
        margin: -6, setsWon: 1, setsLost: 2, gamesWon: 36, gamesLost: 42,
        datePlayed: daysAgo(10), countsForStandings: false, resultSequence: 5, // 7th match - does not count!
      },
    ],
  });
  console.log(`   ✅ Match 13: COMPLETED - Player1 win #7 (NOT COUNTED for Best 6) - ID: ${match13.id}`);

  // =============================================
  // STEP 9c: 24h Auto-Approval Test Case
  // =============================================
  console.log("\n📝 Step 9c: Adding 24h auto-approval test case...\n");

  // Match 14: ONGOING for > 24 hours - Should be auto-approved by cron job
  const match14 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.ONGOING,
      matchDate: hoursAgo(30),
      location: "Test Court 1",
      venue: "Main Building",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: player2.id,
      resultSubmittedById: player2.id,
      resultSubmittedAt: hoursAgo(26), // Submitted 26 hours ago, should be auto-approved
      playerScore: 2,
      opponentScore: 1,
      notes: "Match 14: 24h AUTO-APPROVAL TEST - Submitted 26 hours ago, should auto-approve",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      { matchId: match14.id, userId: player2.id, role: ParticipantRole.CREATOR, team: "team1", invitationStatus: InvitationStatus.ACCEPTED, didAttend: true },
      { matchId: match14.id, userId: player3.id, role: ParticipantRole.OPPONENT, team: "team2", invitationStatus: InvitationStatus.ACCEPTED, didAttend: true },
    ],
  });

  await prisma.pickleballGameScore.createMany({
    data: [
      { matchId: match14.id, gameNumber: 1, player1Points: 15, player2Points: 10 },
      { matchId: match14.id, gameNumber: 2, player1Points: 9, player2Points: 15 },
      { matchId: match14.id, gameNumber: 3, player1Points: 15, player2Points: 12 },
    ],
  });
  console.log(`   ✅ Match 14: ONGOING (24h+ auto-approval test) - ID: ${match14.id}`);

  // =============================================
  // STEP 9d: Tiebreaker Scenario
  // =============================================
  console.log("\n📝 Step 9d: Adding tiebreaker scenario (same points)...\n");

  // Create Match 15 & 16: Player2 and Player3 end up with SAME POINTS to test tiebreaker
  // Player2 already has some matches, let's add wins for Player3 so they tie

  // Match 15: Player3 vs Player2 - Player3 wins (gives Player3 5 points)
  const match15 = await prisma.match.create({
    data: {
      divisionId: divisionA.id,
      leagueId: league.id,
      seasonId: season.id,
      sport: SportType.PICKLEBALL,
      matchType: MatchType.SINGLES,
      format: MatchFormat.STANDARD,
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(4),
      location: "Test Court 2",
      venue: "Main Building",
      courtBooked: true,
      fee: MatchFeeType.FREE,
      createdById: player3.id,
      resultSubmittedById: player3.id,
      resultSubmittedAt: daysAgo(4),
      resultConfirmedById: player2.id,
      resultConfirmedAt: daysAgo(4),
      playerScore: 2,
      opponentScore: 0,
      notes: "Match 15: TIEBREAKER TEST - Player3 beats Player2",
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      { matchId: match15.id, userId: player3.id, role: ParticipantRole.CREATOR, team: "team1", invitationStatus: InvitationStatus.ACCEPTED, didAttend: true },
      { matchId: match15.id, userId: player2.id, role: ParticipantRole.OPPONENT, team: "team2", invitationStatus: InvitationStatus.ACCEPTED, didAttend: true },
    ],
  });

  await prisma.pickleballGameScore.createMany({
    data: [
      { matchId: match15.id, gameNumber: 1, player1Points: 15, player2Points: 10 },
      { matchId: match15.id, gameNumber: 2, player1Points: 15, player2Points: 8 },
    ],
  });

  await prisma.matchResult.createMany({
    data: [
      {
        matchId: match15.id, playerId: player3.id, opponentId: player2.id,
        sportType: SportType.PICKLEBALL, gameType: GameType.SINGLES,
        isWin: true, matchPoints: 5, participationPoints: 1, setsWonPoints: 2, winBonusPoints: 2,
        margin: 12, setsWon: 2, setsLost: 0, gamesWon: 30, gamesLost: 18,
        datePlayed: daysAgo(4), countsForStandings: true, resultSequence: 6,
      },
      {
        matchId: match15.id, playerId: player2.id, opponentId: player3.id,
        sportType: SportType.PICKLEBALL, gameType: GameType.SINGLES,
        isWin: false, matchPoints: 1, participationPoints: 1, setsWonPoints: 0, winBonusPoints: 0,
        margin: -12, setsWon: 0, setsLost: 2, gamesWon: 18, gamesLost: 30,
        datePlayed: daysAgo(4), countsForStandings: true, resultSequence: 6,
      },
    ],
  });
  console.log(`   ✅ Match 15: TIEBREAKER TEST - Player3 beats Player2 - ID: ${match15.id}`);

  // =============================================
  // STEP 9e: Update Final Standings with Best 6 Calculation
  // =============================================
  console.log("\n📝 Step 9e: Updating final standings with Best 6 calculation...\n");

  // BEST 6 STANDINGS CALCULATION:
  // Player1: 7 matches total (wins from Match 3,9,10,11,12,13 + walkover 5)
  //   - 6 wins count: 5+5+5+5+5+5 = 30 points (MAX)
  //   - 7th win (Match 13) does NOT count
  //   - Total matches: 7, Wins: 7, Losses: 0
  //
  // Player2: Matches 3,4,10,12,15 (losses: 3,10,12,15, win: 4)
  //   - Win Match 4: 5 pts
  //   - Loss Match 3: 1 pt, Loss Match 10: 2 pts, Loss Match 12: 1 pt, Loss Match 15: 1 pt
  //   - Best 6: 5 + 2 + 1 + 1 + 1 = 10 pts (only 5 matches, all count)
  //   - Total matches: 5, Wins: 1, Losses: 4
  //
  // Player3: Matches 4,5,9,11,13,15 (losses: 4,5,9,11,13, win: 15)
  //   - Win Match 15: 5 pts
  //   - Loss Match 4: 2 pts, Loss Match 5: 1 pt, Loss Match 9: 1 pt, Loss Match 11: 1 pt, Loss Match 13: 2 pts
  //   - Best 6: 5 + 2 + 2 + 1 + 1 + 1 = 12 pts (6 matches, all count)
  //   - Total matches: 6, Wins: 1, Losses: 5
  //
  // TIEBREAKER: Player2 (10 pts) vs Player3 (12 pts) - NO TIE, Player3 is ahead
  // But for H2H tiebreaker test: Player3 beat Player2 in Match 15

  await prisma.divisionStanding.update({
    where: {
      divisionId_seasonId_userId: {
        divisionId: divisionA.id,
        seasonId: season.id,
        userId: player1.id,
      },
    },
    data: {
      rank: 1,
      matchesPlayed: 7,  // All 7 matches
      wins: 7,
      losses: 0,
      totalPoints: 30,   // Best 6 wins = 6 x 5 = 30 (MAX)
    },
  });

  await prisma.divisionStanding.update({
    where: {
      divisionId_seasonId_userId: {
        divisionId: divisionA.id,
        seasonId: season.id,
        userId: player3.id,  // Player3 ahead of Player2 due to more points
      },
    },
    data: {
      rank: 2,
      matchesPlayed: 6,
      wins: 1,
      losses: 5,
      totalPoints: 12,   // 5 + 2 + 2 + 1 + 1 + 1 = 12
    },
  });

  await prisma.divisionStanding.update({
    where: {
      divisionId_seasonId_userId: {
        divisionId: divisionA.id,
        seasonId: season.id,
        userId: player2.id,
      },
    },
    data: {
      rank: 3,
      matchesPlayed: 5,
      wins: 1,
      losses: 4,
      totalPoints: 10,   // 5 + 2 + 1 + 1 + 1 = 10
    },
  });
  console.log(`   ✅ Updated Division A standings with Best 6 calculation`);
  console.log(`      Player1: 30 pts (7W-0L, Best 6 MAX)`);
  console.log(`      Player3: 12 pts (1W-5L)`);
  console.log(`      Player2: 10 pts (1W-4L)`);

  // =============================================
  // STEP 9f: Add Friendly Match Request Message
  // =============================================
  console.log("\n📝 Step 9f: Adding friendly match request to chat...\n");

  // Create a friendly match invitation message (common chat pattern)
  await prisma.message.create({
    data: {
      threadId: threadA.id,
      senderId: player3.id,
      content: "Anyone up for a friendly match this Saturday? Looking to practice before the next league match!",
      messageType: MessageType.TEXT,
      createdAt: hoursAgo(4),
    },
  });

  await prisma.message.create({
    data: {
      threadId: threadA.id,
      senderId: player1.id,
      content: "I'm in! What time works for you?",
      messageType: MessageType.TEXT,
      createdAt: hoursAgo(3),
    },
  });

  await prisma.message.create({
    data: {
      threadId: threadA.id,
      senderId: player3.id,
      content: "How about 10 AM at the main courts?",
      messageType: MessageType.TEXT,
      createdAt: hoursAgo(2),
    },
  });
  console.log(`   ✅ Added friendly match request conversation to Division A chat`);

  // =============================================
  // STEP 10: Create Pickleball Doubles Division
  // =============================================
  console.log("\n📝 Step 10: Adding Pickleball Doubles Division...\n");

  // Create Pickleball Doubles Division under existing league
  const pickleballDoublesDivision = await prisma.division.create({
    data: {
      seasonId: season.id,
      leagueId: league.id,
      name: "Pickleball Doubles Division",
      description: "For doubles play",
      level: DivisionLevel.BEGINNER,
      gameType: GameType.DOUBLES,
      isActiveDivision: true,
    },
  });

  const pickleballDoublesThread = await prisma.thread.create({
    data: {
      name: `${pickleballDoublesDivision.name} Chat`,
      isGroup: true,
      divisionId: pickleballDoublesDivision.id,
    },
  });
  console.log(`   ✅ Created Pickleball Doubles Division`);

  // Create Pickleball partnerships (reuse players 4-6 for doubles)
  const player4 = users["player4"]!;
  const player5 = users["player5"]!;
  const player6 = users["player6"]!;

  const pickleballPartnership = await prisma.partnership.create({
    data: {
      captainId: player4.id,
      partnerId: player5.id,
      seasonId: season.id,
      divisionId: pickleballDoublesDivision.id,
      status: PartnershipStatus.ACTIVE,
      pairRating: 1200,
    },
  });
  console.log(`   ✅ Created Pickleball Partnership: ${player4.name} & ${player5.name}`);

  // Assign to doubles division
  for (const player of [player4, player5]) {
    await prisma.divisionAssignment.create({
      data: {
        userId: player.id,
        divisionId: pickleballDoublesDivision.id,
        assignedAt: new Date(),
      },
    });

    await prisma.userThread.create({
      data: {
        userId: player.id,
        threadId: pickleballDoublesThread.id,
        role: "member",
      },
    });
  }

  await prisma.divisionStanding.create({
    data: {
      divisionId: pickleballDoublesDivision.id,
      seasonId: season.id,
      partnershipId: pickleballPartnership.id,
      rank: 1,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      totalPoints: 0,
    },
  });
  console.log(`   ✅ Assigned players to Pickleball Doubles`);

  // =============================================
  // STEP 11: Create Direct Chats for recentSportContext Testing
  // =============================================
  console.log("\n📝 Step 11: Creating direct chats for recentSportContext testing...\n");

  // The recentSportContext feature determines unread badge colors in the chat list:
  // - Purple dot = recent Pickleball interaction
  // - Green dot = recent Tennis interaction
  // - Blue dot = recent Padel interaction
  // - Gray dot = no sport context or > 60 days old
  //
  // Context is updated when users:
  // 1. Play a recorded match together (resultSubmittedAt not null)
  // 2. Create/accept a match together (both ACCEPTED)
  // 3. Send friendly match request (isFriendlyRequest: true)

  // Direct Chat 1: player1 ↔ player2 (PICKLEBALL context - they played matches together)
  // They already played Match 3 (COMPLETED) - so this should show PURPLE unread dot
  const dmThread1 = await prisma.thread.create({
    data: {
      name: null, // DMs don't have names
      isGroup: false,
      divisionId: null, // Not a division chat
    },
  });

  await prisma.userThread.createMany({
    data: [
      { threadId: dmThread1.id, userId: player1.id, role: "member", unreadCount: 0 },
      { threadId: dmThread1.id, userId: player2.id, role: "member", unreadCount: 2 }, // Player2 has unread
    ],
  });

  // Messages in DM - player1 sends, player2 hasn't read
  await prisma.message.create({
    data: {
      threadId: dmThread1.id,
      senderId: player1.id,
      content: "Good game yesterday! Want a rematch?",
      messageType: MessageType.TEXT,
      createdAt: hoursAgo(5),
    },
  });

  await prisma.message.create({
    data: {
      threadId: dmThread1.id,
      senderId: player1.id,
      content: "I'm free this Saturday afternoon",
      messageType: MessageType.TEXT,
      createdAt: hoursAgo(4),
    },
  });
  console.log(`   ✅ DM 1: player1 ↔ player2 (PICKLEBALL context, 2 unread for player2)`);

  // Direct Chat 2: tennis1 ↔ tennis2 (TENNIS context - they played Tennis Match 1)
  const dmThread2 = await prisma.thread.create({
    data: {
      name: null,
      isGroup: false,
      divisionId: null,
    },
  });

  await prisma.userThread.createMany({
    data: [
      { threadId: dmThread2.id, userId: tennis1.id, role: "member", unreadCount: 1 }, // Tennis1 has unread
      { threadId: dmThread2.id, userId: tennis2.id, role: "member", unreadCount: 0 },
    ],
  });

  await prisma.message.create({
    data: {
      threadId: dmThread2.id,
      senderId: tennis2.id,
      content: "Great match! Your serve has really improved.",
      messageType: MessageType.TEXT,
      createdAt: hoursAgo(3),
    },
  });
  console.log(`   ✅ DM 2: tennis1 ↔ tennis2 (TENNIS context, 1 unread for tennis1)`);

  // Direct Chat 3: padel1 ↔ padel3 (PADEL context - they played Padel Match 1)
  const dmThread3 = await prisma.thread.create({
    data: {
      name: null,
      isGroup: false,
      divisionId: null,
    },
  });

  await prisma.userThread.createMany({
    data: [
      { threadId: dmThread3.id, userId: padel1.id, role: "member", unreadCount: 0 },
      { threadId: dmThread3.id, userId: padel3.id, role: "member", unreadCount: 3 }, // Padel3 has unread
    ],
  });

  await prisma.message.createMany({
    data: [
      {
        threadId: dmThread3.id,
        senderId: padel1.id,
        content: "That was a close match!",
        messageType: MessageType.TEXT,
        createdAt: hoursAgo(6),
      },
      {
        threadId: dmThread3.id,
        senderId: padel1.id,
        content: "Want to practice doubles positioning this week?",
        messageType: MessageType.TEXT,
        createdAt: hoursAgo(5),
      },
      {
        threadId: dmThread3.id,
        senderId: padel1.id,
        content: "I booked court 3 for Thursday 6pm",
        messageType: MessageType.TEXT,
        createdAt: hoursAgo(4),
      },
    ],
  });
  console.log(`   ✅ DM 3: padel1 ↔ padel3 (PADEL context, 3 unread for padel3)`);

  // Direct Chat 4: player1 ↔ player6 (NO CONTEXT - never played together)
  // This should show GRAY unread dot
  const dmThread4 = await prisma.thread.create({
    data: {
      name: null,
      isGroup: false,
      divisionId: null,
    },
  });

  await prisma.userThread.createMany({
    data: [
      { threadId: dmThread4.id, userId: player1.id, role: "member", unreadCount: 1 },
      { threadId: dmThread4.id, userId: player6.id, role: "member", unreadCount: 0 },
    ],
  });

  await prisma.message.create({
    data: {
      threadId: dmThread4.id,
      senderId: player6.id,
      content: "Hey! Are you in the beginner division too?",
      messageType: MessageType.TEXT,
      createdAt: hoursAgo(2),
    },
  });
  console.log(`   ✅ DM 4: player1 ↔ player6 (NO context - gray dot, 1 unread for player1)`);

  // Direct Chat 5: Cross-sport scenario - tennis1 ↔ player1
  // They have NOT played together, so should show GRAY
  const dmThread5 = await prisma.thread.create({
    data: {
      name: null,
      isGroup: false,
      divisionId: null,
    },
  });

  await prisma.userThread.createMany({
    data: [
      { threadId: dmThread5.id, userId: tennis1.id, role: "member", unreadCount: 0 },
      { threadId: dmThread5.id, userId: player1.id, role: "member", unreadCount: 1 },
    ],
  });

  await prisma.message.create({
    data: {
      threadId: dmThread5.id,
      senderId: tennis1.id,
      content: "Heard you're good at pickleball. Want to try tennis sometime?",
      messageType: MessageType.TEXT,
      createdAt: hoursAgo(1),
    },
  });
  console.log(`   ✅ DM 5: tennis1 ↔ player1 (NO shared match - gray dot)`);

  console.log("\n   📊 recentSportContext Test Summary:");
  console.log("   ┌─────────────────────────────────────────────────────────────┐");
  console.log("   │ DM Thread      │ Users              │ Expected Dot Color   │");
  console.log("   ├─────────────────────────────────────────────────────────────┤");
  console.log("   │ DM 1           │ player1 ↔ player2  │ 🟣 PURPLE (Pickleball)│");
  console.log("   │ DM 2           │ tennis1 ↔ tennis2  │ 🟢 GREEN (Tennis)     │");
  console.log("   │ DM 3           │ padel1 ↔ padel3    │ 🔵 BLUE (Padel)       │");
  console.log("   │ DM 4           │ player1 ↔ player6  │ ⚪ GRAY (No context)  │");
  console.log("   │ DM 5           │ tennis1 ↔ player1  │ ⚪ GRAY (No context)  │");
  console.log("   └─────────────────────────────────────────────────────────────┘");

  // =============================================
  // PRINT SUMMARY
  // =============================================
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║              COMPREHENSIVE FEATURE TEST SEEDING COMPLETE!                ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════╣");
  console.log("║  TEST ACCOUNTS (Password: Test@123)                                      ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════╣");
  console.log("║  PICKLEBALL SINGLES:                                                     ║");
  console.log("║  • player1@test.com - Rank 1 (30 pts, 7W-0L, Best 6 MAX)                ║");
  console.log("║  • player3@test.com - Rank 2 (12 pts, 1W-5L, H2H over player2)          ║");
  console.log("║  • player2@test.com - Rank 3 (10 pts, 1W-4L)                            ║");
  console.log("║                                                                          ║");
  console.log("║  PICKLEBALL DOUBLES:                                                     ║");
  console.log("║  • player4@test.com + player5@test.com = Partnership                    ║");
  console.log("║  • player6@test.com (Available for pairing)                             ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════╣");
  console.log("║  TENNIS (Singles & Doubles):                                            ║");
  console.log("║  • tennis1@test.com (Singles Rank 1 + Doubles with tennis2)             ║");
  console.log("║  • tennis2@test.com (Singles Rank 3 + Doubles with tennis1)             ║");
  console.log("║  • tennis3@test.com (Singles Rank 2 + Doubles with tennis4)             ║");
  console.log("║  • tennis4@test.com (Singles Rank 4 + Doubles with tennis3)             ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════╣");
  console.log("║  PADEL (Doubles Only):                                                  ║");
  console.log("║  • padel1@test.com + padel2@test.com = Team 1 (Rank 1)                  ║");
  console.log("║  • padel3@test.com + padel4@test.com = Team 2 (Rank 2)                  ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════╣");
  console.log("║  ADMIN: testadmin@test.com (Can resolve disputes)                       ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════╣");
  console.log("║                                                                          ║");
  console.log("║  LEAGUES & MATCHES CREATED:                                             ║");
  console.log("║  ────────────────────────────────────────────────────────────────────   ║");
  console.log("║  1. Feature Test League (Pickleball)                                    ║");
  console.log("║     ├── Beginner Division (Singles): 15 matches                         ║");
  console.log("║     │   • SCHEDULED (open): Match 1                                     ║");
  console.log("║     │   • SCHEDULED (full): Match 2                                     ║");
  console.log("║     │   • COMPLETED: Match 3,4,9,10,11,12,13,15                         ║");
  console.log("║     │   • WALKOVER: Match 5                                             ║");
  console.log("║     │   • ONGOING (fresh): Match 6                                      ║");
  console.log("║     │   • ONGOING (24h+): Match 14 - Auto-approval test                 ║");
  console.log("║     │   • CANCELLED: Match 7                                            ║");
  console.log("║     │   • DRAFT: Match 8                                                ║");
  console.log("║     └── Doubles Division: Partnership ready                             ║");
  console.log("║                                                                          ║");
  console.log("║  2. Tennis Test League                                                  ║");
  console.log("║     ├── Singles Division: 3 matches (incl. tiebreaks + DISPUTED)        ║");
  console.log("║     └── Doubles Division: 2 partnerships ready                          ║");
  console.log("║                                                                          ║");
  console.log("║  3. Padel Test League (Doubles)                                         ║");
  console.log("║     └── 1 completed doubles match with partnerships                     ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════╣");
  console.log("║                                                                          ║");
  console.log("║  SPECIAL SCENARIOS FOR TESTING:                                         ║");
  console.log("║  ────────────────────────────────────────────────────────────────────   ║");
  console.log("║  📊 BEST 6 ALGORITHM:                                                   ║");
  console.log("║     • Player1 has 7 wins, only 6 count (30 pts MAX)                     ║");
  console.log("║     • Match 13 has countsForStandings: false                            ║");
  console.log("║                                                                          ║");
  console.log("║  🏆 TIEBREAKER SCENARIO:                                                ║");
  console.log("║     • Player3 vs Player2 H2H: Player3 wins (Match 15)                   ║");
  console.log("║     • Player3: 12 pts, Player2: 10 pts                                  ║");
  console.log("║                                                                          ║");
  console.log("║  ⏰ 24h AUTO-APPROVAL:                                                  ║");
  console.log("║     • Match 14: ONGOING with resultSubmittedAt 26 hours ago             ║");
  console.log("║     • Should be auto-approved by cron job                               ║");
  console.log("║                                                                          ║");
  console.log("║  ⚠️  DISPUTE: Tennis Match 3 - Score disagreement (OPEN)                ║");
  console.log("║  🚶 WALKOVER: Pickleball Match 5 - No-show scenario                     ║");
  console.log("║  ⏳ PENDING: Pickleball Match 6 - Awaiting confirmation                 ║");
  console.log("║  🎾 TIEBREAK: Tennis Match 2 - 7-6(5), 3-6, 10-7                        ║");
  console.log("║  👥 DOUBLES: Padel + Tennis + Pickleball with partnerships              ║");
  console.log("║  💬 CHAT: Messages, MATCH posts, replies, friendly match requests       ║");
  console.log("║  🔵 UNREAD DOT COLOR: 5 DM threads testing recentSportContext          ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════╣");
  console.log("║                                                                          ║");
  console.log("║  HOW TO TEST:                                                           ║");
  console.log("║  ────────────────────────────────────────────────────────────────────   ║");
  console.log("║  1. Login as player1@test.com - Test Best 6, Standings, Chat            ║");
  console.log("║  2. Login as player2@test.com - Test joining matches, confirming        ║");
  console.log("║  3. Login as player3@test.com - Test disputing, H2H tiebreaker          ║");
  console.log("║  4. Login as tennis1@test.com - View disputed match, tiebreaks          ║");
  console.log("║  5. Login as padel1@test.com - Test doubles/partnership flow            ║");
  console.log("║  6. Login as testadmin@test.com - Resolve disputes                      ║");
  console.log("║                                                                          ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝");
  console.log("\n");
}

// =============================================
// RUN SEED
// =============================================

seedFeatureTests()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
