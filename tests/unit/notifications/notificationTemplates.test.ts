/**
 * Notification Templates Test Suite
 *
 * Validates EVERY notification template against the v2 masterlist spec:
 *   - type constant matches NOTIFICATION_TYPES
 *   - title and message correctly interpolate all parameters
 *   - metadata carries all expected keys / excludes removed params
 *   - delivery type resolves to the correct PUSH / IN_APP value
 *
 * Tests that FAIL expose real bugs — either a delivery map key mismatch or a
 * template regression.  All delivery assertions express *desired* behaviour per
 * the masterlist.  Any failure flagged with a "TODO" comment indicates a known
 * delivery-map alignment issue that still needs fixing in
 * `src/types/notificationDeliveryTypes.ts`.
 *
 * Run:  npx jest tests/unit/notifications/notificationTemplates.test.ts --verbose
 */

import {
  getNotificationDeliveryType,
  shouldSendPushNotification,
  shouldCreateInAppRecord,
  NotificationDeliveryType,
} from '../../../src/types/notificationDeliveryTypes';
import { NOTIFICATION_TYPES } from '../../../src/types/notificationTypes';
import { accountNotifications } from '../../../src/helpers/notifications/accountNotifications';
import { doublesNotifications } from '../../../src/helpers/notifications/doublesNotifications';
import { leagueLifecycleNotifications } from '../../../src/helpers/notifications/leagueLifecycleNotifications';
import { matchManagementNotifications } from '../../../src/helpers/notifications/matchManagementNotifications';
import { ratingRankingNotifications } from '../../../src/helpers/notifications/ratingRankingNotifications';
import { socialCommunityNotifications } from '../../../src/helpers/notifications/socialCommunityNotifications';
import { promotionalNotifications } from '../../../src/helpers/notifications/promotionalNotifications';
import { specialCircumstancesNotifications } from '../../../src/helpers/notifications/specialCircumstancesNotifications';

// ─────────────────────────────────────────────
// Shared delivery-type helpers
// ─────────────────────────────────────────────

function expectPush(type: string): void {
  expect(getNotificationDeliveryType(type)).toBe(NotificationDeliveryType.PUSH);
  expect(shouldSendPushNotification(type)).toBe(true);
  expect(shouldCreateInAppRecord(type)).toBe(false);
}

function expectInApp(type: string): void {
  expect(getNotificationDeliveryType(type)).toBe(NotificationDeliveryType.IN_APP);
  expect(shouldSendPushNotification(type)).toBe(false);
  expect(shouldCreateInAppRecord(type)).toBe(true);
}

function expectBoth(type: string): void {
  expect(getNotificationDeliveryType(type)).toBe(NotificationDeliveryType.BOTH);
  expect(shouldSendPushNotification(type)).toBe(true);
  expect(shouldCreateInAppRecord(type)).toBe(true);
}

// ─────────────────────────────────────────────
// 1. Account & System
// ─────────────────────────────────────────────

describe('Account & System notifications', () => {
  describe('profileIncompleteReminder', () => {
    const n = accountNotifications.profileIncompleteReminder();
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.PROFILE_INCOMPLETE_REMINDER));
    it('delivery → IN_APP', () => expectInApp(n.type));
    it('title', () => expect(n.title).toBe('How Good Are You?'));
    it('message mentions DMR', () => expect(n.message).toContain('DMR'));
  });

  describe('profilePhotoMissing', () => {
    const n = accountNotifications.profilePhotoMissing();
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.PROFILE_PHOTO_MISSING));
    it('delivery → IN_APP', () => expectInApp(n.type));
    it('title', () => expect(n.title).toBe('Put a Face to the Game'));
    it('message mentions profile photo', () => expect(n.message.toLowerCase()).toContain('profile photo'));
  });

  describe('tosUpdated', () => {
    const n = accountNotifications.tosUpdated();
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.TOS_UPDATED));
    it('delivery → IN_APP', () => expectInApp(n.type));
    it('title', () => expect(n.title).toBe('Terms Updated'));
    it('message is non-empty', () => expect(n.message.length).toBeGreaterThan(0));
  });

  describe('newWeeklyStreak', () => {
    const n = accountNotifications.newWeeklyStreak(4);
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.NEW_WEEKLY_STREAK));
    it('delivery → IN_APP', () => expectInApp(n.type));
    it('title contains week count', () => expect(n.title).toContain('4'));
    it('message contains week count', () => expect(n.message).toContain('4'));
    it('metadata.weeks', () => expect(n.metadata?.weeks).toBe(4));
  });

  describe('streakAtRisk', () => {
    const n = accountNotifications.streakAtRisk(3, 'Sunday');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.STREAK_AT_RISK));
    it('delivery → PUSH', () => expectPush(n.type));
    it("title", () => expect(n.title).toBe("You're Losing Your Streak!"));
    it('message contains week count', () => expect(n.message).toContain('3'));
    it('metadata.weeks', () => expect(n.metadata?.weeks).toBe(3));
    it('metadata.deadline', () => expect(n.metadata?.deadline).toBe('Sunday'));
  });
});

// ─────────────────────────────────────────────
// 2. Doubles League — Partner Request & Team Formation
// ─────────────────────────────────────────────

describe('Doubles League notifications', () => {

  // ── IN-APP ──

  // describe('partnerRequestSent', () => {
  //   -- commented out: Plan C helper removed --
  // });

  // describe('partnerRequestDeclinedPartner', () => {
  //   -- commented out: Plan C helper removed --
  // });

  describe('doublesTeamRegisteredCaptain', () => {
    const n = doublesNotifications.doublesTeamRegisteredCaptain('Summer League', 'Alex');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.DOUBLES_TEAM_REGISTERED_CAPTAIN));
    it('delivery → IN_APP', () => expectInApp(n.type));
    it('title', () => expect(n.title).toBe('✅ Team Registered!'));
    it('message contains partnerName', () => expect(n.message).toContain('Alex'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  // ── PUSH ──

  describe('partnerRequestReceived', () => {
    const n = doublesNotifications.partnerRequestReceived('Alex', 'Summer League');
    // type string produced by the template
    it('type string', () => expect(n.type).toBe(NOTIFICATION_TYPES.PAIR_REQUEST_RECEIVED));
    // TODO: delivery map is missing PAIR_REQUEST_RECEIVED → should be PUSH once delivery map is fixed
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Partner Up?'));
    it('message contains playerName', () => expect(n.message).toContain('Alex'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
    it('metadata.playerName', () => expect(n.metadata?.playerName).toBe('Alex'));
    it('metadata.leagueName', () => expect(n.metadata?.leagueName).toBe('Summer League'));
  });

  describe('partnerRequestAcceptedCaptain', () => {
    const n = doublesNotifications.partnerRequestAcceptedCaptain('Jamie', 'Summer League');
    it('type string', () => expect(n.type).toBe(NOTIFICATION_TYPES.PAIR_REQUEST_ACCEPTED));
    // TODO: delivery map is missing PAIR_REQUEST_ACCEPTED → should be PUSH once delivery map is fixed
    it('delivery → PUSH', () => expectPush(n.type));
    it("title", () => expect(n.title).toBe("🤝 You've Got a Partner!"));
    it('message contains partnerName', () => expect(n.message).toContain('Jamie'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
    it('metadata.partnerName', () => expect(n.metadata?.partnerName).toBe('Jamie'));
  });

  describe('partnerRequestDeclinedCaptain', () => {
    const n = doublesNotifications.partnerRequestDeclinedCaptain('Sam', 'Summer League');
    it('type string', () => expect(n.type).toBe(NOTIFICATION_TYPES.PAIR_REQUEST_REJECTED));
    // TODO: delivery map maps PAIR_REQUEST_REJECTED to IN_APP default; should be PUSH once fixed
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Partner Request Declined'));
    it('message contains partnerName', () => expect(n.message).toContain('Sam'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  describe('waitingForCaptain', () => {
    const n = doublesNotifications.waitingForCaptain('Jordan', 'Summer League');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.WAITING_FOR_CAPTAIN));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Waiting on Your Captain'));
    it('message contains captainName', () => expect(n.message).toContain('Jordan'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  describe('registrationDeadlinePartner', () => {
    const n = doublesNotifications.registrationDeadlinePartner('Summer League', 'Jordan');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.REGISTRATION_DEADLINE_PARTNER));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title contains Registration Closing', () => expect(n.title).toContain('Registration Closing'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
    it('message contains captainName', () => expect(n.message).toContain('Jordan'));
  });

  describe('teamRegistrationReminder24h', () => {
    const n = doublesNotifications.teamRegistrationReminder24h('Summer League');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.TEAM_REGISTRATION_REMINDER_24H));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Complete Your Team Registration!'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  describe('registrationDeadlineCaptain', () => {
    const n = doublesNotifications.registrationDeadlineCaptain('Summer League', 'Jordan');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.REGISTRATION_DEADLINE_CAPTAIN));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('⏰ Last Chance to Register!'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  describe('doublesTeamRegisteredPartner', () => {
    const n = doublesNotifications.doublesTeamRegisteredPartner('Jordan', 'Summer League');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.DOUBLES_TEAM_REGISTERED_PARTNER));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('✅ Team Registered!'));
    it('message contains captainName', () => expect(n.message).toContain('Jordan'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  describe('partnerLeftPartnership', () => {
    const n = doublesNotifications.partnerLeftPartnership('Alex', 'Summer League');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.PARTNERSHIP_DISSOLVED));
    it('title', () => expect(n.title).toBe('Partner Left'));
    it('message contains partnerName', () => expect(n.message).toContain('Alex'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  describe('newPartnerJoined', () => {
    const n = doublesNotifications.newPartnerJoined('Alex', 'Summer League');
    it('title', () => expect(n.title).toBe('Partner Joined!'));
    it('message contains newPartnerName', () => expect(n.message).toContain('Alex'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  // ── Match Invitation (7 new types — all PUSH) ──

  describe('partnerPostedMatch', () => {
    const n = doublesNotifications.partnerPostedMatch('Alex', 'Mon 21 Apr', '7:00 PM', 'Court 1');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.DOUBLES_PARTNER_POSTED_MATCH));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🎾 Your Partner Scheduled a Match'));
    it('message contains partnerName', () => expect(n.message).toContain('Alex'));
    it('message contains matchDate', () => expect(n.message).toContain('Mon 21 Apr'));
    it('message contains time', () => expect(n.message).toContain('7:00 PM'));
    it('message contains venue', () => expect(n.message).toContain('Court 1'));
    it('metadata.partnerName', () => expect(n.metadata?.partnerName).toBe('Alex'));
    it('metadata.matchDate', () => expect(n.metadata?.matchDate).toBe('Mon 21 Apr'));
    it('metadata.time', () => expect(n.metadata?.time).toBe('7:00 PM'));
    it('metadata.venue', () => expect(n.metadata?.venue).toBe('Court 1'));
  });

  describe('partnerConfirmedPostedMatch', () => {
    const n = doublesNotifications.partnerConfirmedPostedMatch('Alex', 'Mon 21 Apr', '7:00 PM', 'Court 1');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.DOUBLES_PARTNER_CONFIRMED_POSTED_MATCH));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('✅ Your Partner Confirmed the Match'));
    it('message contains partnerName', () => expect(n.message).toContain('Alex'));
    it('message contains matchDate', () => expect(n.message).toContain('Mon 21 Apr'));
  });

  describe('partnerDeclinedPostedMatch', () => {
    const n = doublesNotifications.partnerDeclinedPostedMatch('Alex', 'Mon 21 Apr');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.DOUBLES_PARTNER_DECLINED_POSTED_MATCH));
    it('delivery → PUSH', () => expectPush(n.type));
    it("title", () => expect(n.title).toBe("❌ Your Partner Can't Make It"));
    it('message contains partnerName', () => expect(n.message).toContain('Alex'));
    it('message contains matchDate', () => expect(n.message).toContain('Mon 21 Apr'));
    it('metadata.partnerName', () => expect(n.metadata?.partnerName).toBe('Alex'));
    it('metadata.matchDate', () => expect(n.metadata?.matchDate).toBe('Mon 21 Apr'));
  });

  describe('partnerJoinedMatch', () => {
    const n = doublesNotifications.partnerJoinedMatch('Alex', 'Mon 21 Apr', '7:00 PM', 'Court 1');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.DOUBLES_PARTNER_JOINED_MATCH));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🎾 Your Partner Accepted a Match'));
    it('message contains partnerName', () => expect(n.message).toContain('Alex'));
  });

  describe('partnerConfirmedJoinedMatch', () => {
    const n = doublesNotifications.partnerConfirmedJoinedMatch('Alex', 'Mon 21 Apr', '7:00 PM', 'Court 1');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.DOUBLES_PARTNER_CONFIRMED_JOINED_MATCH));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title contains Confirmed', () => expect(n.title).toContain('Confirmed'));
    it('message contains partnerName', () => expect(n.message).toContain('Alex'));
  });

  describe('partnerDeclinedJoinedMatch', () => {
    const n = doublesNotifications.partnerDeclinedJoinedMatch('Alex', 'Mon 21 Apr');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.DOUBLES_PARTNER_DECLINED_JOINED_MATCH));
    it('delivery → PUSH', () => expectPush(n.type));
    it("title", () => expect(n.title).toBe("❌ Your Partner Can't Make It"));
    it('message contains partnerName', () => expect(n.message).toContain('Alex'));
    it('message contains matchDate', () => expect(n.message).toContain('Mon 21 Apr'));
  });

  describe('matchCancelledPartnerDeclined', () => {
    const n = doublesNotifications.matchCancelledPartnerDeclined('Mon 21 Apr', '7:00 PM', 'Court 1');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.DOUBLES_MATCH_CANCELLED_PARTNER_DECLINED));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🚫 Match Cancelled'));
    it('message contains matchDate', () => expect(n.message).toContain('Mon 21 Apr'));
    it('metadata.matchDate', () => expect(n.metadata?.matchDate).toBe('Mon 21 Apr'));
  });
});

// ─────────────────────────────────────────────
// 3. League Lifecycle
// ─────────────────────────────────────────────

describe('League Lifecycle notifications', () => {
  describe('registrationConfirmed', () => {
    const n = leagueLifecycleNotifications.registrationConfirmed(
      'Season 1', 'Summer League', 'Open Men', '1 May 2026', 'RM150'
    );
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED));
    it('delivery → IN_APP', () => expectInApp(n.type));
    it("title", () => expect(n.title).toBe("✅ You're Registered"));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
    it('message contains categoryName', () => expect(n.message).toContain('Open Men'));
    it('message contains startDate', () => expect(n.message).toContain('1 May 2026'));
  });

  describe('matchesRemaining', () => {
    const n = leagueLifecycleNotifications.matchesRemaining('Summer League', 3);
    it('delivery → IN_APP', () => expectInApp(n.type));
    it('title', () => expect(n.title).toBe('Matches Behind Pace'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  // describe('divisionRebalanced', () => {
  //   -- commented out: divisionRebalanced helper is commented out --
  // });

  // describe('divisionUpdateNewPlayer', () => {
  //   -- commented out: divisionUpdateNewPlayer helper is commented out --
  // });

  describe('winningStreak', () => {
    const n = leagueLifecycleNotifications.winningStreak(5);
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.WINNING_STREAK));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title contains streak count', () => expect(n.title).toContain('5'));
    it('message contains streak count', () => expect(n.message).toContain('5'));
  });

  describe('scheduleMatchSoon', () => {
    const n = leagueLifecycleNotifications.scheduleMatchSoon();
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Time to Get Started'));
  });

  describe('earlySeasonNudge', () => {
    const n = leagueLifecycleNotifications.earlySeasonNudge();
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🔥 Two Weeks In'));
  });

  describe('midSeasonUpdate', () => {
    const n = leagueLifecycleNotifications.midSeasonUpdate(3, 'Division A', 'Summer League', 'Open Men');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.MID_SEASON_UPDATE));
    it('delivery → PUSH', () => expectPush(n.type));
    it("title", () => expect(n.title).toBe("📍 You're Halfway There"));
    it('message contains position', () => expect(n.message).toContain('#3'));
    it('message contains divisionName', () => expect(n.message).toContain('Division A'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
    it('message contains categoryName', () => expect(n.message).toContain('Open Men'));
  });

  describe('lateSeasonNudge', () => {
    const n = leagueLifecycleNotifications.lateSeasonNudge();
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🏁 Final Stretch'));
  });

  describe('inactivePlayerWarning7Days', () => {
    const n = leagueLifecycleNotifications.inactivePlayerWarning7Days();
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.INACTIVE_PLAYER_WARNING_7_DAYS));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Get Back On Court'));
  });

  describe('inactivityDuringLeagueSeasonNoMatch', () => {
    const n = leagueLifecycleNotifications.inactivityDuringLeagueSeasonNoMatch();
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('The League Is Heating Up'));
  });

  describe('inactivityDuringLeagueSeason2Weeks', () => {
    const n = leagueLifecycleNotifications.inactivityDuringLeagueSeason2Weeks();
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Stay in the Game'));
    it('message contains two weeks', () => expect(n.message.toLowerCase()).toContain('two weeks'));
  });

  describe('inactivityDeadline7Days', () => {
    const n = leagueLifecycleNotifications.inactivityDeadline7Days('15 May');
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🚨 Play or Forfeit. Action Needed.'));
    it('message contains midpointDate', () => expect(n.message).toContain('15 May'));
  });

  describe('inactivityDeadline3Days', () => {
    const n = leagueLifecycleNotifications.inactivityDeadline3Days('15 May', 'Summer League');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.INACTIVITY_DEADLINE_3_DAYS));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🚨 Final Warning — 3 Days Left'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  describe('finalWeekAlert', () => {
    const n = leagueLifecycleNotifications.finalWeekAlert('Season 1', 'Summer League');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.FINAL_WEEK_ALERT));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🏁 Final Week'));
    it('message contains seasonName', () => expect(n.message).toContain('Season 1'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  describe('lastMatchDeadline48h', () => {
    const n = leagueLifecycleNotifications.lastMatchDeadline48h('Season 1', 'Summer League');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.LAST_MATCH_DEADLINE_48H));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('⏳ 48 Hours Left'));
    it('message contains seasonName', () => expect(n.message).toContain('Season 1'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  describe('leagueEndedFinalResults', () => {
    const n = leagueLifecycleNotifications.leagueEndedFinalResults('Season 1', 'Summer League');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.SEASON_ENDED));
    it('delivery → PUSH', () => expectPush(n.type));
    it("title", () => expect(n.title).toBe("🏁 That's a Wrap"));
    it('message contains seasonName', () => expect(n.message).toContain('Season 1'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  describe('leagueWinner', () => {
    const n = leagueLifecycleNotifications.leagueWinner('Division A', 'Summer League', 'Open Men');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.LEAGUE_WINNER));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🏆 Champion!'));
    it('message contains divisionName', () => expect(n.message).toContain('Division A'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
    it('message contains categoryName', () => expect(n.message).toContain('Open Men'));
  });

  describe('top3Finish', () => {
    const n = leagueLifecycleNotifications.top3Finish(2, 'Division A', 'Summer League', 'Open Men');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.TOP_3_FINISH));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🏅 Top 3 Finish!'));
    it('message contains position', () => expect(n.message).toContain('#2'));
    it('message contains divisionName', () => expect(n.message).toContain('Division A'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
    it('message contains categoryName', () => expect(n.message).toContain('Open Men'));
  });

  describe('leagueCompleteBanner', () => {
    const n = leagueLifecycleNotifications.leagueCompleteBanner('Summer League', 'Season 1');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.LEAGUE_COMPLETE_BANNER));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('📊 Season Results'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  describe('leagueCancelled', () => {
    const n = leagueLifecycleNotifications.leagueCancelled('Summer League', 'Season 1');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.SEASON_CANCELLED));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('League Cancelled'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
    it('message mentions refund', () => expect(n.message.toLowerCase()).toContain('refund'));
  });

  describe('leagueExtended', () => {
    const n = leagueLifecycleNotifications.leagueExtended('Summer League', 'Season 1', '30 May');
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('More Time on the Clock'));
    it('message contains newEndDate', () => expect(n.message).toContain('30 May'));
  });

  describe('leagueShortened', () => {
    const n = leagueLifecycleNotifications.leagueShortened('Summer League', 'Season 1', '20 Apr');
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Schedule Change'));
    it('message contains newEndDate', () => expect(n.message).toContain('20 Apr'));
  });

  describe('emergencyLeagueUpdate', () => {
    const n = leagueLifecycleNotifications.emergencyLeagueUpdate('Venue changed to Court 3');
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Important League Update'));
    it('message contains the custom message', () => expect(n.message).toContain('Venue changed to Court 3'));
  });

  describe('newLeagueAnnouncement', () => {
    const n = leagueLifecycleNotifications.newLeagueAnnouncement('Summer League');
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('📢 New League Open'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  describe('newSeasonAnnouncement', () => {
    const n = leagueLifecycleNotifications.newSeasonAnnouncement('Season 2', 'Summer League');
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('📢 New Season Is Here'));
    it('message contains seasonName', () => expect(n.message).toContain('Season 2'));
  });

  describe('registrationClosing3Days', () => {
    const n = leagueLifecycleNotifications.registrationClosing3Days('Season 1', 'Summer League');
    it('delivery → PUSH', () => expectPush(n.type));
    it('title contains Registration Closing', () => expect(n.title).toContain('Registration Closing'));
    it('message contains 3 days', () => expect(n.message.toLowerCase()).toContain('3 days'));
  });

  describe('registrationClosing24Hours', () => {
    const n = leagueLifecycleNotifications.registrationClosing24Hours('Season 1');
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('⏳ Last Day to Register'));
  });

  describe('seasonStarting3Days', () => {
    const n = leagueLifecycleNotifications.seasonStarting3Days('Season 1', 'Summer League');
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('📅 Starting in 3 Days'));
    it('message contains seasonName', () => expect(n.message).toContain('Season 1'));
  });

  describe('seasonStartedWelcome', () => {
    const n = leagueLifecycleNotifications.seasonStartedWelcome('Season 1', 'Summer League');
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🟢 Game On!'));
    it('message contains seasonName', () => expect(n.message).toContain('Season 1'));
  });

  describe('paymentFailed', () => {
    const n = leagueLifecycleNotifications.paymentFailed('Season 1', 'Summer League');
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Payment Failed'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  describe('withdrawalApproved', () => {
    const n = leagueLifecycleNotifications.withdrawalApproved('Summer League');
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Withdrawal Confirmed'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
  });

  describe('refundProcessed', () => {
    const n = leagueLifecycleNotifications.refundProcessed('RM150', 'Summer League');
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Refund on Its Way'));
    it('message contains amount', () => expect(n.message).toContain('RM150'));
  });
});

// ─────────────────────────────────────────────
// 4. Match Management
// ─────────────────────────────────────────────

describe('Match Management notifications', () => {

  describe('opponentPostedLeagueMatch — 3 params (no venue)', () => {
    const n = matchManagementNotifications.opponentPostedLeagueMatch('Chris', 'Mon 21 Apr', '7:00 PM');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.OPPONENT_POSTED_LEAGUE_MATCH));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🎾 League Match Available'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    it('message contains date', () => expect(n.message).toContain('Mon 21 Apr'));
    it('message contains time', () => expect(n.message).toContain('7:00 PM'));
    // Key regression guard: venue was removed as 4th param
    it('metadata has no venue key', () => expect(n.metadata?.venue).toBeUndefined());
    it('metadata.opponentName', () => expect(n.metadata?.opponentName).toBe('Chris'));
    it('metadata.date', () => expect(n.metadata?.date).toBe('Mon 21 Apr'));
    it('metadata.time', () => expect(n.metadata?.time).toBe('7:00 PM'));
  });

  describe('leagueMatchConfirmedOpponentJoined', () => {
    const n = matchManagementNotifications.leagueMatchConfirmedOpponentJoined('Chris', 'Mon 21 Apr', '7:00 PM', 'Court 1');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.LEAGUE_MATCH_CONFIRMED_OPPONENT_JOINED));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('✅ Game On!'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
  });

  describe('leagueMatchCancelledByOpponent — 2 params (no time/venue)', () => {
    const n = matchManagementNotifications.leagueMatchCancelledByOpponent('Chris', 'Mon 21 Apr');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.LEAGUE_MATCH_CANCELLED_BY_OPPONENT));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Match Cancelled'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    it('message contains date', () => expect(n.message).toContain('Mon 21 Apr'));
    // Key regression guard: time and venue were removed
    it('metadata has no time key', () => expect(n.metadata?.time).toBeUndefined());
    it('metadata has no venue key', () => expect(n.metadata?.venue).toBeUndefined());
    it('metadata.opponentName', () => expect(n.metadata?.opponentName).toBe('Chris'));
    it('metadata.date', () => expect(n.metadata?.date).toBe('Mon 21 Apr'));
  });

  describe('friendlyMatchCancelled — 3rd param is venue (not time)', () => {
    const n = matchManagementNotifications.friendlyMatchCancelled('Chris', 'Mon 21 Apr', 'Sports Hall');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.FRIENDLY_MATCH_CANCELLED));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Match Cancelled'));
    it('message contains hostName', () => expect(n.message).toContain('Chris'));
    it('message contains date', () => expect(n.message).toContain('Mon 21 Apr'));
    it('message contains venue', () => expect(n.message).toContain('Sports Hall'));
    // Key regression guard: 3rd param is venue, not time
    it('metadata.venue is set', () => expect(n.metadata?.venue).toBe('Sports Hall'));
    it('metadata has no time key', () => expect(n.metadata?.time).toBeUndefined());
  });

  describe('playerLeftFriendlyMatch', () => {
    const n = matchManagementNotifications.playerLeftFriendlyMatch('Chris', 'Mon 21 Apr', '7:00 PM');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.PLAYER_LEFT_FRIENDLY_MATCH));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Player Left'));
    it('message contains playerName', () => expect(n.message).toContain('Chris'));
    it('message contains date', () => expect(n.message).toContain('Mon 21 Apr'));
    it('message contains time', () => expect(n.message).toContain('7:00 PM'));
  });

  describe('friendlyMatchDetailsChanged', () => {
    const n = matchManagementNotifications.friendlyMatchDetailsChanged('Chris', 'Tue 22 Apr', '8:00 PM', 'Court 2');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.FRIENDLY_MATCH_DETAILS_CHANGED));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Match Updated'));
    it('message contains hostName', () => expect(n.message).toContain('Chris'));
    it('message contains newDate', () => expect(n.message).toContain('Tue 22 Apr'));
    it('message contains newTime', () => expect(n.message).toContain('8:00 PM'));
    it('message contains newVenue', () => expect(n.message).toContain('Court 2'));
  });

  describe('matchReminder24h — 3 params (no date)', () => {
    const n = matchManagementNotifications.matchReminder24h('Chris', '7:00 PM', 'Court 1');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.MATCH_REMINDER));
    // TODO: delivery map has MATCH_REMINDER_24H but template uses MATCH_REMINDER → fix delivery map
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('📅 Match Tomorrow'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    it('message contains time', () => expect(n.message).toContain('7:00 PM'));
    it('message contains venue', () => expect(n.message).toContain('Court 1'));
    // Key regression guard: date was removed as a param
    it('metadata has no date key', () => expect(n.metadata?.date).toBeUndefined());
    it('metadata.time', () => expect(n.metadata?.time).toBe('7:00 PM'));
  });

  describe('matchReminder2h', () => {
    const n = matchManagementNotifications.matchReminder2h('Chris', '7:00 PM', 'Court 1');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.MATCH_REMINDER));
    it('title', () => expect(n.title).toBe('⏰ Match in 2 Hours'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    it('message contains venue', () => expect(n.message).toContain('Court 1'));
  });

  describe('matchMorningReminder — 3 params (no date)', () => {
    const n = matchManagementNotifications.matchMorningReminder('Chris', '7:00 PM', 'Court 1');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.MATCH_MORNING_REMINDER));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🎾 Game Day'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    it('message contains time', () => expect(n.message).toContain('7:00 PM'));
    it('message contains venue', () => expect(n.message).toContain('Court 1'));
    // Key regression guard: date was removed as a param
    it('metadata has no date key', () => expect(n.metadata?.date).toBeUndefined());
  });

  describe('matchWalkoverWon', () => {
    const n = matchManagementNotifications.matchWalkoverWon('Chris');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.MATCH_WALKOVER_WON));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Walkover Win'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
  });

  describe('matchWalkoverLost', () => {
    const n = matchManagementNotifications.matchWalkoverLost('Chris');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.MATCH_WALKOVER_LOST));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('No-Show Recorded'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    it('message mentions suspension', () => expect(n.message.toLowerCase()).toContain('suspension'));
  });

  describe('opponentClaimsNoShow', () => {
    const n = matchManagementNotifications.opponentClaimsNoShow('Chris', 'Mon 21 Apr');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.OPPONENT_CLAIMS_NO_SHOW));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('No-show Claim'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    it('message contains date', () => expect(n.message).toContain('Mon 21 Apr'));
    it('message mentions 24 hours', () => expect(n.message).toContain('24 hours'));
  });

  describe('headToHeadHistory', () => {
    const n = matchManagementNotifications.headToHeadHistory('Chris', '3-1');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.HEAD_TO_HEAD_HISTORY));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Head-to-Head'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    it('message contains record', () => expect(n.message).toContain('3-1'));
  });

  describe('scoreSubmissionReminder', () => {
    const n = matchManagementNotifications.scoreSubmissionReminder('Chris');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.SCORE_SUBMISSION_REMINDER));
    it('delivery → PUSH', () => expectPush(n.type));
    it("title", () => expect(n.title).toBe("How'd your match go?"));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
  });

  describe('opponentSubmittedScore', () => {
    const n = matchManagementNotifications.opponentSubmittedScore('Chris');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.OPPONENT_SUBMITTED_SCORE));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Confirm the Score'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
  });

  describe('pendingScoreSubmission', () => {
    const n = matchManagementNotifications.pendingScoreSubmission('Chris');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.PENDING_SCORE_SUBMISSION));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Last Call \u2013 Submit Your Score'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    it('metadata.opponentName', () => expect(n.metadata?.opponentName).toBe('Chris'));
  });

  describe('pendingScoreConfirmation', () => {
    const n = matchManagementNotifications.pendingScoreConfirmation('Chris');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.PENDING_SCORE_CONFIRMATION));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Last Call \u2013 Confirm the Score'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    it('metadata.opponentName', () => expect(n.metadata?.opponentName).toBe('Chris'));
  });

  describe('scoreConfirmed — distinct from scoreAutoConfirmed', () => {
    const n = matchManagementNotifications.scoreConfirmed('Chris');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.SCORE_CONFIRMED));
    it('type is NOT SCORE_AUTO_CONFIRMED', () => expect(n.type).not.toBe(NOTIFICATION_TYPES.SCORE_AUTO_CONFIRMED));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('\u2705 Score Confirmed'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    it('metadata.opponentName', () => expect(n.metadata?.opponentName).toBe('Chris'));
  });

  describe('scoreAutoConfirmed — 1 param only (no score param)', () => {
    const n = matchManagementNotifications.scoreAutoConfirmed('Chris');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.SCORE_AUTO_CONFIRMED));
    it('type is NOT SCORE_CONFIRMED', () => expect(n.type).not.toBe(NOTIFICATION_TYPES.SCORE_CONFIRMED));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Result Confirmed Automatically'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    // Key regression guard: score was removed as 2nd param
    it('metadata has no score key', () => expect(n.metadata?.score).toBeUndefined());
  });

  describe('forfeitDisciplinary — 1 param only (no reason param)', () => {
    const n = matchManagementNotifications.forfeitDisciplinary('Chris');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.FORFEIT_DISCIPLINARY));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Match Forfeit'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    it('message mentions conduct', () => expect(n.message.toLowerCase()).toContain('conduct'));
    // Key regression guard: reason was removed as 2nd param
    it('metadata has no reason key', () => expect(n.metadata?.reason).toBeUndefined());
  });
});

// ─────────────────────────────────────────────
// 5. Rating & Ranking
// ─────────────────────────────────────────────

describe('Rating & Ranking notifications', () => {
  describe('movedUpInStandings — 4 params including categoryName', () => {
    const n = ratingRankingNotifications.movedUpInStandings(4, 'Division A', 'Summer League', 'Open Men');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.MOVED_UP_IN_STANDINGS));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('📈 You Moved Up!'));
    it('message contains #position', () => expect(n.message).toContain('#4'));
    it('message contains divisionName', () => expect(n.message).toContain('Division A'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
    it('message contains categoryName', () => expect(n.message).toContain('Open Men'));
    it('metadata.newPosition', () => expect(n.metadata?.newPosition).toBe(4));
    it('metadata.divisionName', () => expect(n.metadata?.divisionName).toBe('Division A'));
    it('metadata.leagueName', () => expect(n.metadata?.leagueName).toBe('Summer League'));
    // Key regression guard: categoryName was added as 4th param
    it('metadata.categoryName', () => expect(n.metadata?.categoryName).toBe('Open Men'));
  });

  describe('enteredTop10 — 3 params including categoryName', () => {
    const n = ratingRankingNotifications.enteredTop10('Division A', 'Summer League', 'Open Men');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.ENTERED_TOP_10));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('⭐ Top 5! Yes, Really.'));
    it('message contains divisionName', () => expect(n.message).toContain('Division A'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
    it('message contains categoryName', () => expect(n.message).toContain('Open Men'));
    it('metadata.categoryName', () => expect(n.metadata?.categoryName).toBe('Open Men'));
  });

  describe('enteredTop3 — 4 params including categoryName', () => {
    const n = ratingRankingNotifications.enteredTop3(2, 'Division A', 'Summer League', 'Open Men');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.ENTERED_TOP_3));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title contains Podium', () => expect(n.title).toContain('Podium'));
    it('message contains #position', () => expect(n.message).toContain('#2'));
    it('message contains divisionName', () => expect(n.message).toContain('Division A'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
    it('message contains categoryName', () => expect(n.message).toContain('Open Men'));
    it('metadata.position', () => expect(n.metadata?.position).toBe(2));
    it('metadata.categoryName', () => expect(n.metadata?.categoryName).toBe('Open Men'));
  });

  describe('leagueLeader — 3 params including categoryName', () => {
    const n = ratingRankingNotifications.leagueLeader('Division A', 'Summer League', 'Open Men');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.LEAGUE_LEADER));
    it('delivery → PUSH', () => expectPush(n.type));
    it("title", () => expect(n.title).toBe("👑 You're #1!"));
    it('message contains divisionName', () => expect(n.message).toContain('Division A'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
    it('message contains categoryName', () => expect(n.message).toContain('Open Men'));
    it('metadata.categoryName', () => expect(n.metadata?.categoryName).toBe('Open Men'));
  });

  describe('dmrIncreased', () => {
    const n = ratingRankingNotifications.dmrIncreased('Tennis', 1450, 25);
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.DMR_INCREASED));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('📈 DMR Up!'));
    it('message contains sport', () => expect(n.message).toContain('Tennis'));
    it('message contains newRating', () => expect(n.message).toContain('1450'));
    it('message contains +change', () => expect(n.message).toContain('+25'));
  });

  describe('personalBestRating', () => {
    const n = ratingRankingNotifications.personalBestRating('Tennis', 1500);
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.PERSONAL_BEST_RATING));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🏅 New Personal Best!'));
    it('message contains sport', () => expect(n.message).toContain('Tennis'));
    it('message contains newRating', () => expect(n.message).toContain('1500'));
  });
});

// ─────────────────────────────────────────────
// 6. Social & Community
// ─────────────────────────────────────────────

describe('Social & Community notifications', () => {
  describe('friendActivityScorecard', () => {
    const n = socialCommunityNotifications.friendActivityScorecard('Alex');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.FRIEND_ACTIVITY_SCORECARD));
    // TODO: delivery map has FRIEND_ACTIVITY_POST but template uses FRIEND_ACTIVITY_SCORECARD → fix delivery map
    it('delivery → PUSH', () => expectPush(n.type));
    it('title equals friendName + played a match', () => expect(n.title).toBe('Alex played a match'));
    it('message contains like', () => expect(n.message.toLowerCase()).toContain('like'));
    it('metadata.friendName', () => expect(n.metadata?.friendName).toBe('Alex'));
  });

  describe('shareScorecardPrompt', () => {
    const n = socialCommunityNotifications.shareScorecardPrompt();
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.SHARE_SCORECARD_PROMPT));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Share Your Result?'));
    it('message contains scorecard', () => expect(n.message.toLowerCase()).toContain('scorecard'));
    it('metadata is empty', () => expect(Object.keys(n.metadata ?? {})).toHaveLength(0));
  });

  describe('friendRequest', () => {
    const n = socialCommunityNotifications.friendRequest('Alex');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.FRIEND_REQUEST));
    it('delivery → BOTH (push + in-app)', () => expectBoth(n.type));
    it('title', () => expect(n.title).toBe('Friend Request'));
    it('message contains playerName', () => expect(n.message).toContain('Alex'));
    it('message ends with "wants to connect."', () => expect(n.message).toBe('Alex wants to connect.'));
  });

  describe('newMessage', () => {
    const n = socialCommunityNotifications.newMessage('Alex', 'Good game!');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.NEW_MESSAGE));
    // NOTE: NEW_MESSAGE is commented out in delivery map → defaults to IN_APP (likely a bug — masterlist says PUSH)
    it('title equals senderName', () => expect(n.title).toBe('Alex'));
    it('message equals messagePreview', () => expect(n.message).toBe('Good game!'));
    it('metadata.senderName', () => expect(n.metadata?.senderName).toBe('Alex'));
    it('metadata.messagePreview', () => expect(n.metadata?.messagePreview).toBe('Good game!'));
  });

  describe('groupChatMessage', () => {
    const n = socialCommunityNotifications.groupChatMessage('Division A Chat', 'Alex', 'Who wants to play?');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.GROUP_CHAT_ADDED));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title equals groupName', () => expect(n.title).toBe('Division A Chat'));
    it('message is "senderName: preview"', () => expect(n.message).toBe('Alex: Who wants to play?'));
    it('metadata.groupName', () => expect(n.metadata?.groupName).toBe('Division A Chat'));
    it('metadata.senderName', () => expect(n.metadata?.senderName).toBe('Alex'));
  });

  describe('groupAdded', () => {
    const n = socialCommunityNotifications.groupAdded('Division A Chat');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.GROUP_CHAT_ADDED));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Added to Group Chat'));
    it('message contains groupName', () => expect(n.message).toContain('Division A Chat'));
  });
});

// ─────────────────────────────────────────────
// 7. Promotional
// ─────────────────────────────────────────────

describe('Promotional notifications', () => {
  describe('inactivePlayer14Days', () => {
    const n = promotionalNotifications.inactivePlayer14Days();
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.INACTIVE_PLAYER_14_DAYS));
    it('delivery → PUSH', () => expectPush(n.type));
    it("title", () => expect(n.title).toBe("It's Been a While"));
    it('message is non-empty', () => expect(n.message.length).toBeGreaterThan(0));
    it('metadata is empty (no params)', () => expect(Object.keys(n.metadata ?? {})).toHaveLength(0));
  });

  describe('inactivePlayer30Days', () => {
    const n = promotionalNotifications.inactivePlayer30Days();
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.INACTIVE_PLAYER_30_DAYS));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Long Time No Match'));
    it('metadata is empty (no params)', () => expect(Object.keys(n.metadata ?? {})).toHaveLength(0));
  });

  describe('leagueBetweenBreaks', () => {
    const n = promotionalNotifications.leagueBetweenBreaks('Summer League');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.LEAGUE_BETWEEN_BREAKS));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('🏆 Back for More?'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
    it('metadata.leagueName', () => expect(n.metadata?.leagueName).toBe('Summer League'));
  });

  describe('incompleteRegistration', () => {
    const n = promotionalNotifications.incompleteRegistration('Summer League');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.INCOMPLETE_REGISTRATION));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Almost There!'));
    it('message contains leagueName', () => expect(n.message).toContain('Summer League'));
    it('metadata.leagueName', () => expect(n.metadata?.leagueName).toBe('Summer League'));
  });
});

// ─────────────────────────────────────────────
// 8. Special Circumstances
// ─────────────────────────────────────────────

describe('Special Circumstances notifications', () => {
  describe('disputeSubmitted', () => {
    const n = specialCircumstancesNotifications.disputeSubmitted();
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.DISPUTE_SUBMITTED));
    it('delivery → IN_APP', () => expectInApp(n.type));
    it('title', () => expect(n.title).toBe('Dispute Submitted'));
    it('message mentions review', () => expect(n.message.toLowerCase()).toContain('review'));
    it('metadata is empty (no params)', () => expect(Object.keys(n.metadata ?? {})).toHaveLength(0));
  });

  describe('disputeResolutionRequired', () => {
    const n = specialCircumstancesNotifications.disputeResolutionRequired('Chris');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.DISPUTE_RESOLUTION_REQUIRED));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Dispute Under Review'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    it('message mentions sit tight', () => expect(n.message.toLowerCase()).toContain('sit tight'));
  });

  describe('disputeResolved', () => {
    const n = specialCircumstancesNotifications.disputeResolved('Chris');
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.DISPUTE_RESOLVED));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Dispute Resolved'));
    it('message contains opponentName', () => expect(n.message).toContain('Chris'));
    it('message mentions outcome', () => expect(n.message.toLowerCase()).toContain('outcome'));
  });

  describe('codeOfConductWarning', () => {
    const n = specialCircumstancesNotifications.codeOfConductWarning();
    it('type', () => expect(n.type).toBe(NOTIFICATION_TYPES.CODE_OF_CONDUCT_WARNING));
    it('delivery → PUSH', () => expectPush(n.type));
    it('title', () => expect(n.title).toBe('Conduct Warning'));
    it('message mentions guidelines', () => expect(n.message.toLowerCase()).toContain('guidelines'));
    it('metadata is empty (no params)', () => expect(Object.keys(n.metadata ?? {})).toHaveLength(0));
  });
});

// ─────────────────────────────────────────────
// 9. Delivery map key alignment
//
// These tests verify that the string values produced by templates exist in the
// NOTIFICATION_DELIVERY_MAP with the correct delivery type.  A failure here
// means the delivery map key doesn't match the type string the template emits —
// the real notification will silently fall back to IN_APP.
// ─────────────────────────────────────────────

describe('Delivery map alignment — type strings that must resolve to PUSH', () => {
  const mustBePush = [
    // Doubles — types that ARE correctly mapped
    NOTIFICATION_TYPES.WAITING_FOR_CAPTAIN,
    NOTIFICATION_TYPES.REGISTRATION_DEADLINE_PARTNER,
    NOTIFICATION_TYPES.REGISTRATION_DEADLINE_CAPTAIN,
    NOTIFICATION_TYPES.TEAM_REGISTRATION_REMINDER_24H,
    NOTIFICATION_TYPES.DOUBLES_TEAM_REGISTERED_PARTNER,
    NOTIFICATION_TYPES.DOUBLES_PARTNER_POSTED_MATCH,
    NOTIFICATION_TYPES.DOUBLES_PARTNER_CONFIRMED_POSTED_MATCH,
    NOTIFICATION_TYPES.DOUBLES_PARTNER_DECLINED_POSTED_MATCH,
    NOTIFICATION_TYPES.DOUBLES_PARTNER_JOINED_MATCH,
    NOTIFICATION_TYPES.DOUBLES_PARTNER_CONFIRMED_JOINED_MATCH,
    NOTIFICATION_TYPES.DOUBLES_PARTNER_DECLINED_JOINED_MATCH,
    NOTIFICATION_TYPES.DOUBLES_MATCH_CANCELLED_PARTNER_DECLINED,
    // Match Management
    NOTIFICATION_TYPES.OPPONENT_POSTED_LEAGUE_MATCH,
    NOTIFICATION_TYPES.LEAGUE_MATCH_CONFIRMED_OPPONENT_JOINED,
    NOTIFICATION_TYPES.LEAGUE_MATCH_CANCELLED_BY_OPPONENT,
    NOTIFICATION_TYPES.FRIENDLY_MATCH_CANCELLED,
    NOTIFICATION_TYPES.PLAYER_LEFT_FRIENDLY_MATCH,
    NOTIFICATION_TYPES.FRIENDLY_MATCH_DETAILS_CHANGED,
    NOTIFICATION_TYPES.MATCH_MORNING_REMINDER,
    NOTIFICATION_TYPES.MATCH_WALKOVER_WON,
    NOTIFICATION_TYPES.MATCH_WALKOVER_LOST,
    NOTIFICATION_TYPES.OPPONENT_CLAIMS_NO_SHOW,
    NOTIFICATION_TYPES.HEAD_TO_HEAD_HISTORY,
    NOTIFICATION_TYPES.SCORE_SUBMISSION_REMINDER,
    NOTIFICATION_TYPES.OPPONENT_SUBMITTED_SCORE,
    NOTIFICATION_TYPES.PENDING_SCORE_SUBMISSION,
    NOTIFICATION_TYPES.PENDING_SCORE_CONFIRMATION,
    NOTIFICATION_TYPES.SCORE_CONFIRMED,
    NOTIFICATION_TYPES.SCORE_AUTO_CONFIRMED,
    NOTIFICATION_TYPES.FORFEIT_DISCIPLINARY,
    // Rating & Ranking
    NOTIFICATION_TYPES.MOVED_UP_IN_STANDINGS,
    NOTIFICATION_TYPES.ENTERED_TOP_10,
    NOTIFICATION_TYPES.ENTERED_TOP_3,
    NOTIFICATION_TYPES.LEAGUE_LEADER,
    NOTIFICATION_TYPES.DMR_INCREASED,
    NOTIFICATION_TYPES.PERSONAL_BEST_RATING,
    // Social
    NOTIFICATION_TYPES.SHARE_SCORECARD_PROMPT,
    NOTIFICATION_TYPES.FRIEND_REQUEST,
    NOTIFICATION_TYPES.GROUP_CHAT_ADDED,
    // Promotional
    NOTIFICATION_TYPES.INACTIVE_PLAYER_14_DAYS,
    NOTIFICATION_TYPES.INACTIVE_PLAYER_30_DAYS,
    NOTIFICATION_TYPES.LEAGUE_BETWEEN_BREAKS,
    NOTIFICATION_TYPES.INCOMPLETE_REGISTRATION,
    // Special Circumstances
    NOTIFICATION_TYPES.DISPUTE_RESOLUTION_REQUIRED,
    NOTIFICATION_TYPES.DISPUTE_RESOLVED,
    NOTIFICATION_TYPES.CODE_OF_CONDUCT_WARNING,
    // League Lifecycle
    NOTIFICATION_TYPES.WINNING_STREAK,
    NOTIFICATION_TYPES.SCHEDULE_MATCH_SOON,
    NOTIFICATION_TYPES.EARLY_SEASON_NUDGE,
    NOTIFICATION_TYPES.MID_SEASON_UPDATE,
    NOTIFICATION_TYPES.LATE_SEASON_NUDGE,
    NOTIFICATION_TYPES.INACTIVE_PLAYER_WARNING_7_DAYS,
    NOTIFICATION_TYPES.INACTIVITY_DURING_LEAGUE_SEASON_2_WEEKS,
    NOTIFICATION_TYPES.INACTIVITY_DEADLINE_7_DAYS,
    NOTIFICATION_TYPES.INACTIVITY_DEADLINE_3_DAYS,
    NOTIFICATION_TYPES.FINAL_WEEK_ALERT,
    NOTIFICATION_TYPES.LAST_MATCH_DEADLINE_48H,
    NOTIFICATION_TYPES.SEASON_ENDED,
    NOTIFICATION_TYPES.LEAGUE_WINNER,
    NOTIFICATION_TYPES.TOP_3_FINISH,
    NOTIFICATION_TYPES.LEAGUE_COMPLETE_BANNER,
    NOTIFICATION_TYPES.SEASON_CANCELLED,
    NOTIFICATION_TYPES.LEAGUE_EXTENDED,
    NOTIFICATION_TYPES.LEAGUE_SHORTENED,
    NOTIFICATION_TYPES.EMERGENCY_LEAGUE_UPDATE,
    NOTIFICATION_TYPES.LEAGUE_ANNOUNCEMENT,
    NOTIFICATION_TYPES.NEW_SEASON_ANNOUNCEMENT,
    NOTIFICATION_TYPES.REGISTRATION_CLOSING_3_DAYS,
    NOTIFICATION_TYPES.REGISTRATION_CLOSING_24_HOURS,
    NOTIFICATION_TYPES.LEAGUE_STARTING_3_DAYS,
    NOTIFICATION_TYPES.LEAGUE_STARTED_WELCOME,
    NOTIFICATION_TYPES.PAYMENT_FAILED,
    NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_APPROVED,
    NOTIFICATION_TYPES.REFUND_PROCESSED,
    // Account
    NOTIFICATION_TYPES.STREAK_AT_RISK,
  ];

  test.each(mustBePush)('PUSH: %s', (type) => {
    expect(shouldSendPushNotification(type)).toBe(true);
  });
});

describe('Delivery map alignment — type strings that must resolve to IN_APP', () => {
  const mustBeInApp = [
    NOTIFICATION_TYPES.PROFILE_INCOMPLETE_REMINDER,
    NOTIFICATION_TYPES.PROFILE_PHOTO_MISSING,
    NOTIFICATION_TYPES.TOS_UPDATED,
    NOTIFICATION_TYPES.NEW_WEEKLY_STREAK,
    NOTIFICATION_TYPES.PARTNER_REQUEST_SENT,
    NOTIFICATION_TYPES.DOUBLES_TEAM_REGISTERED_CAPTAIN,
    NOTIFICATION_TYPES.FRIENDLY_MATCH_POSTED,
    NOTIFICATION_TYPES.DISPUTE_SUBMITTED,
  ];

  test.each(mustBeInApp)('IN_APP: %s', (type) => {
    expect(shouldSendPushNotification(type)).toBe(false);
    expect(shouldCreateInAppRecord(type)).toBe(true);
  });
});

/**
 * ── Known delivery map misalignments (documented failures) ──
 *
 * The following NOTIFICATION_TYPES string values are produced by templates but
 * are NOT present in NOTIFICATION_DELIVERY_MAP, causing them to default to
 * IN_APP instead of their intended PUSH delivery.  Fix by adding the missing
 * keys to `src/types/notificationDeliveryTypes.ts`:
 *
 *   PAIR_REQUEST_RECEIVED:    NotificationDeliveryType.PUSH,
 *   PAIR_REQUEST_ACCEPTED:    NotificationDeliveryType.PUSH,
 *   PAIR_REQUEST_REJECTED:    NotificationDeliveryType.PUSH,   // captain-facing decline
 *   MATCH_REMINDER:           NotificationDeliveryType.PUSH,   // used by both matchReminder24h and matchReminder2h
 *   FRIEND_ACTIVITY_SCORECARD:NotificationDeliveryType.PUSH,
 *
 * Additionally, `NEW_MESSAGE` is commented out in the map — uncomment it
 * (or add) as PUSH if direct-message notifications should reach the push channel.
 */
