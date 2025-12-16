/**
 * Main Database Seeding Orchestrator
 *
 * This is the entry point for database seeding. It orchestrates all seed modules
 * in the correct order to ensure data dependencies are satisfied.
 *
 * Run with: npx prisma db seed
 * Or: npx tsx prisma/seeds/seed.ts
 *
 * Data Summary:
 * - 500 users + 10 admins
 * - 15 leagues, 60 seasons, 150+ divisions
 * - 2,500+ league matches + 200 friendly matches
 * - 300 friendships, 150+ chats, 1500+ notifications
 * - 180 disputes, 100 penalties, 150 walkovers
 * - 500+ user ratings, standings for all divisions
 * - 75 bug reports, 40 feature requests
 *
 * All data is spread over 12 months for realistic time-series charts.
 */

import { prisma, logSection, logSuccess, logProgress, logWarning } from "./utils";
import { seedAdmins, seedUsers, seedAdminInviteTokens, seedNotificationPreferences, seedUserPushTokens } from "./users.seed";
import { seedLeaguesAndSeasons, seedCategories, seedSponsorships, seedSeasonMemberships, seedPromoCodes, seedWaitlists, seedInactivitySettings, seedSeasonLocks } from "./leagues.seed";
import { seedMatches, seedFriendlyMatches, seedMatchResults, seedPickleballGameScores, seedMatchInvitations, seedMatchAdminActions } from "./matches.seed";
import { seedSocialFeatures } from "./social.seed";
import { seedDisputesAndPenalties } from "./disputes.seed";
import { seedRatingsAndStandings } from "./ratings.seed";
import { seedDMRRatings } from "./dmr-ratings.seed";
import { seedBugsAndFeedback } from "./bugs.seed";
import { seedAdminActivityLogs } from "./admin-logs.seed";

// =============================================
// MAIN SEED FUNCTION
// =============================================

async function main() {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           DEUCE LEAGUE DATABASE SEEDING                      ║");
  console.log("║           Comprehensive Data for Development & Testing       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("\n");

  const startTime = Date.now();

  try {
    // =========================================
    // PHASE 1: USERS AND ADMINS
    // =========================================
    logSection("═══ PHASE 1: USERS AND AUTHENTICATION ═══");

    const admins = await seedAdmins();
    const users = await seedUsers();
    await seedAdminInviteTokens(admins);
    await seedNotificationPreferences(users);
    await seedUserPushTokens(users);

    // =========================================
    // PHASE 2: LEAGUES, SEASONS, AND DIVISIONS
    // =========================================
    logSection("═══ PHASE 2: LEAGUES AND SEASONS ═══");

    const categories = await seedCategories();
    const adminId = admins.length > 0 ? admins[0].adminId : undefined;
    const sponsorships = await seedSponsorships(adminId);
    const { leagues, seasons, divisions } = await seedLeaguesAndSeasons(adminId!, categories, sponsorships);
    await seedSeasonMemberships(users, seasons, divisions);
    await seedPromoCodes(seasons);
    await seedWaitlists(seasons, users);
    await seedInactivitySettings(leagues, seasons, adminId!);
    await seedSeasonLocks(seasons, adminId!);

    // =========================================
    // PHASE 3: MATCHES AND RESULTS
    // =========================================
    logSection("═══ PHASE 3: MATCHES AND RESULTS ═══");

    const leagueMatches = await seedMatches(users, divisions, seasons, admins);
    const friendlyMatches = await seedFriendlyMatches(users, leagues);
    const allMatches = [...leagueMatches, ...friendlyMatches];
    await seedMatchResults(allMatches, users);
    await seedPickleballGameScores(allMatches);
    await seedMatchInvitations(allMatches, users);
    await seedMatchAdminActions(allMatches, admins);

    // =========================================
    // PHASE 4: SOCIAL FEATURES
    // =========================================
    logSection("═══ PHASE 4: SOCIAL FEATURES ═══");

    const socialData = await seedSocialFeatures(users);

    // =========================================
    // PHASE 5: DISPUTES AND PENALTIES
    // =========================================
    logSection("═══ PHASE 5: DISPUTES AND PENALTIES ═══");

    const disputeData = await seedDisputesAndPenalties(users, admins);

    // =========================================
    // PHASE 6: DMR RATING PROCESSING
    // =========================================
    logSection("═══ PHASE 6: DMR RATING PROCESSING ═══");

    // Process all completed matches through the DMR (Glicko-2) rating system
    // This generates realistic player ratings and rating history based on actual match results
    const dmrData = await seedDMRRatings();

    // =========================================
    // PHASE 7: RATING ADMIN DATA
    // =========================================
    logSection("═══ PHASE 7: RATING ADMIN DATA ═══");

    // Now seed admin-related rating data (adjustments, recalculations)
    // These require DMR ratings to exist first
    const ratingData = await seedRatingsAndStandings(users, admins);

    // =========================================
    // PHASE 8: BUG REPORTS AND FEEDBACK
    // =========================================
    logSection("═══ PHASE 8: BUG REPORTS AND FEEDBACK ═══");

    const bugData = await seedBugsAndFeedback(users, admins);

    // =========================================
    // PHASE 9: ADMIN ACTIVITY LOGS
    // =========================================
    logSection("═══ PHASE 9: ADMIN ACTIVITY LOGS ═══");

    const adminLogData = await seedAdminActivityLogs(admins);

    // =========================================
    // SUMMARY
    // =========================================
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║                    SEEDING COMPLETE!                         ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║  Duration: ${duration}s                                         ║`);
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log("║  SUMMARY:                                                    ║");
    console.log(`║  • Users: ${users.length} + ${admins.length} admins                                    ║`);
    console.log(`║  • Leagues: ${leagues.length}                                                  ║`);
    console.log(`║  • Seasons: ${seasons.length}                                                  ║`);
    console.log(`║  • Divisions: ${divisions.length}                                               ║`);
    console.log(`║  • Friendships: ${socialData.friendshipCount}                                           ║`);
    console.log(`║  • Threads: ${socialData.threadCount}                                               ║`);
    console.log(`║  • Notifications: ${socialData.notificationCount}                                       ║`);
    console.log(`║  • Disputes: ${disputeData.disputeCount}                                              ║`);
    console.log(`║  • Penalties: ${disputeData.penaltyCount}                                             ║`);
    console.log(`║  • DMR Ratings: ${dmrData.ratingsCreated} (${dmrData.matchesProcessed} matches)                          ║`);
    console.log(`║  • Rating History: ${dmrData.historyEntriesCreated}                                        ║`);
    console.log(`║  • Rating Adjustments: ${ratingData.adjustmentCount}                                       ║`);
    console.log(`║  • Bug Reports: ${bugData.bugCount}                                              ║`);
    console.log(`║  • Admin Logs: ${adminLogData.logCount}                                              ║`);
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log("║  TEST CREDENTIALS:                                           ║");
    console.log("║  • superadmin@dleague.com / Admin@123 (SUPERADMIN)           ║");
    console.log("║  • admin@dleague.com / Admin@123 (ADMIN)                     ║");
    console.log("║  • Any user: [username]@test.com / Test@123                  ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log("\n");

  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    throw error;
  }
}

// =============================================
// RUN SEED
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
