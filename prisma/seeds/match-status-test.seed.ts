/**
 * Match Status Test Seed
 *
 * Creates test matches between willy@test.com and ken@test.com
 * to test all match status scenarios in the frontend.
 *
 * Run with: npx tsx prisma/seeds/match-status-test.seed.ts
 *
 * This seed covers ALL 7 match statuses with edge cases:
 * - SCHEDULED: Future, Soon, Now, Past (overdue), No Court
 * - DRAFT: Pending, Declined, Expired
 * - ONGOING: Awaiting confirmation, Disputed, Near auto-approve
 * - COMPLETED: Normal, Walkover, Was Disputed, Auto-approved
 * - CANCELLED: Early, Late (penalty), Weather, Injury
 * - UNFINISHED: Rain delay, Player injury, Time limit
 * - VOID: Admin action, Cheating detected
 */

import {
  PrismaClient,
  MatchStatus,
  MatchType,
  MatchFormat,
  ParticipantRole,
  InvitationStatus,
  WalkoverReason,
  CancellationReason,
  DisputeCategory,
  DisputeStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

// =============================================
// DATE HELPERS
// =============================================

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

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
// MAIN SEED FUNCTION
// =============================================

async function seedMatchStatusTests() {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       MATCH STATUS TEST SEEDING (COMPREHENSIVE)              ║");
  console.log("║       For willy@test.com and ken@test.com                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("\n");

  // Find the two test users
  const willy = await prisma.user.findFirst({
    where: { email: "willy@test.com" },
  });

  const ken = await prisma.user.findFirst({
    where: { email: "ken@test.com" },
  });

  if (!willy || !ken) {
    console.error("❌ Could not find test users!");
    console.error("   willy@test.com:", willy ? "Found" : "NOT FOUND");
    console.error("   ken@test.com:", ken ? "Found" : "NOT FOUND");
    console.error("\n   Please ensure both users are registered and onboarded.");
    return;
  }

  console.log("✅ Found test users:");
  console.log(`   - Willy: ${willy.id} (${willy.name})`);
  console.log(`   - Ken: ${ken.id} (${ken.name})`);

  // Find an active division they can use
  const division = await prisma.division.findFirst({
    where: {
      isActiveDivision: true,
      gameType: "SINGLES",
    },
    include: {
      season: true,
      league: true,
    },
  });

  if (!division) {
    console.error("❌ No active division found!");
    console.error("   Please run the main seed first: npx prisma db seed");
    return;
  }

  console.log(`\n✅ Using division: ${division.name}`);
  console.log(`   League: ${division.league.name}`);
  console.log(`   Season: ${division.season.name}`);

  // Ensure both users are members of the division
  for (const user of [willy, ken]) {
    const existingMembership = await prisma.seasonMembership.findFirst({
      where: {
        userId: user.id,
        seasonId: division.seasonId,
      },
    });

    if (!existingMembership) {
      await prisma.seasonMembership.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId,
          divisionId: division.id,
          status: "ACTIVE",
          paymentStatus: "COMPLETED",
          joinedAt: new Date(),
        },
      });
      console.log(`   Added ${user.name} to division`);
    }
  }

  // Clean up any existing test matches between these users
  console.log("\n🧹 Cleaning up existing test matches...");
  const existingMatches = await prisma.match.findMany({
    where: {
      OR: [
        { createdById: willy.id },
        { createdById: ken.id },
      ],
      participants: {
        some: {
          userId: {
            in: [willy.id, ken.id],
          },
        },
      },
    },
  });

  for (const match of existingMatches) {
    // Delete related records first
    await prisma.matchDispute.deleteMany({ where: { matchId: match.id } });
    await prisma.matchParticipant.deleteMany({ where: { matchId: match.id } });
    await prisma.matchInvitation.deleteMany({ where: { matchId: match.id } });
    await prisma.matchScore.deleteMany({ where: { matchId: match.id } });
    await prisma.pickleballGameScore.deleteMany({ where: { matchId: match.id } });
    await prisma.matchResult.deleteMany({ where: { matchId: match.id } });
    await prisma.match.delete({ where: { id: match.id } });
  }
  console.log(`   Deleted ${existingMatches.length} existing test matches`);

  // =============================================
  // CREATE TEST MATCHES FOR EACH STATUS
  // =============================================

  console.log("\n📝 Creating comprehensive test matches...\n");

  interface MatchConfig {
    name: string;
    status: MatchStatus;
    matchDate: Date;
    creator: typeof willy;
    opponent: typeof ken;
    creatorStatus: InvitationStatus;
    opponentStatus: InvitationStatus;
    courtBooked?: boolean;
    notes?: string;
    venue?: string;
    resultSubmittedBy?: typeof willy | typeof ken;
    resultSubmittedAt?: Date;
    resultConfirmedBy?: typeof willy | typeof ken;
    playerScore?: number;
    opponentScore?: number;
    setScores?: string;
    isWalkover?: boolean;
    walkoverReason?: WalkoverReason;
    isDisputed?: boolean;
    isLateCancellation?: boolean;
    cancelledBy?: typeof willy | typeof ken;
    cancellationReason?: CancellationReason;
    adminNotes?: string;
    isAutoApproved?: boolean;
    // For creating disputes
    createDispute?: {
      category: DisputeCategory;
      reason: string;
      disputerScore?: { team1Score: number; team2Score: number };
    };
  }

  const matchConfigs: MatchConfig[] = [
    // =============================================
    // SCHEDULED STATUS (5 scenarios)
    // =============================================

    // 1. SCHEDULED - Future match (3 days away)
    {
      name: "SCHEDULED - Future (3 days)",
      status: MatchStatus.SCHEDULED,
      matchDate: daysFromNow(3),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      courtBooked: true,
      notes: `🧪 TEST: SCHEDULED - Future Match (3 days away)

📋 WHAT TO TEST:
• Match displays correctly in "Upcoming" section
• Cancel Match button should be available (not late cancellation)
• No "Add Result" button yet (match hasn't started)

✅ EXPECTED BEHAVIOR:
• Status badge shows "Scheduled"
• Date/time displays correctly (3 days from now)
• Court booked indicator shows green checkmark
• Can message opponent via chat

🎯 HOW TO RESOLVE:
• Wait for match date, then submit result after playing
• OR cancel if needed (no penalty - more than 4 hours away)`,
      venue: "Court A - Main Building",
    },

    // 2. SCHEDULED - Match starting soon (2 hours)
    {
      name: "SCHEDULED - Starting Soon (2hr)",
      status: MatchStatus.SCHEDULED,
      matchDate: hoursFromNow(2),
      creator: ken,
      opponent: willy,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      courtBooked: true,
      notes: `🧪 TEST: SCHEDULED - Starting Soon (2 hours)

📋 WHAT TO TEST:
• Match appears at top of scheduled matches (soonest first)
• Cancel button shows LATE CANCELLATION WARNING (< 4 hours)
• "Add Result" button NOT visible yet

✅ EXPECTED BEHAVIOR:
• Status shows "Scheduled" with urgency indicator
• Cancel shows warning: "This will result in a penalty"
• Time displays as "Starting in 2 hours" or similar

🎯 HOW TO RESOLVE:
• Play the match when time comes
• Submit result after match completes
• If canceling: Accept the late cancellation penalty`,
      venue: "Court B - West Wing",
    },

    // 3. SCHEDULED - Match playable NOW (for testing Add Result)
    {
      name: "SCHEDULED - Play Now!",
      status: MatchStatus.SCHEDULED,
      matchDate: minutesAgo(30), // Started 30 mins ago
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      courtBooked: true,
      notes: `🧪 TEST: SCHEDULED - Play Now! (Submit Result)

📋 WHAT TO TEST:
• "Add Result" button is NOW VISIBLE (match time has passed)
• Test the full result submission flow
• Try the "Match incomplete" toggle for unfinished matches

✅ EXPECTED BEHAVIOR:
• Tap "Add Result" → Opens result submission sheet
• Enter scores for each game (best of 3)
• Toggle "Match incomplete" if match wasn't finished
• Submit → Status changes to ONGOING (awaiting confirmation)

🎯 HOW TO RESOLVE:
1. Tap "Add Result"
2. Enter scores: Game 1: 15-10, Game 2: 12-15, Game 3: 15-8
3. Submit result
4. Login as opponent (ken@test.com) to confirm`,
      venue: "Court 1 - Premium",
    },

    // 4. SCHEDULED - Match overdue (past time, no result yet)
    {
      name: "SCHEDULED - Overdue (needs result)",
      status: MatchStatus.SCHEDULED,
      matchDate: hoursAgo(5), // Match was 5 hours ago
      creator: ken,
      opponent: willy,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      courtBooked: true,
      notes: `🧪 TEST: SCHEDULED - Overdue (5 hours past)

📋 WHAT TO TEST:
• Match shows "overdue" or urgent styling
• "Add Result" button is prominently displayed
• System may send reminder notifications

✅ EXPECTED BEHAVIOR:
• Status shows overdue/needs attention indicator
• Both players can submit result
• May show warning: "Please submit result"

🎯 HOW TO RESOLVE:
1. Either player taps "Add Result"
2. Enter the match scores
3. Other player confirms or disputes
4. If match didn't happen: Use "Report Walkover" or cancel`,
      venue: "Court 2",
    },

    // 5. SCHEDULED - No court booked
    {
      name: "SCHEDULED - No Court Booked",
      status: MatchStatus.SCHEDULED,
      matchDate: daysFromNow(7),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      courtBooked: false,
      notes: `🧪 TEST: SCHEDULED - No Court Booked

📋 WHAT TO TEST:
• Court status shows RED "Court not booked" badge
• Match still appears in schedule
• Players should coordinate to book court

✅ EXPECTED BEHAVIOR:
• Location shows "TBD"
• Red badge: "Court not booked" with X icon
• Match is otherwise valid and scheduled

🎯 HOW TO RESOLVE:
1. Coordinate with opponent to find a court
2. Edit match to update location (if edit feature exists)
3. Book court externally and update match details`,
      venue: "TBD",
    },

    // =============================================
    // DRAFT STATUS (3 scenarios)
    // =============================================

    // 6. DRAFT - Invitation pending (waiting for response)
    {
      name: "DRAFT - Pending Response",
      status: MatchStatus.DRAFT,
      matchDate: daysFromNow(5),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.PENDING,
      courtBooked: true,
      notes: `🧪 TEST: DRAFT - Pending Invitation Response

📋 WHAT TO TEST:
• As Willy: See "Draft" badge with "Awaiting responses" secondary text
• As Ken: Check Invitations tab for pending invite
• Ken should see Accept/Decline buttons
• Badge should show YELLOW color (hourglass icon)

✅ EXPECTED BEHAVIOR:
• Willy sees: Yellow "Draft" badge with hourglass icon
• Secondary text: "Awaiting responses"
• Ken sees: Match invitation in notifications/invitations
• Ken can Accept → Match becomes SCHEDULED
• Ken can Decline → Match stays DRAFT with declined status

🎯 HOW TO RESOLVE:
1. Login as ken@test.com
2. Go to Invitations or Notifications
3. Find this match invitation
4. Tap "Accept" to confirm → Status becomes SCHEDULED
   OR Tap "Decline" to reject`,
      venue: "Court 2",
    },

    // 7. DRAFT - Invitation declined
    {
      name: "DRAFT - Declined",
      status: MatchStatus.DRAFT,
      matchDate: daysFromNow(4),
      creator: ken,
      opponent: willy,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.DECLINED,
      courtBooked: true,
      notes: `🧪 TEST: DRAFT - Invitation Declined

📋 WHAT TO TEST:
• Creator (Ken) sees RED "Draft" badge with close-circle icon
• Secondary text: "Invitation declined"
• Action hint: "Invite another player"

✅ EXPECTED BEHAVIOR:
• Ken sees: Red "Draft" badge with X icon
• Secondary text: "Invitation declined"
• Decline reason may be shown: "Schedule conflict"
• Creator can: Delete match OR invite someone else

🎯 HOW TO RESOLVE:
• As Ken: Delete this draft and create new match
• OR: Edit match to invite a different opponent
• This match cannot proceed as-is`,
      venue: "Court 3",
    },

    // 8. DRAFT - Invitation expired (old invitation)
    {
      name: "DRAFT - Expired Invitation",
      status: MatchStatus.DRAFT,
      matchDate: daysAgo(2), // Match date already passed
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.EXPIRED,
      courtBooked: false,
      notes: `🧪 TEST: DRAFT - Expired Invitation

📋 WHAT TO TEST:
• Creator (Willy) sees GRAY "Draft" badge with time-outline icon
• Secondary text: "Invitation expired"
• Action hint: "Send new invitation"

✅ EXPECTED BEHAVIOR:
• Willy sees: Gray "Draft" badge with clock icon
• Secondary text: "Invitation expired"
• Match date shows as past (2 days ago)
• Action: Delete match or resend invitation

🎯 HOW TO RESOLVE:
• Delete this draft match
• Create a new match with future date
• Send new invitation to opponent`,
      venue: "Court 1",
    },

    // 8.5. DRAFT - All Accepted (ready to schedule)
    {
      name: "DRAFT - All Accepted",
      status: MatchStatus.DRAFT,
      matchDate: daysFromNow(6),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      courtBooked: false,
      notes: `🧪 TEST: DRAFT - All Players Accepted (Ready to Schedule)

📋 WHAT TO TEST:
• Creator (Willy) sees GREEN "Draft" badge with checkmark icon
• Secondary text: "Players confirmed"
• Action hint: "Schedule the match"

✅ EXPECTED BEHAVIOR:
• Willy sees: Green "Draft" badge with checkmark-circle icon
• Secondary text: "Players confirmed"
• Both players have accepted
• Need to finalize scheduling/court booking

🎯 HOW TO RESOLVE:
• Book a court
• Finalize match date/time
• Match will become SCHEDULED once finalized`,
      venue: "TBD",
    },

    // =============================================
    // ONGOING STATUS (5 scenarios)
    // =============================================

    // 9. ONGOING - Result submitted by creator, awaiting opponent
    {
      name: "ONGOING - Awaiting Ken's Confirm",
      status: MatchStatus.ONGOING,
      matchDate: hoursAgo(3),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      resultSubmittedBy: willy,
      resultSubmittedAt: new Date(), // Just submitted
      playerScore: 2,
      opponentScore: 1,
      courtBooked: true,
      notes: `🧪 TEST: ONGOING - Awaiting Opponent Confirmation

📋 WHAT TO TEST:
• As Willy (submitter): See "Awaiting confirmation" status
• As Ken (opponent): See Confirm/Dispute buttons
• 24-hour auto-approval countdown should be visible

✅ EXPECTED BEHAVIOR:
• Willy sees: "Waiting for Ken to confirm" message
• Willy sees: Submitted scores (2-1)
• Ken sees: "Confirm Result" and "Dispute" buttons
• Countdown timer shows ~24 hours remaining

🎯 HOW TO RESOLVE:
1. Login as ken@test.com
2. Open this match
3. Review the scores: 15-10, 8-15, 15-12
4. Tap "Confirm" if correct → Status becomes COMPLETED
   OR tap "Dispute" if wrong → Opens dispute flow`,
      venue: "Court A",
      setScores: JSON.stringify([
        { gameNumber: 1, team1Points: 15, team2Points: 10 },
        { gameNumber: 2, team1Points: 8, team2Points: 15 },
        { gameNumber: 3, team1Points: 15, team2Points: 12 },
      ]),
    },

    // 10. ONGOING - Result submitted by opponent, you need to confirm/dispute
    {
      name: "ONGOING - You Need to Confirm!",
      status: MatchStatus.ONGOING,
      matchDate: hoursAgo(5),
      creator: ken,
      opponent: willy,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      resultSubmittedBy: ken,
      resultSubmittedAt: new Date(),
      playerScore: 2,
      opponentScore: 0,
      courtBooked: true,
      notes: `🧪 TEST: ONGOING - You Need to Confirm! (Action Required)

📋 WHAT TO TEST:
• As Willy: This is YOUR action item - confirm or dispute
• Test the "Confirm Result" button flow
• Test the "Dispute Score" button flow

✅ EXPECTED BEHAVIOR:
• Match shows prominently at top of list (ONGOING priority)
• "Confirm Result" button is visible and tappable
• "Dispute Score" button opens dispute page
• Score shows: Ken won 2-0 (15-8, 15-11)

🎯 HOW TO RESOLVE:
Option A - Confirm (if score is correct):
1. Tap "Confirm Result"
2. Match becomes COMPLETED

Option B - Dispute (if score is wrong):
1. Tap "Dispute Score"
2. Select dispute category (Wrong Score, etc.)
3. Enter your version of the score
4. Optionally add screenshots as evidence
5. Submit dispute → Admin reviews`,
      venue: "Court B",
      setScores: JSON.stringify([
        { gameNumber: 1, team1Points: 15, team2Points: 8 },
        { gameNumber: 2, team1Points: 15, team2Points: 11 },
      ]),
    },

    // 11. ONGOING - Near auto-approval (submitted 23 hours ago)
    {
      name: "ONGOING - Auto-approve Soon!",
      status: MatchStatus.ONGOING,
      matchDate: hoursAgo(26),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      resultSubmittedBy: willy,
      resultSubmittedAt: hoursAgo(23), // 23 hours ago - 1 hour until auto-approve
      playerScore: 2,
      opponentScore: 1,
      courtBooked: true,
      notes: `🧪 TEST: ONGOING - Auto-Approval Countdown (~1 hour left!)

📋 WHAT TO TEST:
• Countdown timer shows ~1 hour remaining
• Urgent styling/warning for approaching deadline
• Ken can still confirm/dispute before auto-approval

✅ EXPECTED BEHAVIOR:
• Timer shows: "Auto-approves in ~1 hour"
• Warning color (orange/red) on countdown
• If Ken doesn't act, result auto-confirms after 24 hours
• Score: Willy won 2-1 (15-11, 11-15, 15-9)

🎯 HOW TO RESOLVE:
Before auto-approval (as Ken):
• Confirm: Tap "Confirm" → Immediately COMPLETED
• Dispute: Tap "Dispute" → Stops auto-approval, admin reviews

After auto-approval (if 24 hours pass):
• Result automatically confirmed
• Match becomes COMPLETED
• Ken loses ability to dispute`,
      venue: "Court C",
      setScores: JSON.stringify([
        { gameNumber: 1, team1Points: 15, team2Points: 11 },
        { gameNumber: 2, team1Points: 11, team2Points: 15 },
        { gameNumber: 3, team1Points: 15, team2Points: 9 },
      ]),
    },

    // 12. ONGOING - Disputed (waiting for admin review)
    {
      name: "ONGOING - Disputed (Admin Review)",
      status: MatchStatus.ONGOING,
      matchDate: hoursAgo(8),
      creator: ken,
      opponent: willy,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      resultSubmittedBy: ken,
      resultSubmittedAt: hoursAgo(6),
      playerScore: 2,
      opponentScore: 0,
      isDisputed: true,
      courtBooked: true,
      notes: `🧪 TEST: ONGOING - Disputed (Awaiting Admin Review)

📋 WHAT TO TEST:
• Red "View Scores (Disputed)" button visible
• Tap button → See scores + dispute details
• Dispute details panel shows:
  - Who disputed: Willy
  - Category: WRONG SCORE
  - Reason: "The scores are incorrect..."
  - Claimed score: 10-15, 15-12, 11-15
  - Status: OPEN

✅ EXPECTED BEHAVIOR:
• Match card shows "Disputed" badge (red)
• Both Ken and Willy see "View Scores (Disputed)" button
• Tapping opens MatchResultSheet in 'disputed' mode
• Shows submitted scores (Ken's: 15-10, 15-12)
• Shows red banner with dispute info
• Only "Close" button available (no actions)

🎯 HOW TO RESOLVE:
• Players: Wait for admin decision
• Admin (via admin panel):
  1. Review dispute details
  2. Check evidence (if any)
  3. Contact players if needed
  4. Make final ruling on correct score
  5. Resolve dispute → Match becomes COMPLETED`,
      venue: "Court D",
      setScores: JSON.stringify([
        { gameNumber: 1, team1Points: 15, team2Points: 10 },
        { gameNumber: 2, team1Points: 15, team2Points: 12 },
      ]),
      createDispute: {
        category: DisputeCategory.WRONG_SCORE,
        reason: "The scores are incorrect. I won 2-1, not lost 0-2. Ken made a mistake when entering.",
        // Game-by-game scores that disputer claims are correct
        disputerScore: [
          { gameNumber: 1, team1Points: 10, team2Points: 15 },
          { gameNumber: 2, team1Points: 15, team2Points: 12 },
          { gameNumber: 3, team1Points: 11, team2Points: 15 },
        ],
      },
    },

    // 13. ONGOING - Disputed with evidence
    {
      name: "ONGOING - Disputed (With Evidence)",
      status: MatchStatus.ONGOING,
      matchDate: daysAgo(1),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      resultSubmittedBy: willy,
      resultSubmittedAt: hoursAgo(20),
      playerScore: 2,
      opponentScore: 1,
      isDisputed: true,
      courtBooked: true,
      notes: `🧪 TEST: ONGOING - Disputed with Screenshot Evidence

📋 WHAT TO TEST:
• Red "View Scores (Disputed)" button visible
• Tap button → See scores + dispute details with evidence
• Dispute details panel shows:
  - Who disputed: Ken
  - Category: WRONG SCORE
  - Reason: "I have photos of the scorecard..."
  - Claimed score: 13-15, 15-10, 13-15
  - Evidence: "Attachment provided"
  - Status: OPEN

✅ EXPECTED BEHAVIOR:
• Match card shows "Disputed" badge (red)
• Both Willy and Ken see "View Scores (Disputed)" button
• Tapping opens MatchResultSheet in 'disputed' mode
• Shows submitted scores (Willy's: 15-13, 10-15, 15-11)
• Shows red banner with dispute info + evidence indicator
• Only "Close" button available (no actions)

🎯 HOW TO RESOLVE:
• Admin reviews evidence screenshots (via admin panel)
• Compares with submitted scores
• Makes ruling based on evidence
• Resolution updates match to COMPLETED with correct score`,
      venue: "Court E",
      setScores: JSON.stringify([
        { gameNumber: 1, team1Points: 15, team2Points: 13 },
        { gameNumber: 2, team1Points: 10, team2Points: 15 },
        { gameNumber: 3, team1Points: 15, team2Points: 11 },
      ]),
      createDispute: {
        category: DisputeCategory.WRONG_SCORE,
        reason: "I have photos of the scorecard showing different results. The third game was 15-13 in my favor, not 15-11.",
        // Game-by-game scores that disputer (Ken) claims are correct
        disputerScore: [
          { gameNumber: 1, team1Points: 13, team2Points: 15 },
          { gameNumber: 2, team1Points: 15, team2Points: 10 },
          { gameNumber: 3, team1Points: 13, team2Points: 15 },
        ],
        // Screenshots are uploaded and stored as comma-separated URLs
        evidenceUrl: "https://storage.example.com/disputes/screenshot1.jpg,https://storage.example.com/disputes/screenshot2.jpg",
      },
    },

    // =============================================
    // COMPLETED STATUS (5 scenarios)
    // =============================================

    // 14. COMPLETED - Normal completion
    {
      name: "COMPLETED - Normal Win",
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(2),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      resultSubmittedBy: willy,
      resultConfirmedBy: ken,
      playerScore: 2,
      opponentScore: 1,
      courtBooked: true,
      notes: `🧪 TEST: COMPLETED - Normal Match (Confirmed)

📋 WHAT TO TEST:
• Match displays in "Past Matches" / history section
• Final score is visible (2-1)
• No action buttons (match is final)
• Match counts toward standings/stats

✅ EXPECTED BEHAVIOR:
• Status: "Completed" with green indicator
• Winner shown: Willy (2-1)
• Game scores visible: 15-10, 11-15, 15-13
• Both players' stats updated

🎯 THIS IS THE END STATE:
• No actions needed - this is a successfully completed match
• Result is final and recorded
• Points awarded to standings`,
      venue: "Center Court",
      setScores: JSON.stringify([
        { gameNumber: 1, team1Points: 15, team2Points: 10 },
        { gameNumber: 2, team1Points: 11, team2Points: 15 },
        { gameNumber: 3, team1Points: 15, team2Points: 13 },
      ]),
    },

    // 15. COMPLETED - Walkover (no-show)
    {
      name: "COMPLETED - Walkover (No Show)",
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(5),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      isWalkover: true,
      walkoverReason: WalkoverReason.NO_SHOW,
      playerScore: 2,
      opponentScore: 0,
      courtBooked: true,
      notes: `🧪 TEST: COMPLETED - Walkover (No Show)

📋 WHAT TO TEST:
• "Walkover" badge is displayed
• Reason shown: "No Show"
• Winner awarded without actual play

✅ EXPECTED BEHAVIOR:
• Status: "Completed - Walkover"
• Reason: "Opponent did not show"
• Willy wins by default (2-0)
• Ken may have penalty recorded

🎯 HOW THIS HAPPENED:
1. Match was scheduled
2. Ken didn't arrive at court
3. Willy reported walkover via "Report Walkover" button
4. System awarded win to Willy`,
      venue: "Court 1",
    },

    // 16. COMPLETED - Walkover (injury during match)
    {
      name: "COMPLETED - Walkover (Injury)",
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(4),
      creator: ken,
      opponent: willy,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      isWalkover: true,
      walkoverReason: WalkoverReason.INJURY,
      playerScore: 2,
      opponentScore: 0,
      courtBooked: true,
      notes: `🧪 TEST: COMPLETED - Walkover (Injury Retirement)

📋 WHAT TO TEST:
• "Walkover" badge with "Injury" reason
• No penalty applied (injury is excused)
• Partial scores may be shown if any games completed

✅ EXPECTED BEHAVIOR:
• Status: "Completed - Walkover"
• Reason: "Injury"
• Ken wins by retirement
• Willy's injury noted (no penalty)

🎯 HOW THIS HAPPENED:
1. Match started normally
2. Willy injured during second game
3. Willy retired from match
4. Ken awarded walkover win`,
      venue: "Court 3",
    },

    // 17. COMPLETED - Was disputed (resolved by admin)
    {
      name: "COMPLETED - Was Disputed",
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(10),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      resultSubmittedBy: willy,
      resultConfirmedBy: ken,
      playerScore: 2,
      opponentScore: 1,
      isDisputed: true,
      courtBooked: true,
      notes: `🧪 TEST: COMPLETED - Previously Disputed (Resolved)

📋 WHAT TO TEST:
• Match shows "was disputed" indicator
• Resolution note visible
• Final score reflects admin decision

✅ EXPECTED BEHAVIOR:
• Status: "Completed"
• Badge: "Was Disputed" or dispute history icon
• Admin resolution: Original score upheld (2-1)
• Match is now final

🎯 DISPUTE HISTORY:
1. Willy submitted: 2-1 win
2. Ken disputed the score
3. Admin reviewed evidence
4. Admin ruled: Original score correct
5. Match completed with Willy winning 2-1`,
      venue: "Center Court",
      setScores: JSON.stringify([
        { gameNumber: 1, team1Points: 15, team2Points: 11 },
        { gameNumber: 2, team1Points: 12, team2Points: 15 },
        { gameNumber: 3, team1Points: 15, team2Points: 13 },
      ]),
    },

    // 18. COMPLETED - Auto-approved (opponent didn't respond in 24h)
    {
      name: "COMPLETED - Auto-Approved",
      status: MatchStatus.COMPLETED,
      matchDate: daysAgo(3),
      creator: ken,
      opponent: willy,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      resultSubmittedBy: ken,
      isAutoApproved: true,
      playerScore: 2,
      opponentScore: 0,
      courtBooked: true,
      notes: `🧪 TEST: COMPLETED - Auto-Approved (24h timeout)

📋 WHAT TO TEST:
• "Auto-approved" indicator visible
• Shows no manual confirmation from opponent
• Result is final despite no explicit confirm

✅ EXPECTED BEHAVIOR:
• Status: "Completed"
• Badge: "Auto-approved"
• Ken's score (2-0) was accepted automatically
• Willy didn't respond within 24 hours

🎯 HOW THIS HAPPENED:
1. Ken submitted result: 2-0 win
2. Willy had 24 hours to confirm/dispute
3. Willy did not respond
4. System auto-approved after 24 hours
5. Match completed with Ken winning`,
      venue: "Court 2",
      setScores: JSON.stringify([
        { gameNumber: 1, team1Points: 15, team2Points: 9 },
        { gameNumber: 2, team1Points: 15, team2Points: 7 },
      ]),
    },

    // =============================================
    // CANCELLED STATUS (4 scenarios)
    // =============================================

    // 19. CANCELLED - Early cancellation (weather)
    {
      name: "CANCELLED - Weather",
      status: MatchStatus.CANCELLED,
      matchDate: daysAgo(1),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      cancelledBy: willy,
      cancellationReason: CancellationReason.WEATHER,
      courtBooked: true,
      notes: `🧪 TEST: CANCELLED - Weather (No Penalty)

📋 WHAT TO TEST:
• Match shows "Cancelled" status
• Reason displayed: "Weather"
• No penalty indicator (weather is excused)

✅ EXPECTED BEHAVIOR:
• Status: "Cancelled"
• Reason: "Weather - Heavy rain"
• Cancelled by: Willy
• No penalty applied to either player
• Match doesn't count in standings

🎯 THIS IS THE END STATE:
• Match is permanently cancelled
• Players should create a new match to reschedule
• Weather cancellations are always penalty-free`,
      venue: "Outdoor Court A",
    },

    // 20. CANCELLED - Late cancellation (penalty)
    {
      name: "CANCELLED - Late (Penalty)",
      status: MatchStatus.CANCELLED,
      matchDate: daysAgo(3),
      creator: ken,
      opponent: willy,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      cancelledBy: ken,
      cancellationReason: CancellationReason.PERSONAL_EMERGENCY,
      isLateCancellation: true,
      courtBooked: true,
      notes: `🧪 TEST: CANCELLED - Late Cancellation (With Penalty)

📋 WHAT TO TEST:
• "Late Cancellation" warning/badge visible
• Penalty indicator shown
• Cancelled within 4-hour window

✅ EXPECTED BEHAVIOR:
• Status: "Cancelled"
• Badge: "Late Cancellation" in red/orange
• Reason: "Personal Emergency"
• Cancelled by: Ken
• Penalty recorded against Ken

🎯 PENALTY RULES:
• Cancelling < 4 hours before match = LATE
• Late cancellations incur penalty points
• May affect standings or player rating
• Opponent (Willy) not penalized`,
      venue: "Court 2",
    },

    // 21. CANCELLED - Injury before match
    {
      name: "CANCELLED - Injury",
      status: MatchStatus.CANCELLED,
      matchDate: daysAgo(2),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      cancelledBy: willy,
      cancellationReason: CancellationReason.INJURY,
      courtBooked: true,
      notes: `🧪 TEST: CANCELLED - Injury (Excused)

📋 WHAT TO TEST:
• Cancellation reason shows "Injury"
• No penalty applied (injury is excused)
• Medical documentation may be noted

✅ EXPECTED BEHAVIOR:
• Status: "Cancelled"
• Reason: "Injury"
• Cancelled by: Willy
• No penalty (injury is valid excuse)
• Admin notes may reference medical doc

🎯 INJURY CANCELLATION RULES:
• Injuries are always excused (no penalty)
• Player may be asked to provide documentation
• Opponent receives no walkover win
• Both players should create new match when recovered`,
      venue: "Court 1",
    },

    // 22. CANCELLED - Scheduling conflict
    {
      name: "CANCELLED - Schedule Conflict",
      status: MatchStatus.CANCELLED,
      matchDate: daysAgo(4),
      creator: ken,
      opponent: willy,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      cancelledBy: willy,
      cancellationReason: CancellationReason.SCHEDULING_CONFLICT,
      courtBooked: true,
      notes: `🧪 TEST: CANCELLED - Schedule Conflict

📋 WHAT TO TEST:
• Shows "Scheduling Conflict" reason
• Check if penalty applies (depends on timing)
• Comment/note may have details

✅ EXPECTED BEHAVIOR:
• Status: "Cancelled"
• Reason: "Scheduling Conflict"
• Cancelled by: Willy
• Comment: "Work emergency came up"

🎯 SCHEDULE CONFLICT RULES:
• If cancelled > 4 hours ahead: No penalty
• If cancelled < 4 hours ahead: Late penalty
• Players should reschedule if possible
• Recurring conflicts may trigger admin review`,
      venue: "Court 3",
    },

    // =============================================
    // UNFINISHED STATUS (3 scenarios)
    // =============================================

    // 23. UNFINISHED - Rain delay
    {
      name: "UNFINISHED - Rain Delay",
      status: MatchStatus.UNFINISHED,
      matchDate: daysAgo(1),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      resultSubmittedBy: willy,
      playerScore: 1,
      opponentScore: 1,
      courtBooked: true,
      notes: `🧪 TEST: UNFINISHED - Rain Delay (1-1)

📋 WHAT TO TEST:
• "Unfinished" status displayed
• Partial scores shown (1-1)
• "Match incomplete" indicator visible

✅ EXPECTED BEHAVIOR:
• Status: "Unfinished"
• Score: 1-1 (partial)
• Games completed: 15-12, 10-15
• Game 3 not started
• Reason: Weather/Rain

🎯 HOW TO RESOLVE:
1. Players coordinate to reschedule
2. Resume match from current score (1-1)
3. Complete remaining game(s)
4. Submit final result
5. OR admin can void if can't complete`,
      venue: "Outdoor Court",
      setScores: JSON.stringify([
        { gameNumber: 1, team1Points: 15, team2Points: 12 },
        { gameNumber: 2, team1Points: 10, team2Points: 15 },
      ]),
    },

    // 24. UNFINISHED - Player injury mid-match
    {
      name: "UNFINISHED - Injury Mid-Match",
      status: MatchStatus.UNFINISHED,
      matchDate: daysAgo(2),
      creator: ken,
      opponent: willy,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      resultSubmittedBy: ken,
      playerScore: 1,
      opponentScore: 0,
      courtBooked: true,
      notes: `🧪 TEST: UNFINISHED - Injury Mid-Match (1-0)

📋 WHAT TO TEST:
• Shows partial score (1-0)
• Game 2 incomplete (8-3)
• Injury noted as reason

✅ EXPECTED BEHAVIOR:
• Status: "Unfinished"
• Score: Ken leads 1-0
• Game 2 stopped at 8-3
• Reason: Player injury (Willy)

🎯 HOW TO RESOLVE:
Option A - Resume when healed:
1. Wait for Willy to recover
2. Schedule continuation
3. Resume from 1-0, game 2 at 8-3

Option B - Convert to Walkover:
1. If injury prevents continuation
2. Report as walkover (injury)
3. Ken wins by retirement

Option C - Void match:
1. Admin voids if can't complete
2. No winner, no points awarded`,
      venue: "Court 4",
      setScores: JSON.stringify([
        { gameNumber: 1, team1Points: 15, team2Points: 10 },
        { gameNumber: 2, team1Points: 8, team2Points: 3 }, // Incomplete game
      ]),
    },

    // 25. UNFINISHED - Court time expired
    {
      name: "UNFINISHED - Court Time Expired",
      status: MatchStatus.UNFINISHED,
      matchDate: daysAgo(3),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      resultSubmittedBy: willy,
      playerScore: 1,
      opponentScore: 1,
      courtBooked: true,
      notes: `🧪 TEST: UNFINISHED - Court Time Expired (1-1, Game 3: 7-6)

📋 WHAT TO TEST:
• Score shows 1-1 with incomplete game 3
• Partial game score: 7-6
• Reason: Ran out of court time

✅ EXPECTED BEHAVIOR:
• Status: "Unfinished"
• Score: 1-1 (tied)
• Game 3 incomplete: 7-6
• Note: "Court time expired"

🎯 HOW TO RESOLVE:
1. Book another court slot
2. Resume game 3 from 7-6
3. Complete the deciding game
4. Submit final result
5. Admin may set deadline for completion`,
      venue: "Court 2",
      setScores: JSON.stringify([
        { gameNumber: 1, team1Points: 15, team2Points: 13 },
        { gameNumber: 2, team1Points: 12, team2Points: 15 },
        { gameNumber: 3, team1Points: 7, team2Points: 6 }, // Incomplete game
      ]),
    },

    // =============================================
    // VOID STATUS (2 scenarios)
    // =============================================

    // 26. VOID - Admin voided after dispute
    {
      name: "VOID - Admin Decision",
      status: MatchStatus.VOID,
      matchDate: daysAgo(7),
      creator: ken,
      opponent: willy,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      playerScore: 2,
      opponentScore: 0,
      adminNotes: "Match voided due to scoring dispute - admin reviewed evidence and found irregularities",
      courtBooked: true,
      notes: `🧪 TEST: VOID - Admin Decision (Dispute Irregularities)

📋 WHAT TO TEST:
• "Void" status displayed prominently
• Admin notes visible
• No winner recorded
• Match doesn't count in standings

✅ EXPECTED BEHAVIOR:
• Status: "Void" (gray/neutral color)
• Admin note: "Irregularities found"
• Original scores shown but marked invalid
• Neither player gets win/loss credit

🎯 WHY MATCHES GET VOIDED:
• Unresolvable dispute (both stories plausible)
• Evidence of irregularities
• Both players agree to void
• Technical issues corrupted data
• Admin discretion for fairness`,
      venue: "Court 3",
      setScores: JSON.stringify([
        { gameNumber: 1, team1Points: 15, team2Points: 8 },
        { gameNumber: 2, team1Points: 15, team2Points: 10 },
      ]),
    },

    // 27. VOID - Rule violation detected
    {
      name: "VOID - Rule Violation",
      status: MatchStatus.VOID,
      matchDate: daysAgo(14),
      creator: willy,
      opponent: ken,
      creatorStatus: InvitationStatus.ACCEPTED,
      opponentStatus: InvitationStatus.ACCEPTED,
      playerScore: 2,
      opponentScore: 1,
      adminNotes: "Match voided: Player used illegal equipment (paddle exceeded size limit)",
      courtBooked: true,
      notes: `🧪 TEST: VOID - Rule Violation (Equipment)

📋 WHAT TO TEST:
• Shows "Void" with violation reason
• Admin notes explain violation
• Potential penalty for violating player

✅ EXPECTED BEHAVIOR:
• Status: "Void"
• Admin note: "Illegal equipment used"
• Violation: Paddle exceeded size limit
• Match result invalidated

🎯 RULE VIOLATION CONSEQUENCES:
• Match is voided (no winner)
• Violating player may receive penalty
• May affect standings/rating
• Repeated violations = suspension
• Fair player not punished`,
      venue: "Center Court",
    },
  ];

  let createdCount = 0;

  for (const config of matchConfigs) {
    try {
      // Create the match using nested connect syntax
      const match = await prisma.match.create({
        data: {
          division: { connect: { id: division.id } },
          league: { connect: { id: division.leagueId } },
          season: { connect: { id: division.seasonId } },
          sport: "PICKLEBALL",
          matchType: MatchType.SINGLES,
          format: MatchFormat.STANDARD,
          status: config.status,
          matchDate: config.matchDate,
          location: "Test Court - Status Testing",
          venue: config.venue || "Court 1",

          // Match details
          courtBooked: config.courtBooked ?? false,
          duration: 2,
          fee: "FREE",
          feeAmount: 0,
          notes: config.notes || undefined,

          // Scores (JSON format for frontend MatchResultSheet)
          setScores: config.setScores || undefined,

          // Scores (numeric)
          playerScore: config.playerScore || undefined,
          opponentScore: config.opponentScore || undefined,

          // Flags
          isWalkover: config.isWalkover || false,
          isDisputed: config.isDisputed || false,
          isLateCancellation: config.isLateCancellation || false,
          isAutoApproved: config.isAutoApproved || false,
          walkoverReason: config.walkoverReason || undefined,
          cancellationReason: config.cancellationReason || undefined,

          // Result tracking
          resultSubmittedBy: config.resultSubmittedBy ? { connect: { id: config.resultSubmittedBy.id } } : undefined,
          resultSubmittedAt: config.resultSubmittedAt || (config.resultSubmittedBy ? new Date() : undefined),
          resultConfirmedBy: config.resultConfirmedBy ? { connect: { id: config.resultConfirmedBy.id } } : undefined,
          resultConfirmedAt: config.resultConfirmedBy ? config.matchDate : undefined,

          // Cancellation tracking
          cancelledBy: config.cancelledBy ? { connect: { id: config.cancelledBy.id } } : undefined,
          cancelledAt: config.cancelledBy ? new Date() : undefined,
          cancellationComment: config.cancellationReason ? "Test cancellation" : undefined,

          // Creator
          createdBy: { connect: { id: config.creator.id } },
          createdAt: new Date(config.matchDate.getTime() - 7 * 24 * 60 * 60 * 1000),

          // Admin notes
          adminNotes: config.adminNotes || undefined,
          requiresAdminReview: config.isLateCancellation || config.isDisputed || false,
        },
      });

      // Create participants with team assignments
      // For singles: creator = team1, opponent = team2
      await prisma.matchParticipant.createMany({
        data: [
          {
            matchId: match.id,
            userId: config.creator.id,
            role: ParticipantRole.CREATOR,
            team: "team1",
            invitationStatus: config.creatorStatus,
            acceptedAt: config.creatorStatus === InvitationStatus.ACCEPTED ? new Date() : null,
            didAttend: config.status === MatchStatus.COMPLETED || config.status === MatchStatus.ONGOING,
          },
          {
            matchId: match.id,
            userId: config.opponent.id,
            role: ParticipantRole.OPPONENT,
            team: "team2",
            invitationStatus: config.opponentStatus,
            acceptedAt: config.opponentStatus === InvitationStatus.ACCEPTED ? new Date() : null,
            didAttend: config.status === MatchStatus.COMPLETED && !config.isWalkover,
          },
        ],
      });

      // Create invitation for DRAFT/PENDING matches
      if (config.status === MatchStatus.DRAFT || config.opponentStatus === InvitationStatus.PENDING || config.opponentStatus === InvitationStatus.EXPIRED) {
        await prisma.matchInvitation.create({
          data: {
            matchId: match.id,
            inviterId: config.creator.id,
            inviteeId: config.opponent.id,
            status: config.opponentStatus,
            message: "Let's play a match!",
            expiresAt: config.opponentStatus === InvitationStatus.EXPIRED ? daysAgo(1) : daysFromNow(2),
            declineReason: config.opponentStatus === InvitationStatus.DECLINED ? "Schedule conflict" : null,
            respondedAt: config.opponentStatus !== InvitationStatus.PENDING ? new Date() : null,
          },
        });
      }

      // Create dispute if specified
      if (config.createDispute && config.isDisputed) {
        await prisma.matchDispute.create({
          data: {
            matchId: match.id,
            raisedByUserId: config.opponent.id, // Opponent files the dispute
            disputeCategory: config.createDispute.category,
            disputeComment: config.createDispute.reason,
            status: DisputeStatus.OPEN,
            priority: "HIGH",
            disputerScore: config.createDispute.disputerScore ? config.createDispute.disputerScore : undefined,
            evidenceUrl: config.createDispute.evidenceUrl || undefined,
          },
        });
      }

      // Create Pickleball game scores for ONGOING/COMPLETED/UNFINISHED matches
      // This is REQUIRED for MatchResultCreationService to work - it reads from pickleballScores table
      if ((config.status === MatchStatus.COMPLETED || config.status === MatchStatus.ONGOING || config.status === MatchStatus.UNFINISHED) &&
          config.setScores && !config.isWalkover) {
        // Parse the setScores JSON which contains Pickleball game scores
        const gameScores = JSON.parse(config.setScores) as Array<{
          gameNumber: number;
          team1Points: number;
          team2Points: number;
        }>;

        // Create PickleballGameScore records (required for processMatchCompletion)
        for (const game of gameScores) {
          await prisma.pickleballGameScore.create({
            data: {
              matchId: match.id,
              gameNumber: game.gameNumber,
              player1Points: game.team1Points,
              player2Points: game.team2Points,
            },
          });
        }
      }

      console.log(`   ✅ ${config.name}`);
      createdCount++;
    } catch (error) {
      console.error(`   ❌ Failed to create: ${config.name}`);
      console.error(`      Error: ${error}`);
    }
  }

  // Print summary
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    SEEDING COMPLETE!                         ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  Created ${createdCount}/${matchConfigs.length} test matches                                ║`);
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log("║  TEST ACCOUNTS:                                              ║");
  console.log("║  • willy@test.com                                            ║");
  console.log("║  • ken@test.com                                              ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log("║  TEST SCENARIOS (28 total):                                  ║");
  console.log("║                                                              ║");
  console.log("║  SCHEDULED (5):                                              ║");
  console.log("║  • Future (3 days), Starting Soon, Play Now                  ║");
  console.log("║  • Overdue (needs result), No Court Booked                   ║");
  console.log("║                                                              ║");
  console.log("║  DRAFT (4) - NEW INVITATION STATUS DISPLAY:                  ║");
  console.log("║  • Pending (Yellow) - Awaiting responses                     ║");
  console.log("║  • Declined (Red) - Invitation declined                      ║");
  console.log("║  • Expired (Gray) - Invitation expired                       ║");
  console.log("║  • All Accepted (Green) - Players confirmed                  ║");
  console.log("║                                                              ║");
  console.log("║  ONGOING (5):                                                ║");
  console.log("║  • Awaiting Confirm, You Need to Confirm                     ║");
  console.log("║  • Auto-approve Soon, Disputed, Disputed w/Evidence          ║");
  console.log("║                                                              ║");
  console.log("║  COMPLETED (5):                                              ║");
  console.log("║  • Normal Win, Walkover (No Show), Walkover (Injury)         ║");
  console.log("║  • Was Disputed, Auto-Approved                               ║");
  console.log("║                                                              ║");
  console.log("║  CANCELLED (4):                                              ║");
  console.log("║  • Weather, Late (Penalty), Injury, Schedule Conflict        ║");
  console.log("║                                                              ║");
  console.log("║  UNFINISHED (3):                                             ║");
  console.log("║  • Rain Delay, Injury Mid-Match, Court Time Expired          ║");
  console.log("║                                                              ║");
  console.log("║  VOID (2):                                                   ║");
  console.log("║  • Admin Decision, Rule Violation                            ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log("║  HOW TO TEST:                                                ║");
  console.log("║  1. Login as willy@test.com                                  ║");
  console.log("║  2. Go to My Games or Chat > View All Matches                ║");
  console.log("║  3. Test each scenario - check actions & displays            ║");
  console.log("║  4. Login as ken@test.com to see opponent perspective        ║");
  console.log("║                                                              ║");
  console.log("║  EDGE CASES TO TEST:                                         ║");
  console.log("║  • Submit result on 'Play Now' match                         ║");
  console.log("║  • Confirm/Dispute on 'You Need to Confirm' match            ║");
  console.log("║  • Check auto-approval countdown on 'Auto-approve Soon'      ║");
  console.log("║  • View dispute details on 'Disputed' matches                ║");
  console.log("║  • Verify late cancellation penalty warning                  ║");
  console.log("║                                                              ║");
  console.log("║  NEW - DRAFT SUB-STATUS DISPLAY:                             ║");
  console.log("║  • Pending: Yellow badge + 'Awaiting responses' text         ║");
  console.log("║  • Declined: Red badge + 'Invitation declined' text          ║");
  console.log("║  • Expired: Gray badge + 'Invitation expired' text           ║");
  console.log("║  • Accepted: Green badge + 'Players confirmed' text          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("\n");
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function generateSetScores(playerSets: number, opponentSets: number): { player1: number; player2: number }[] {
  const sets: { player1: number; player2: number }[] = [];
  let p1Wins = 0;
  let p2Wins = 0;

  while (p1Wins < playerSets || p2Wins < opponentSets) {
    if (p1Wins < playerSets && (p2Wins >= opponentSets || Math.random() > 0.5)) {
      sets.push({ player1: 6, player2: Math.floor(Math.random() * 5) });
      p1Wins++;
    } else {
      sets.push({ player1: Math.floor(Math.random() * 5), player2: 6 });
      p2Wins++;
    }
  }

  return sets;
}

// =============================================
// RUN SEED
// =============================================

seedMatchStatusTests()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
