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
 * - 30 achievement definitions + user achievement unlocks
 * - Division standings computed from Best 6 system
 * - 300 activity feed posts with likes and comments
 * - 80 pair requests, 60 season invitations, 250 payments
 * - 500 match comments, 100 dispute notes, 200 dispute comments
 * - Rating parameters, bug comments, bug status changes
 * - System maintenance, feature announcements
 * - Tournament brackets with rounds and matches
 * - 2000+ user activity logs, player/admin status changes
 *
 * All data is spread over 12 months for realistic time-series charts.
 */

import { prisma, logSection, logSuccess, logProgress, logWarning } from "./utils";
import { seedAdmins, seedUsers, seedAdminInviteTokens, seedNotificationPreferences, seedUserPushTokens, seedUserSettings } from "./users.seed";
import { seedLeaguesAndSeasons, seedCategories, seedSponsorships, seedSeasonMemberships, seedPartnerships, seedPromoCodes, seedWaitlists, seedInactivitySettings, seedSeasonLocks, seedPairRequests, seedSeasonInvitations, seedPayments } from "./leagues.seed";
import { seedMatches, seedFriendlyMatches, seedMatchResults, seedPickleballGameScores, seedMatchInvitations, seedMatchAdminActions, seedMatchComments } from "./matches.seed";
import { seedSocialFeatures } from "./social.seed";
import { seedDisputesAndPenalties, seedDisputeAdminNotes, seedDisputeComments } from "./disputes.seed";
import { seedRatingsAndStandings, seedRatingParameters } from "./ratings.seed";
import { seedDMRRatings } from "./dmr-ratings.seed";
import { seedBugsAndFeedback, seedBugComments, seedBugStatusChanges, seedBugReportSettings } from "./bugs.seed";
import { seedAdminActivityLogs, seedAdminMessageLogs } from "./admin-logs.seed";
import { seedAchievements, seedUserAchievements } from "./achievements.seed";
import { seedStandings } from "./standings.seed";
import { seedFeed } from "./feed.seed";
import { seedSystemData } from "./system.seed";
import { seedBrackets } from "./brackets.seed";
import { seedAuditTrails } from "./audit.seed";

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
    await seedUserSettings(users);

    // =========================================
    // PHASE 2: LEAGUES, SEASONS, AND DIVISIONS
    // =========================================
    logSection("═══ PHASE 2: LEAGUES AND SEASONS ═══");

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
    const pairRequestCount = await seedPairRequests(seasons, users);
    const seasonInvitationCount = await seedSeasonInvitations(seasons, users);
    const paymentCount = await seedPayments(seasons, users);

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
    const matchCommentCount = await seedMatchComments(allMatches, users);

    // =========================================
    // PHASE 4: SOCIAL FEATURES
    // =========================================
    logSection("═══ PHASE 4: SOCIAL FEATURES ═══");

    // Include admin User records so admins have chat threads in dl-admin
    const adminUserRecords = await prisma.user.findMany({
      where: { id: { in: admins.map(a => a.userId) } },
    });
    const socialData = await seedSocialFeatures([...users, ...adminUserRecords]);

    // =========================================
    // PHASE 5: DISPUTES AND PENALTIES
    // =========================================
    logSection("═══ PHASE 5: DISPUTES AND PENALTIES ═══");

    const disputeData = await seedDisputesAndPenalties(users, admins);
    const disputeNoteCount = await seedDisputeAdminNotes(admins);
    const disputeCommentCount = await seedDisputeComments(users);

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
    const ratingParamCount = await seedRatingParameters(leagues, seasons, admins);

    // =========================================
    // PHASE 8: BUG REPORTS AND FEEDBACK
    // =========================================
    logSection("═══ PHASE 8: BUG REPORTS AND FEEDBACK ═══");

    const bugData = await seedBugsAndFeedback(users, admins);
    const bugCommentCount = await seedBugComments(users, admins);
    const bugStatusChangeCount = await seedBugStatusChanges(admins);
    const bugSettingsCount = await seedBugReportSettings(admins);

    // =========================================
    // PHASE 9: ADMIN ACTIVITY LOGS
    // =========================================
    logSection("═══ PHASE 9: ADMIN ACTIVITY LOGS ═══");

    const adminLogData = await seedAdminActivityLogs(admins);
    const adminMessageCount = await seedAdminMessageLogs(admins);

    // =========================================
    // PHASE 10: ACHIEVEMENTS
    // =========================================
    logSection("═══ PHASE 10: ACHIEVEMENTS ═══");

    const achievementData = await seedAchievements();
    const userAchievementCount = await seedUserAchievements();

    // =========================================
    // PHASE 11: DIVISION STANDINGS
    // =========================================
    logSection("═══ PHASE 11: DIVISION STANDINGS ═══");

    const standingsData = await seedStandings();

    // =========================================
    // PHASE 12: ACTIVITY FEED
    // =========================================
    logSection("═══ PHASE 12: ACTIVITY FEED ═══");

    const feedData = await seedFeed();

    // =========================================
    // PHASE 13: SYSTEM DATA
    // =========================================
    logSection("═══ PHASE 13: SYSTEM DATA ═══");

    const systemData = await seedSystemData();

    // =========================================
    // PHASE 14: TOURNAMENT BRACKETS
    // =========================================
    logSection("═══ PHASE 14: TOURNAMENT BRACKETS ═══");

    const bracketData = await seedBrackets();

    // =========================================
    // PHASE 15: AUDIT TRAILS
    // =========================================
    logSection("═══ PHASE 15: AUDIT TRAILS ═══");

    const auditData = await seedAuditTrails(users, admins);

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
    console.log(`║  Users: ${users.length} + ${admins.length} admins`);
    console.log(`║  Leagues: ${leagues.length}, Seasons: ${seasons.length}, Divisions: ${divisions.length}`);
    console.log(`║  Friendships: ${socialData.friendshipCount}, Threads: ${socialData.threadCount}`);
    console.log(`║  Notifications: ${socialData.notificationCount}`);
    console.log(`║  League Matches: ${leagueMatches.length}, Friendly Matches: ${friendlyMatches.length}`);
    console.log(`║  Match Comments: ${matchCommentCount}`);
    console.log(`║  Pair Requests: ${pairRequestCount}, Season Invitations: ${seasonInvitationCount}`);
    console.log(`║  Payments: ${paymentCount}`);
    console.log(`║  Disputes: ${disputeData.disputeCount}, Penalties: ${disputeData.penaltyCount}`);
    console.log(`║  Dispute Notes: ${disputeNoteCount}, Dispute Comments: ${disputeCommentCount}`);
    console.log(`║  DMR Ratings: ${dmrData.ratingsCreated} (${dmrData.matchesProcessed} matches)`);
    console.log(`║  Rating History: ${dmrData.historyEntriesCreated}`);
    console.log(`║  Rating Adjustments: ${ratingData.adjustmentCount}, Rating Params: ${ratingParamCount}`);
    console.log(`║  Bug Reports: ${bugData.bugCount}, Bug Comments: ${bugCommentCount}`);
    console.log(`║  Bug Status Changes: ${bugStatusChangeCount}, Bug Settings: ${bugSettingsCount}`);
    console.log(`║  Admin Logs: ${adminLogData.logCount}, Admin Messages: ${adminMessageCount}`);
    console.log(`║  Achievements: ${achievementData.count} defs, ${userAchievementCount} unlocks`);
    console.log(`║  Division Standings: ${standingsData.standingCount}`);
    console.log(`║  Feed Posts: ${feedData.postCount} (${feedData.likeCount} likes, ${feedData.commentCount} comments)`);
    console.log(`║  System Maintenance: ${systemData.maintenanceCount}, Announcements: ${systemData.announcementCount}`);
    console.log(`║  Brackets: ${bracketData.bracketCount}, Rounds: ${bracketData.roundCount}, Bracket Matches: ${bracketData.matchCount}`);
    console.log(`║  Activity Logs: ${auditData.activityLogCount}`);
    console.log(`║  Player Status Changes: ${auditData.playerStatusCount}, Admin Status Changes: ${auditData.adminStatusCount}`);
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
