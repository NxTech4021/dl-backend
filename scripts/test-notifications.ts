/**
 * Notification Smoke Test
 *
 * Fires every active notification template through POST /api/notifications/test/local
 * so you can visually confirm each one appears correctly in the notification bell.
 *
 * Usage:
 *   npx tsx scripts/test-notifications.ts
 *
 * Configuration (env vars or prompted):
 *   NOTIF_TEST_EMAIL    — sign-in email
 *   NOTIF_TEST_PASSWORD — sign-in password
 *   NOTIF_TEST_BASE_URL — defaults to http://localhost:3001
 *   NOTIF_TEST_USER_ID  — user ID to receive the notifications (defaults to logged-in user)
 *
 * Tip: pipe through `| head -80` or set NOTIF_TEST_CATEGORY=MATCH to run one section.
 */

import * as readline from 'readline';
import { accountNotifications }           from '../src/helpers/notifications/accountNotifications';
import { doublesNotifications }            from '../src/helpers/notifications/doublesNotifications';
import { leagueLifecycleNotifications }    from '../src/helpers/notifications/leagueLifecycleNotifications';
import { matchManagementNotifications }    from '../src/helpers/notifications/matchManagementNotifications';
import { ratingRankingNotifications }      from '../src/helpers/notifications/ratingRankingNotifications';
import { socialCommunityNotifications }    from '../src/helpers/notifications/socialCommunityNotifications';
import { promotionalNotifications }        from '../src/helpers/notifications/promotionalNotifications';
//  import { divisionNotifications }             from '../src/helpers/notifications/divisionNotifications';
import { specialCircumstancesNotifications } from '../src/helpers/notifications/specialCircumstancesNotifications';
import type { NotificationPayload }        from '../src/types/notificationTypes';

// ─── config ──────────────────────────────────────────────────────────────────

const BASE_URL  = process.env.NOTIF_TEST_BASE_URL ?? 'http://localhost:3001';
const FILTER    = process.env.NOTIF_TEST_CATEGORY ?? '';   // e.g. "MATCH" or ""

// ─── sample data (reuse across all templates) ────────────────────────────────

const P  = 'Alex';           // opponent / partner name
const P2 = 'Jordan';         // secondary player name
const LG = 'KL Badminton League';
const SN = 'Season 1';
const DIV = 'Division A';
const CAT = 'Open Men';
const DATE = 'Mon 21 Apr';
const TIME = '7:00 PM';
const VENUE = 'Sports Planet Ampang';
const SPORT = 'Badminton';

// ─── all notification payloads ────────────────────────────────────────────────

function buildAll(): Array<{ label: string; payload: NotificationPayload }> {
  return [
    // ── Division ──────────────────────────────────────────────────────────────
    // { label: 'division / created',    payload: divisionNotifications.created(DIV, SN, 'Admin') },
    // { label: 'division / assigned',   payload: divisionNotifications.assigned(DIV, SN) },
    // { label: 'division / removed',    payload: divisionNotifications.removed(DIV, SN, 'Inactivity') },
    // { label: 'division / transferred', payload: divisionNotifications.transferred('Division B', DIV, SN) },

    // ── Account & System ─────────────────────────────────────────────────────
    { label: 'account / profileIncompleteReminder',     payload: accountNotifications.profileIncompleteReminder() },
    { label: 'account / profilePhotoMissing',           payload: accountNotifications.profilePhotoMissing() },
    { label: 'account / tosUpdated',                    payload: accountNotifications.tosUpdated() },
    { label: 'account / newWeeklyStreak',               payload: accountNotifications.newWeeklyStreak(4) },
    { label: 'account / streakAtRisk',                  payload: accountNotifications.streakAtRisk(3, 'Sunday') },
    { label: 'account / appUpdateAvailable',            payload: accountNotifications.appUpdateAvailable() },
    { label: 'account / scheduledMaintenance',          payload: accountNotifications.scheduledMaintenance('Saturday 10 PM', '2 hours') },
    { label: 'account / maintenanceComplete',           payload: accountNotifications.maintenanceComplete() },

    // ── Doubles ───────────────────────────────────────────────────────────────
    { label: 'doubles / waitingForCaptain',              payload: doublesNotifications.waitingForCaptain(P, LG) },
    { label: 'doubles / registrationDeadlinePartner',    payload: doublesNotifications.registrationDeadlinePartner(LG, P) },
    { label: 'doubles / doublesTeamRegisteredCaptain',   payload: doublesNotifications.doublesTeamRegisteredCaptain(LG, P) },
    { label: 'doubles / partnerRequestReceived',         payload: doublesNotifications.partnerRequestReceived(P, LG) },
    { label: 'doubles / partnerRequestAcceptedCaptain',  payload: doublesNotifications.partnerRequestAcceptedCaptain(P, LG) },
    { label: 'doubles / partnerRequestDeclinedCaptain',  payload: doublesNotifications.partnerRequestDeclinedCaptain(P, LG) },
    { label: 'doubles / teamRegistrationReminder24h',    payload: doublesNotifications.teamRegistrationReminder24h(LG) },
    { label: 'doubles / registrationDeadlineCaptain',    payload: doublesNotifications.registrationDeadlineCaptain(LG, P) },
    { label: 'doubles / doublesTeamRegisteredPartner',   payload: doublesNotifications.doublesTeamRegisteredPartner(P, LG) },
    { label: 'doubles / partnerLeftPartnership',         payload: doublesNotifications.partnerLeftPartnership(P, LG) },
    { label: 'doubles / newPartnerJoined',               payload: doublesNotifications.newPartnerJoined(P, LG) },
    { label: 'doubles / partnerPostedMatch',             payload: doublesNotifications.partnerPostedMatch(P, DATE, TIME, VENUE) },
    { label: 'doubles / partnerConfirmedPostedMatch',    payload: doublesNotifications.partnerConfirmedPostedMatch(P, DATE, TIME, VENUE) },
    { label: 'doubles / partnerDeclinedPostedMatch',     payload: doublesNotifications.partnerDeclinedPostedMatch(P, DATE) },
    { label: 'doubles / partnerJoinedMatch',             payload: doublesNotifications.partnerJoinedMatch(P, DATE, TIME, VENUE) },
    { label: 'doubles / partnerConfirmedJoinedMatch',    payload: doublesNotifications.partnerConfirmedJoinedMatch(P, DATE, TIME, VENUE) },
    { label: 'doubles / partnerDeclinedJoinedMatch',     payload: doublesNotifications.partnerDeclinedJoinedMatch(P, DATE) },
    { label: 'doubles / matchCancelledPartnerDeclined',  payload: doublesNotifications.matchCancelledPartnerDeclined(DATE, TIME, VENUE) },

    // ── League Lifecycle ──────────────────────────────────────────────────────
    { label: 'lifecycle / registrationConfirmed',          payload: leagueLifecycleNotifications.registrationConfirmed(SN, LG, CAT, '1 May', 'RM120') },
    { label: 'lifecycle / matchesRemaining',               payload: leagueLifecycleNotifications.matchesRemaining(LG, 3) },
    // { label: 'lifecycle / divisionRebalanced',             payload: leagueLifecycleNotifications.divisionRebalanced('Division B', LG) },
    // { label: 'lifecycle / divisionUpdateNewPlayer',        payload: leagueLifecycleNotifications.divisionUpdateNewPlayer(LG) },
    { label: 'lifecycle / winningStreak',                  payload: leagueLifecycleNotifications.winningStreak(5) },
    { label: 'lifecycle / scheduleMatchSoon',              payload: leagueLifecycleNotifications.scheduleMatchSoon() },
    { label: 'lifecycle / earlySeasonNudge',               payload: leagueLifecycleNotifications.earlySeasonNudge() },
    { label: 'lifecycle / midSeasonUpdate',                payload: leagueLifecycleNotifications.midSeasonUpdate(3, DIV, LG, CAT) },
    { label: 'lifecycle / lateSeasonNudge',                payload: leagueLifecycleNotifications.lateSeasonNudge() },
    { label: 'lifecycle / inactivePlayerWarning7Days',     payload: leagueLifecycleNotifications.inactivePlayerWarning7Days() },
    { label: 'lifecycle / inactivityDuringLeagueSeasonNoMatch', payload: leagueLifecycleNotifications.inactivityDuringLeagueSeasonNoMatch() },
    { label: 'lifecycle / inactivityDuringLeagueSeason2Weeks',  payload: leagueLifecycleNotifications.inactivityDuringLeagueSeason2Weeks() },
    { label: 'lifecycle / inactivityDeadline7Days',        payload: leagueLifecycleNotifications.inactivityDeadline7Days('15 May') },
    { label: 'lifecycle / inactivityDeadline3Days',        payload: leagueLifecycleNotifications.inactivityDeadline3Days('18 May', LG) },
    { label: 'lifecycle / finalWeekAlert',                 payload: leagueLifecycleNotifications.finalWeekAlert(SN, LG) },
    { label: 'lifecycle / lastMatchDeadline48h',           payload: leagueLifecycleNotifications.lastMatchDeadline48h(SN, LG) },
    { label: 'lifecycle / leagueEndedFinalResults',        payload: leagueLifecycleNotifications.leagueEndedFinalResults(SN, LG) },
    { label: 'lifecycle / leagueWinner',                   payload: leagueLifecycleNotifications.leagueWinner(DIV, LG, CAT) },
    { label: 'lifecycle / top3Finish',                     payload: leagueLifecycleNotifications.top3Finish(2, DIV, LG, CAT) },
    { label: 'lifecycle / leagueCompleteBanner',           payload: leagueLifecycleNotifications.leagueCompleteBanner(LG, SN) },
    { label: 'lifecycle / leagueCancelled',                payload: leagueLifecycleNotifications.leagueCancelled(LG, SN) },
    { label: 'lifecycle / leagueExtended',                 payload: leagueLifecycleNotifications.leagueExtended(LG, SN, '30 May') },
    { label: 'lifecycle / leagueShortened',                payload: leagueLifecycleNotifications.leagueShortened(LG, SN, '20 Apr') },
    { label: 'lifecycle / emergencyLeagueUpdate',          payload: leagueLifecycleNotifications.emergencyLeagueUpdate('Venue changed to Sports Planet Bukit Jalil.') },
    { label: 'lifecycle / newLeagueAnnouncement',          payload: leagueLifecycleNotifications.newLeagueAnnouncement(LG) },
    { label: 'lifecycle / newSeasonAnnouncement',          payload: leagueLifecycleNotifications.newSeasonAnnouncement(SN, LG) },
    { label: 'lifecycle / registrationClosing3Days',       payload: leagueLifecycleNotifications.registrationClosing3Days(SN, LG) },
    { label: 'lifecycle / registrationClosing24Hours',     payload: leagueLifecycleNotifications.registrationClosing24Hours(SN) },
    { label: 'lifecycle / seasonStarting3Days',            payload: leagueLifecycleNotifications.seasonStarting3Days(SN, LG) },
    { label: 'lifecycle / seasonStartedWelcome',           payload: leagueLifecycleNotifications.seasonStartedWelcome(SN, LG) },
    { label: 'lifecycle / paymentFailed',                  payload: leagueLifecycleNotifications.paymentFailed(SN, LG) },
    { label: 'lifecycle / withdrawalApproved',             payload: leagueLifecycleNotifications.withdrawalApproved(LG) },
    { label: 'lifecycle / refundProcessed',                payload: leagueLifecycleNotifications.refundProcessed('RM120', LG) },

    // ── Match Management ──────────────────────────────────────────────────────
    { label: 'match / friendlyMatchPosted',                payload: matchManagementNotifications.friendlyMatchPosted(DATE, TIME, VENUE) },
    { label: 'match / opponentReportedIssue',              payload: matchManagementNotifications.opponentReportedIssue(P) },
    { label: 'match / friendlyMatchJoinRequest',           payload: matchManagementNotifications.friendlyMatchJoinRequest(P, DATE, TIME) },
    { label: 'match / friendlyMatchPlayerJoined',          payload: matchManagementNotifications.friendlyMatchPlayerJoined(P, DATE, TIME, VENUE) },
    { label: 'match / friendlyMatchRequestAccepted',       payload: matchManagementNotifications.friendlyMatchRequestAccepted(P, DATE, TIME, VENUE) },
    { label: 'match / friendlyMatchRequestDeclined',       payload: matchManagementNotifications.friendlyMatchRequestDeclined(P) },
    { label: 'match / friendlyMatchCancelled',             payload: matchManagementNotifications.friendlyMatchCancelled(P, DATE, VENUE) },
    { label: 'match / playerLeftFriendlyMatch',            payload: matchManagementNotifications.playerLeftFriendlyMatch(P, DATE, TIME) },
    { label: 'match / friendlyMatchDetailsChanged',        payload: matchManagementNotifications.friendlyMatchDetailsChanged(P, DATE, TIME, VENUE) },
    { label: 'match / matchReminder24h',                   payload: matchManagementNotifications.matchReminder24h(P, TIME, VENUE) },
    { label: 'match / matchReminder2h',                    payload: matchManagementNotifications.matchReminder2h(P, TIME, VENUE) },
    { label: 'match / matchMorningReminder',               payload: matchManagementNotifications.matchMorningReminder(P, TIME, VENUE) },
    { label: 'match / matchWalkoverWon',                   payload: matchManagementNotifications.matchWalkoverWon(P) },
    { label: 'match / matchWalkoverLost',                  payload: matchManagementNotifications.matchWalkoverLost(P) },
    { label: 'match / opponentClaimsNoShow',               payload: matchManagementNotifications.opponentClaimsNoShow(P, DATE) },
    { label: 'match / headToHeadHistory',                  payload: matchManagementNotifications.headToHeadHistory(P, '3W – 2L') },
    { label: 'match / scoreSubmissionReminder',            payload: matchManagementNotifications.scoreSubmissionReminder(P) },
    { label: 'match / scoreDisputeAlert',                  payload: matchManagementNotifications.scoreDisputeAlert(P) },
    { label: 'match / opponentSubmittedScore',             payload: matchManagementNotifications.opponentSubmittedScore(P) },
    { label: 'match / pendingScoreSubmission',             payload: matchManagementNotifications.pendingScoreSubmission(P) },
    { label: 'match / pendingScoreConfirmation',           payload: matchManagementNotifications.pendingScoreConfirmation(P) },
    { label: 'match / scoreConfirmed',                     payload: matchManagementNotifications.scoreConfirmed(P) },
    { label: 'match / scoreAutoConfirmed',                 payload: matchManagementNotifications.scoreAutoConfirmed(P) },
    { label: 'match / forfeitDisciplinary',                payload: matchManagementNotifications.forfeitDisciplinary(P) },
    { label: 'match / opponentPostedLeagueMatch',          payload: matchManagementNotifications.opponentPostedLeagueMatch(P, DATE, TIME) },
    { label: 'match / leagueMatchConfirmedOpponentJoined', payload: matchManagementNotifications.leagueMatchConfirmedOpponentJoined(P, DATE, TIME, VENUE) },
    { label: 'match / leagueMatchCancelledByOpponent',     payload: matchManagementNotifications.leagueMatchCancelledByOpponent(P, DATE) },

    // ── Rating & Ranking ─────────────────────────────────────────────────────
    { label: 'rating / movedUpInStandings',  payload: ratingRankingNotifications.movedUpInStandings(4, DIV, LG, CAT) },
    { label: 'rating / enteredTop10',        payload: ratingRankingNotifications.enteredTop10(DIV, LG, CAT) },
    { label: 'rating / enteredTop3',         payload: ratingRankingNotifications.enteredTop3(3, DIV, LG, CAT) },
    { label: 'rating / leagueLeader',        payload: ratingRankingNotifications.leagueLeader(DIV, LG, CAT) },
    { label: 'rating / dmrIncreased',        payload: ratingRankingNotifications.dmrIncreased(SPORT, 1420, 15) },
    { label: 'rating / personalBestRating',  payload: ratingRankingNotifications.personalBestRating(SPORT, 1500) },

    // ── Social & Community ────────────────────────────────────────────────────
    { label: 'social / friendActivityScorecard', payload: socialCommunityNotifications.friendActivityScorecard(P) },
    { label: 'social / friendActivityPost',      payload: socialCommunityNotifications.friendActivityPost(P, 'just won a match 🎾') },
    { label: 'social / shareScorecardPrompt',    payload: socialCommunityNotifications.shareScorecardPrompt() },
    { label: 'social / friendRequest',           payload: socialCommunityNotifications.friendRequest(P) },
    { label: 'social / newMessage',              payload: socialCommunityNotifications.newMessage(P, 'Are you free Saturday?') },
    { label: 'social / groupChatMessage',        payload: socialCommunityNotifications.groupChatMessage('Division A Chat', P, 'Anyone up for a hit?') },
    { label: 'social / groupAdded',              payload: socialCommunityNotifications.groupAdded('Division A Chat') },

    // ── Promotional ───────────────────────────────────────────────────────────
    { label: 'promo / nextSeasonOpeningSoon',        payload: promotionalNotifications.nextSeasonOpeningSoon(SPORT, '1 Jun') },
    { label: 'promo / sponsoredLeagueAnnouncement',  payload: promotionalNotifications.sponsoredLeagueAnnouncement('Wilson', LG) },
    { label: 'promo / referralBonusAvailable',       payload: promotionalNotifications.referralBonusAvailable('RM20') },
    { label: 'promo / inactivePlayer14Days',         payload: promotionalNotifications.inactivePlayer14Days() },
    { label: 'promo / inactivePlayer30Days',         payload: promotionalNotifications.inactivePlayer30Days() },
    { label: 'promo / leagueBetweenBreaks',          payload: promotionalNotifications.leagueBetweenBreaks(LG) },
    { label: 'promo / incompleteRegistration',       payload: promotionalNotifications.incompleteRegistration(LG) },

    // ── Special Circumstances ─────────────────────────────────────────────────
    { label: 'special / disputeSubmitted',           payload: specialCircumstancesNotifications.disputeSubmitted() },
    { label: 'special / disputeResolutionRequired',  payload: specialCircumstancesNotifications.disputeResolutionRequired(P) },
    { label: 'special / disputeResolved',            payload: specialCircumstancesNotifications.disputeResolved(P) },
    { label: 'special / codeOfConductWarning',       payload: specialCircumstancesNotifications.codeOfConductWarning() },
    { label: 'special / suspensionNotice',           payload: specialCircumstancesNotifications.suspensionNotice('7 days', 'Repeated no-shows') },
  ];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sign-in failed (${res.status}): ${text}`);
  }
  // Extract session cookie from Set-Cookie header
  const setCookie = res.headers.get('set-cookie') ?? '';
  if (!setCookie) throw new Error('No Set-Cookie returned from sign-in');
  // Grab the first cookie value (better-auth sets the session cookie first)
  const cookie = setCookie.split(',').map(c => c.split(';')[0].trim()).join('; ');
  return cookie;
}

async function sendNotification(
  cookie: string,
  userId: string,
  payload: NotificationPayload,
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(`${BASE_URL}/api/notifications/test/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      userIds: [userId],
      type: payload.type,
      category: payload.category,
      title: payload.title,
      message: payload.message,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

function color(text: string, code: number) {
  return `\x1b[${code}m${text}\x1b[0m`;
}
const green  = (s: string) => color(s, 32);
const red    = (s: string) => color(s, 31);
const yellow = (s: string) => color(s, 33);
const bold   = (s: string) => color(s, 1);
const dim    = (s: string) => color(s, 2);

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(bold('\n🔔  Deuce League — Notification Smoke Test'));
  console.log(dim(`    Target: ${BASE_URL}\n`));

  // ── credentials ──────────────────────────────────────────────────────────────
  const email    = process.env.NOTIF_TEST_EMAIL    ?? await prompt('Email: ');
  const password = process.env.NOTIF_TEST_PASSWORD ?? await prompt('Password: ');

  console.log(dim('\n  Signing in…'));
  let cookie: string;
  try {
    cookie = await signIn(email, password);
    console.log(green('  ✔ Signed in\n'));
  } catch (err: any) {
    console.error(red(`  ✘ ${err.message}`));
    process.exit(1);
  }

  // ── resolve target user ID ────────────────────────────────────────────────────
  let userId = process.env.NOTIF_TEST_USER_ID ?? '';
  if (!userId) {
    // Ask after we know the session is valid
    userId = await prompt('User ID to receive notifications (leave blank to use your own): ');
    if (!userId) {
      // Fetch own user ID from session
      const meRes = await fetch(`${BASE_URL}/api/player/me`, {
        headers: { Cookie: cookie },
      });
      if (!meRes.ok) {
        console.error(red('  ✘ Could not fetch own user ID — set NOTIF_TEST_USER_ID or pass it when prompted.'));
        process.exit(1);
      }
      const me = (await meRes.json()) as any;
      userId = me?.data?.id ?? me?.id ?? '';
      if (!userId) {
        console.error(red('  ✘ Could not parse user ID from /player/me response.'));
        process.exit(1);
      }
      console.log(dim(`  Using user ID: ${userId}\n`));
    }
  }

  // ── build & optionally filter list ───────────────────────────────────────────
  const all = buildAll();
  const list = FILTER
    ? all.filter(n => n.label.toLowerCase().startsWith(FILTER.toLowerCase()))
    : all;

  if (list.length === 0) {
    console.warn(yellow(`  No notifications matched filter "${FILTER}"`));
    process.exit(0);
  }

  console.log(bold(`  Sending ${list.length} notification${list.length === 1 ? '' : 's'}…\n`));

  // ── fire all ──────────────────────────────────────────────────────────────────
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  // Track last section header for grouping
  let lastSection = '';

  for (const { label, payload } of list) {
    const section = label.split(' / ')[0];
    if (section !== lastSection) {
      console.log(bold(`  ${section.toUpperCase()}`));
      lastSection = section;
    }

    const result = await sendNotification(cookie, userId, payload);

    const name    = label.split(' / ')[1];
    const typePad = (payload.type ?? '').padEnd(46);
    const titlePad = (payload.title ?? '').substring(0, 40).padEnd(42);

    if (result.ok) {
      passed++;
      console.log(`    ${green('✔')} ${name.padEnd(44)} ${dim(typePad)} ${dim(titlePad)}`);
    } else {
      failed++;
      failures.push(`${label}: HTTP ${result.status} — ${result.body.substring(0, 120)}`);
      console.log(`    ${red('✘')} ${name.padEnd(44)} ${dim(typePad)} ${yellow(`HTTP ${result.status}`)}`);
    }
  }

  // ── summary ────────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(100));
  if (failed === 0) {
    console.log(green(bold(`  ✔ All ${passed} notifications sent successfully.`)));
    console.log(dim(`  Open the app and check the notification bell to verify they display correctly.\n`));
  } else {
    console.log(bold(`  ${green(String(passed))} passed  ${red(String(failed))} failed\n`));
    console.log(red('  Failures:'));
    failures.forEach(f => console.log(red(`    • ${f}`)));
    console.log();
    process.exit(1);
  }
}

main().catch(err => {
  console.error(red(`\n  Fatal: ${err.message}`));
  process.exit(1);
});
