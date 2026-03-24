/**
 * Main Database Seeding Orchestrator
 *
 * Supports 3 seed modes via SEED_MODE environment variable:
 *
 *   SEED_MODE=essential  →  Production bootstrap (superadmin, achievements, system config)
 *   SEED_MODE=dev        →  Essential + team accounts + one test league
 *   SEED_MODE=full       →  Everything (500 users, 2500 matches, full demo environment)
 *
 * Usage:
 *   SEED_MODE=essential npx prisma db seed
 *   SEED_MODE=dev npx prisma db seed
 *   npx prisma db seed                       # defaults to full
 *
 * Or run directly:
 *   SEED_MODE=essential npx tsx prisma/seeds/seed.ts
 *
 * ─────────────────────────────────────────────────────────────────
 * Mode Comparison:
 * ─────────────────────────────────────────────────────────────────
 * Layer              │ essential │ dev  │ full
 * ───────────────────┼───────────┼──────┼──────
 * Superadmin account │    ✓      │  ✓   │  ✓
 * Admin accounts     │    ✓      │  ✓   │  ✓
 * Achievements (30)  │    ✓      │  ✓   │  ✓
 * System config      │    ✓      │  ✓   │  ✓
 * Team accounts      │           │  ✓   │  ✓
 * Test league/season │           │  ✓   │  ✓
 * 500 users          │           │      │  ✓
 * 15 leagues         │           │      │  ✓
 * 2500+ matches      │           │      │  ✓
 * Disputes/penalties │           │      │  ✓
 * Ratings/standings  │           │      │  ✓
 * Social/chat/feed   │           │      │  ✓
 * Bug reports        │           │      │  ✓
 * Brackets/audit     │           │      │  ✓
 * ─────────────────────────────────────────────────────────────────
 */

import { prisma, logSection, logSuccess, logProgress, logWarning } from "./utils";

// ─── Essential seeds (always run) ───
import { seedAchievements, seedUserAchievements } from "./achievements.seed";
import { seedSystemData } from "./system.seed";

// ─── Full seeds (only in full mode) ───
import { seedAdmins, seedUsers, seedAdminInviteTokens, seedNotificationPreferences, seedUserPushTokens, seedUserSettings } from "./users.seed";
import { seedLeaguesAndSeasons, seedCategories, seedSponsorships, seedSeasonMemberships, seedPartnerships, seedPromoCodes, seedWaitlists, seedInactivitySettings, seedSeasonLocks, seedPairRequests, seedSeasonInvitations, seedPayments } from "./leagues.seed";
import { seedMatches, seedFriendlyMatches, seedMatchResults, seedPickleballGameScores, seedMatchInvitations, seedMatchAdminActions, seedMatchComments } from "./matches.seed";
import { seedSocialFeatures } from "./social.seed";
import { seedDisputesAndPenalties, seedDisputeAdminNotes, seedDisputeComments } from "./disputes.seed";
import { seedRatingsAndStandings, seedRatingParameters } from "./ratings.seed";
import { seedDMRRatings } from "./dmr-ratings.seed";
import { seedBugsAndFeedback, seedBugComments, seedBugStatusChanges, seedBugReportSettings } from "./bugs.seed";
import { seedAdminActivityLogs, seedAdminMessageLogs } from "./admin-logs.seed";
import { seedStandings } from "./standings.seed";
import { seedFeed } from "./feed.seed";
import { seedBrackets } from "./brackets.seed";
import { seedAuditTrails } from "./audit.seed";

// ─── Seed mode detection ───
type SeedMode = "essential" | "dev" | "full";

function getSeedMode(): SeedMode {
  const mode = process.env.SEED_MODE?.toLowerCase();
  if (mode === "essential" || mode === "dev" || mode === "full") return mode;
  if (mode) {
    console.warn(`⚠️  Unknown SEED_MODE "${mode}". Valid: essential, dev, full. Defaulting to full.`);
  }
  return "full";
}

// =============================================
// PHASE: ESSENTIAL — Production bootstrap
// =============================================
async function seedEssential() {
  logSection("═══ ESSENTIAL: Superadmin Account ═══");

  // Import and run superadmin seed inline (it's a standalone script)
  const { PrismaClient, AdminStatus } = await import("@prisma/client");
  const { hashPassword } = await import("better-auth/crypto");

  const SUPERADMIN_CONFIG = {
    name: "Super Admin",
    email: "superadmin@dleague.com",
    username: "superadmin",
    password: "Admin@123",
  };

  const hashedPassword = await hashPassword(SUPERADMIN_CONFIG.password);

  const existingUser = await prisma.user.findUnique({
    where: { email: SUPERADMIN_CONFIG.email },
    include: { admin: true, accounts: true },
  });

  if (!existingUser) {
    const user = await prisma.user.create({
      data: {
        name: SUPERADMIN_CONFIG.name,
        email: SUPERADMIN_CONFIG.email,
        username: SUPERADMIN_CONFIG.username,
        displayUsername: SUPERADMIN_CONFIG.name,
        emailVerified: true,
        role: "SUPERADMIN",
        completedOnboarding: true,
      },
    });

    await prisma.admin.create({
      data: { userId: user.id, status: AdminStatus.ACTIVE },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    logSuccess("Superadmin created: superadmin@dleague.com / Admin@123");
  } else {
    logWarning("Superadmin already exists, skipping");
  }

  logSection("═══ ESSENTIAL: Admin Accounts ═══");
  const admins = await seedAdmins();

  logSection("═══ ESSENTIAL: Achievement Definitions ═══");
  await seedAchievements();

  logSection("═══ ESSENTIAL: System Configuration ═══");
  await seedSystemData();

  return { admins };
}

// =============================================
// PHASE: DEV — Team accounts + test league
// =============================================
async function seedDev(_admins: any[]) {
  logSection("═══ DEV: Team Test Accounts ═══");

  try {
    const { execSync } = await import("child_process");
    execSync("npx tsx prisma/seeds/seed-test-team.ts", { stdio: "inherit", cwd: "/app" });
    logSuccess("Team accounts seeded");
  } catch (error) {
    logWarning("Team seed had errors (non-blocking). Some team accounts may be missing.");
  }

  logSection("═══ DEV: Quick Test League ═══");

  try {
    const { execSync } = await import("child_process");
    execSync("npx tsx prisma/seeds/createSingleSeason.ts", { stdio: "inherit", cwd: "/app" });
    logSuccess("Test league/season created");
  } catch (error) {
    logWarning("Test league seed had errors (non-blocking).");
  }
}

// =============================================
// PHASE: FULL — Complete demo environment
// =============================================
async function seedFull(admins: any[]) {
  // Phase 1: Users
  logSection("═══ FULL: Users ═══");
  const users = await seedUsers();
  await seedAdminInviteTokens(admins);
  await seedNotificationPreferences(users);
  await seedUserPushTokens(users);
  await seedUserSettings(users);

  // Phase 2: Leagues, Seasons, Divisions
  logSection("═══ FULL: Leagues & Seasons ═══");
  const categories = await seedCategories();
  const adminId = admins.length > 0 ? admins[0].adminId : undefined;
  const sponsorships = await seedSponsorships(adminId);
  const { leagues, seasons, divisions } = await seedLeaguesAndSeasons(adminId!, categories, sponsorships);
  await seedSeasonMemberships(users, seasons, divisions);
  await seedPartnerships(seasons, divisions);
  await seedPromoCodes(seasons);
  await seedWaitlists(seasons, users);
  await seedInactivitySettings(leagues, seasons, adminId!);
  await seedSeasonLocks(seasons, adminId!);
  await seedPairRequests(seasons, users);
  await seedSeasonInvitations(seasons, users);
  await seedPayments(seasons, users);

  // Phase 3: Matches
  logSection("═══ FULL: Matches ═══");
  const leagueMatches = await seedMatches(users, divisions, seasons, admins);
  const friendlyMatches = await seedFriendlyMatches(users, leagues);
  const allMatches = [...leagueMatches, ...friendlyMatches];
  await seedMatchResults(allMatches, users);
  await seedPickleballGameScores(allMatches);
  await seedMatchInvitations(allMatches, users);
  await seedMatchAdminActions(allMatches, admins);
  await seedMatchComments(allMatches, users);

  // Phase 4: Social
  logSection("═══ FULL: Social Features ═══");
  const adminUserRecords = await prisma.user.findMany({
    where: { id: { in: admins.map((a: any) => a.userId) } },
  });
  await seedSocialFeatures([...users, ...adminUserRecords]);

  // Phase 5: Disputes
  logSection("═══ FULL: Disputes & Penalties ═══");
  await seedDisputesAndPenalties(users, admins);
  await seedDisputeAdminNotes(admins);
  await seedDisputeComments(users);

  // Phase 6: DMR Ratings
  logSection("═══ FULL: DMR Rating Processing ═══");
  await seedDMRRatings();

  // Phase 7: Rating Admin Data
  logSection("═══ FULL: Rating Admin Data ═══");
  await seedRatingsAndStandings(users, admins);
  await seedRatingParameters(leagues, seasons, admins);

  // Phase 8: Bug Reports
  logSection("═══ FULL: Bug Reports ═══");
  await seedBugsAndFeedback(users, admins);
  await seedBugComments(users, admins);
  await seedBugStatusChanges(admins);
  await seedBugReportSettings(admins);

  // Phase 9: Admin Logs
  logSection("═══ FULL: Admin Activity Logs ═══");
  await seedAdminActivityLogs(admins);
  await seedAdminMessageLogs(admins);

  // Phase 10: User Achievements
  logSection("═══ FULL: User Achievements ═══");
  await seedUserAchievements();

  // Phase 11: Standings
  logSection("═══ FULL: Division Standings ═══");
  await seedStandings();

  // Phase 12: Feed
  logSection("═══ FULL: Activity Feed ═══");
  await seedFeed();

  // Phase 13: Brackets
  logSection("═══ FULL: Tournament Brackets ═══");
  await seedBrackets();

  // Phase 14: Audit
  logSection("═══ FULL: Audit Trails ═══");
  await seedAuditTrails(users, admins);
}

// =============================================
// MAIN
// =============================================
async function main() {
  const mode = getSeedMode();

  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log(`║           DEUCE LEAGUE DATABASE SEEDING                      ║`);
  console.log(`║           Mode: ${mode.toUpperCase().padEnd(43)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("\n");

  const startTime = Date.now();

  try {
    // Always run essential
    const { admins } = await seedEssential();

    // Dev mode: essential + team + test league
    if (mode === "dev" || mode === "full") {
      await seedDev(admins);
    }

    // Full mode: everything
    if (mode === "full") {
      await seedFull(admins);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║                    SEEDING COMPLETE!                         ║");
    console.log(`║  Mode: ${mode.toUpperCase().padEnd(53)}║`);
    console.log(`║  Duration: ${duration}s${" ".repeat(Math.max(0, 49 - duration.length))}║`);
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log("║  CREDENTIALS:                                               ║");
    console.log("║  • superadmin@dleague.com / Admin@123 (SUPERADMIN)          ║");
    if (mode === "full") {
      console.log("║  • admin@dleague.com / Admin@123 (ADMIN)                    ║");
      console.log("║  • Any user: [username]@test.com / Test@123                 ║");
    }
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log("\n");

  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    throw error;
  }
}

// =============================================
// RUN
// =============================================
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
