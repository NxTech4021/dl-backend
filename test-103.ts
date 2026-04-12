/**
 * E2E test harness for issue #103 fixes.
 *
 * Runs inside the dl-backend Docker container via:
 *   docker exec dl-backend npx tsx /app/test-103.ts
 *
 * Strategy:
 *   - Calls service functions directly (no HTTP, no auth)
 *   - Patches `io.to(...).emit(...)` to record socket emits before each scenario
 *   - Uses Prisma to seed real rows in the dev DB
 *   - Cleans up all rows at the end (even if tests throw)
 *
 * This tests the exact code paths fixed in #103 against real Postgres +
 * real Prisma transactions + real Serializable isolation. It does NOT
 * test the HTTP layer or better-auth. The bugs being verified are all
 * in the service layer — auth is unrelated.
 */

import { prisma } from "./src/lib/prisma";
import { io } from "./src/app";
import {
  sendPairRequest,
  acceptPairRequest,
  denyPairRequest,
  cancelPairRequest,
  dissolvePartnership,
  inviteReplacementPartner,
  acceptReplacementInvite,
} from "./src/services/pairingService";
import {
  sendSeasonInvitation,
  acceptSeasonInvitation,
  denySeasonInvitation,
  cancelSeasonInvitation,
  getPendingSeasonInvitation,
  expireOldSeasonInvitations,
} from "./src/services/seasonInvitationService";
import { processWithdrawalRequest } from "./src/services/season/seasonWithdrawalService";

// ------------------------------------------------------------------
// Socket emit spy
// ------------------------------------------------------------------
type Emit = { room: string; event: string; payload: any };
const emits: Emit[] = [];

// Patch io.to to return a proxy whose .emit() appends to `emits`.
const originalTo = io.to.bind(io);
(io as any).to = (room: string) => {
  return {
    emit: (event: string, payload: any) => {
      emits.push({ room, event, payload });
    },
    // Preserve real behaviour for anything else we don't care about
    ...originalTo(room),
  };
};

function resetEmits() {
  emits.length = 0;
}

function findEmit(event: string, room?: string): Emit | undefined {
  return emits.find(
    (e) => e.event === event && (room === undefined || e.room === room),
  );
}

// ------------------------------------------------------------------
// Assertion helpers
// ------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(label: string, cond: boolean, detail?: any) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  ❌ ${label}`, detail ?? "");
  }
}

function section(title: string) {
  console.log(`\n${"━".repeat(60)}`);
  console.log(`📋 ${title}`);
  console.log("━".repeat(60));
}

// ------------------------------------------------------------------
// Test data
// ------------------------------------------------------------------
const EMAIL_PREFIX = "test-103-";
const TEST_TAG = EMAIL_PREFIX; // for cleanup

type TestUser = {
  id: string;
  email: string;
  name: string;
  gender: "male" | "female";
};

let userA: TestUser;
let userB: TestUser;
let userC: TestUser;
let userD: TestUser;
let userE: TestUser; // second female, for FEMALE-category matrix
let userF: TestUser; // male with NO questionnaire, for #103-15 negative path
let userAdmin: TestUser;
let seasonOpenId: string;
let seasonMixedId: string; // actually MALE-only in seed (legacy name)
let seasonFemaleOnlyId: string;
let seasonMixedTrueId: string; // genuine MIXED (one male one female)
let seasonCancelledId: string; // for #103-13
let seasonSinglesCategoryId: string; // for #103-14 singles rejection
let leagueId: string;
let divisionId: string;
let divisionMaleId: string;
let divisionFemaleId: string;
let divisionMixedId: string;
let divisionOpenId: string;
let categoryOpenId: string;
let categoryMixedId: string; // MALE category
let categoryFemaleId: string;
let categoryMixedTrueId: string;
let categorySinglesId: string;

async function createUser(
  emailSuffix: string,
  name: string,
  gender: "male" | "female",
): Promise<TestUser> {
  const email = `${EMAIL_PREFIX}${emailSuffix}@deucetest.local`;
  const username = `${EMAIL_PREFIX}${emailSuffix}`.replace(/-/g, "_");
  const user = await prisma.user.create({
    data: {
      name,
      email,
      emailVerified: true,
      username,
      gender,
      completedOnboarding: true,
      status: "ACTIVE",
    },
  });
  return { id: user.id, email, name, gender };
}

async function completeQuestionnaire(userId: string, sport: string) {
  const resp = await prisma.questionnaireResponse.create({
    data: {
      userId,
      sport,
      qVersion: 1,
      qHash: "test-hash",
      answersJson: {},
      completedAt: new Date(),
    },
  });
  await prisma.initialRatingResult.create({
    data: {
      responseId: resp.id,
      source: "test",
      singles: 3500,
      doubles: 3500,
      rd: 100,
      confidence: "low",
    },
  });
}

async function seed() {
  section("SEED: creating test users, league, season");

  // Users A/B/C (male) + D/E (female) + F (male no questionnaire)
  userA = await createUser("a", "User A Test103", "male");
  userB = await createUser("b", "User B Test103", "male");
  userC = await createUser("c", "User C Test103", "male");
  userD = await createUser("d", "User D Test103", "female");
  userE = await createUser("e", "User E Test103", "female");
  userF = await createUser("f", "User F Test103", "male");
  userAdmin = await createUser("admin", "Admin Test103", "male");

  // A/B/C/D/E complete the pickleball questionnaire. F deliberately does NOT
  // so we can test the #103-15 sender-questionnaire rejection.
  for (const u of [userA, userB, userC, userD, userE]) {
    await completeQuestionnaire(u.id, "pickleball");
  }
  // Admin also completes questionnaire so they could plausibly be in a season.
  await completeQuestionnaire(userAdmin.id, "pickleball");
  console.log(
    `  created users: ${[userA, userB, userC, userD, userE, userF, userAdmin].map((u) => u.name).join(", ")}`,
  );

  // Categories covering every gender restriction + a singles trap category.
  const catOpen = await prisma.category.create({
    data: { name: "Test Open Doubles", gameType: "DOUBLES", genderCategory: "OPEN", genderRestriction: "OPEN" },
  });
  categoryOpenId = catOpen.id;

  const catMale = await prisma.category.create({
    data: { name: "Test Men's Doubles", gameType: "DOUBLES", genderCategory: "MALE", genderRestriction: "MALE" },
  });
  categoryMixedId = catMale.id; // legacy name kept for back-compat in this file

  const catFemale = await prisma.category.create({
    data: { name: "Test Women's Doubles", gameType: "DOUBLES", genderCategory: "FEMALE", genderRestriction: "FEMALE" },
  });
  categoryFemaleId = catFemale.id;

  const catMixedTrue = await prisma.category.create({
    data: { name: "Test Mixed Doubles", gameType: "DOUBLES", genderCategory: "MIXED", genderRestriction: "MIXED" },
  });
  categoryMixedTrueId = catMixedTrue.id;

  const catSingles = await prisma.category.create({
    data: { name: "Test Singles Trap", gameType: "SINGLES", genderCategory: "OPEN", genderRestriction: "OPEN" },
  });
  categorySinglesId = catSingles.id;

  // League
  const league = await prisma.league.create({
    data: {
      name: `Test 103 League ${Date.now()}`,
      sportType: "PICKLEBALL",
      gameType: "DOUBLES",
      status: "UPCOMING",
    },
  });
  leagueId = league.id;

  // Season (OPEN category)
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const seasonOpen = await prisma.season.create({
    data: {
      name: `Test 103 Season Open ${Date.now()}`,
      startDate: now,
      endDate: future,
      regiDeadline: future,
      entryFee: 0,
      status: "ACTIVE",
      isActive: true,
      paymentRequired: false,
      categoryId: categoryOpenId,
      leagues: { connect: [{ id: league.id }] },
    },
  });
  seasonOpenId = seasonOpen.id;

  // Division for the season
  const division = await prisma.division.create({
    data: {
      name: "Test Div A",
      level: "INTERMEDIATE",
      gameType: "DOUBLES",
      season: { connect: { id: seasonOpenId } },
      league: { connect: { id: leagueId } },
    },
  });
  divisionId = division.id;

  // Season (MALE category) for #103-14
  const seasonMale = await prisma.season.create({
    data: {
      name: `Test 103 Season Male ${Date.now()}`,
      startDate: now, endDate: future, regiDeadline: future, entryFee: 0,
      status: "ACTIVE", isActive: true, paymentRequired: false,
      categoryId: categoryMixedId,
      leagues: { connect: [{ id: league.id }] },
    },
  });
  seasonMixedId = seasonMale.id;
  const divMale = await prisma.division.create({
    data: {
      name: "Test Div Male", level: "INTERMEDIATE", gameType: "DOUBLES",
      season: { connect: { id: seasonMixedId } },
      league: { connect: { id: leagueId } },
    },
  });
  divisionMaleId = divMale.id;

  // Season (FEMALE)
  const seasonFemale = await prisma.season.create({
    data: {
      name: `Test 103 Season Female ${Date.now()}`,
      startDate: now, endDate: future, regiDeadline: future, entryFee: 0,
      status: "ACTIVE", isActive: true, paymentRequired: false,
      categoryId: categoryFemaleId,
      leagues: { connect: [{ id: league.id }] },
    },
  });
  seasonFemaleOnlyId = seasonFemale.id;
  const divFemale = await prisma.division.create({
    data: {
      name: "Test Div Female", level: "INTERMEDIATE", gameType: "DOUBLES",
      season: { connect: { id: seasonFemaleOnlyId } },
      league: { connect: { id: leagueId } },
    },
  });
  divisionFemaleId = divFemale.id;

  // Season (MIXED)
  const seasonMixedTrue = await prisma.season.create({
    data: {
      name: `Test 103 Season MixedTrue ${Date.now()}`,
      startDate: now, endDate: future, regiDeadline: future, entryFee: 0,
      status: "ACTIVE", isActive: true, paymentRequired: false,
      categoryId: categoryMixedTrueId,
      leagues: { connect: [{ id: league.id }] },
    },
  });
  seasonMixedTrueId = seasonMixedTrue.id;
  const divMixed = await prisma.division.create({
    data: {
      name: "Test Div Mixed", level: "INTERMEDIATE", gameType: "DOUBLES",
      season: { connect: { id: seasonMixedTrueId } },
      league: { connect: { id: leagueId } },
    },
  });
  divisionMixedId = divMixed.id;

  // Season (CANCELLED) for #103-13 status check
  const seasonCancelled = await prisma.season.create({
    data: {
      name: `Test 103 Season Cancelled ${Date.now()}`,
      startDate: now, endDate: future, regiDeadline: future, entryFee: 0,
      status: "CANCELLED", isActive: false, paymentRequired: false,
      categoryId: categoryOpenId,
      leagues: { connect: [{ id: league.id }] },
    },
  });
  seasonCancelledId = seasonCancelled.id;
  await prisma.division.create({
    data: {
      name: "Test Div Cancelled", level: "INTERMEDIATE", gameType: "DOUBLES",
      season: { connect: { id: seasonCancelledId } },
      league: { connect: { id: leagueId } },
    },
  });

  // Season (SINGLES category) for #103-14 singles-rejection test
  const seasonSingles = await prisma.season.create({
    data: {
      name: `Test 103 Season Singles ${Date.now()}`,
      startDate: now, endDate: future, regiDeadline: future, entryFee: 0,
      status: "ACTIVE", isActive: true, paymentRequired: false,
      categoryId: categorySinglesId,
      leagues: { connect: [{ id: league.id }] },
    },
  });
  seasonSinglesCategoryId = seasonSingles.id;
  await prisma.division.create({
    data: {
      name: "Test Div Singles", level: "INTERMEDIATE", gameType: "SINGLES",
      season: { connect: { id: seasonSinglesCategoryId } },
      league: { connect: { id: leagueId } },
    },
  });

  console.log(`  created seasons: open=${seasonOpenId}, male=${seasonMixedId}, female=${seasonFemaleOnlyId}, mixed=${seasonMixedTrueId}, cancelled=${seasonCancelledId}, singles=${seasonSinglesCategoryId}`);
}

function allTestUserIds(): string[] {
  return [userA, userB, userC, userD, userE, userF, userAdmin]
    .filter(Boolean)
    .map((u) => u.id);
}

async function resetPairingState() {
  const userIds = allTestUserIds();

  // Notifications (FK to partnership + withdrawalRequest + pairRequest + season)
  await prisma.userNotification.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        {
          seasonId: {
            in: [
              seasonOpenId,
              seasonMixedId,
              seasonFemaleOnlyId,
              seasonMixedTrueId,
              seasonCancelledId,
              seasonSinglesCategoryId,
            ].filter(Boolean),
          },
        },
      ],
    },
  });

  // WithdrawalRequest before partnerships (FK constraint)
  await prisma.withdrawalRequest.deleteMany({
    where: { userId: { in: userIds } },
  });

  await prisma.divisionStanding.deleteMany({
    where: {
      partnership: {
        OR: [
          { captainId: { in: userIds } },
          { partnerId: { in: userIds } },
        ],
      },
    },
  });
  await prisma.partnership.deleteMany({
    where: {
      OR: [
        { captainId: { in: userIds } },
        { partnerId: { in: userIds } },
      ],
    },
  });
  await prisma.pairRequest.deleteMany({
    where: {
      OR: [
        { requesterId: { in: userIds } },
        { recipientId: { in: userIds } },
      ],
    },
  });
  await prisma.seasonInvitation.deleteMany({
    where: {
      OR: [
        { senderId: { in: userIds } },
        { recipientId: { in: userIds } },
      ],
    },
  });
  await prisma.seasonMembership.deleteMany({
    where: { userId: { in: userIds } },
  });
}

async function cleanup() {
  section("CLEANUP: removing test rows");
  const userIds = allTestUserIds();
  if (userIds.length === 0) return;

  await resetPairingState();

  // Remove questionnaires
  await prisma.initialRatingResult.deleteMany({
    where: { response: { userId: { in: userIds } } },
  });
  await prisma.questionnaireResponse.deleteMany({
    where: { userId: { in: userIds } },
  });

  // Remove divisions / seasons / league / categories
  const seasonIds = [
    seasonOpenId,
    seasonMixedId,
    seasonFemaleOnlyId,
    seasonMixedTrueId,
    seasonCancelledId,
    seasonSinglesCategoryId,
  ].filter(Boolean);
  for (const sid of seasonIds) {
    await prisma.divisionStanding.deleteMany({ where: { seasonId: sid } });
    await prisma.division.deleteMany({ where: { seasonId: sid } });
    await prisma.season.delete({ where: { id: sid } }).catch(() => {});
  }
  if (leagueId) await prisma.league.delete({ where: { id: leagueId } }).catch(() => {});
  const categoryIds = [
    categoryOpenId,
    categoryMixedId,
    categoryFemaleId,
    categoryMixedTrueId,
    categorySinglesId,
  ].filter(Boolean);
  for (const cid of categoryIds) {
    await prisma.category.delete({ where: { id: cid } }).catch(() => {});
  }

  // Finally delete users (also deletes sessions/accounts via cascade)
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log("  cleanup done");
}

// ------------------------------------------------------------------
// Scenarios
// ------------------------------------------------------------------
async function scenario1_DissolveThenDissolve() {
  section("SCENARIO 1 — Dissolve, then stale-UI dissolve (bug #103-10, #103-3)");
  await resetPairingState();
  resetEmits();

  // Create an ACTIVE partnership between A and B via direct DB insert (fast).
  const p = await prisma.partnership.create({
    data: {
      captainId: userA.id,
      partnerId: userB.id,
      seasonId: seasonOpenId,
      divisionId,
      status: "ACTIVE",
      pairRating: 3500,
    },
  });
  // Also create memberships for both
  await prisma.seasonMembership.createMany({
    data: [
      { userId: userA.id, seasonId: seasonOpenId, divisionId, status: "ACTIVE" },
      { userId: userB.id, seasonId: seasonOpenId, divisionId, status: "ACTIVE" },
    ],
  });

  // First dissolve: A leaves. Should succeed and create IC for B.
  const r1 = await dissolvePartnership(p.id, userA.id);
  ok("first dissolve succeeds", r1.success, r1);

  const ic = await prisma.partnership.findFirst({
    where: { predecessorId: p.id, status: "INCOMPLETE" },
  });
  ok("IC partnership created with B as captain", ic?.captainId === userB.id, ic);

  // Check partnership.status transitioned to DISSOLVED
  const pAfter = await prisma.partnership.findUnique({ where: { id: p.id } });
  ok("original partnership is DISSOLVED", pAfter?.status === "DISSOLVED");

  // Check socket emit for dissolve
  const dissolveEmit = findEmit("partnership_updated");
  ok(
    "partnership_updated event emitted on dissolve",
    !!dissolveEmit && dissolveEmit.payload.status === "DISSOLVED",
    dissolveEmit,
  );

  // Now simulate stale UI on B's side tapping Leave on the already-dissolved P.
  // This is the smoking-gun bug: before fix, it would succeed and create a phantom
  // IC2 for A. After fix, it must reject with "Partnership is no longer active".
  resetEmits();
  const r2 = await dissolvePartnership(p.id, userB.id);
  ok("second dissolve REJECTED", !r2.success, r2);
  ok(
    "second dissolve error mentions 'no longer active'",
    /no longer active/i.test(r2.message),
    r2.message,
  );

  // Verify no phantom IC2 was created.
  const allICs = await prisma.partnership.findMany({
    where: { predecessorId: p.id, status: "INCOMPLETE" },
  });
  ok("no phantom IC2 created", allICs.length === 1, { count: allICs.length });
}

async function scenario2_DuplicatePartnership() {
  section("SCENARIO 2 — Duplicate partnership via stale accepts (bug #103-8)");
  await resetPairingState();
  resetEmits();

  // C sends pair request to B (day 0).
  const rCB = await sendPairRequest({
    requesterId: userC.id,
    recipientId: userB.id,
    seasonId: seasonOpenId,
  });
  ok("C → B pair request created", rCB.success, rCB);

  // C sends another pair request to A (day 0.5) — this should FAIL because of
  // "You already have a pending pair request to this player" is per-recipient
  // not per-requester. Let me double-check by looking at the guard logic:
  // sendPairRequest blocks "existing pending to THIS recipient" and "existing
  // pending to/from recipient from anyone". So C can send to a NEW recipient.
  // Actually lines 158-185 check: requester-to-recipient dupe + recipient has
  // any pending. Let me try A (recipient A has no pending inbox).
  const rCA = await sendPairRequest({
    requesterId: userC.id,
    recipientId: userA.id,
    seasonId: seasonOpenId,
  });
  ok("C → A pair request created", rCA.success, rCA);

  // A accepts → creates partnership C+A. This should ALSO auto-decline C→B
  // because of the #103-8 fix sweep.
  const rAcceptA = await acceptPairRequest(rCA.data!.id, userA.id);
  ok("A accepts → partnership created", rAcceptA.success, rAcceptA);

  const partnership1 = await prisma.partnership.findFirst({
    where: {
      captainId: userC.id,
      partnerId: userA.id,
      seasonId: seasonOpenId,
      status: "ACTIVE",
    },
  });
  ok("C+A partnership is ACTIVE", !!partnership1);

  // Verify C → B request was AUTO_DENIED (the #103-8 sweep)
  const rCBState = await prisma.pairRequest.findUnique({
    where: { id: rCB.data!.id },
  });
  ok(
    "C → B pair request swept to AUTO_DENIED",
    rCBState?.status === "AUTO_DENIED",
    rCBState?.status,
  );

  // B tries to accept C's now-dead request. Should fail — status check.
  const rAcceptB = await acceptPairRequest(rCB.data!.id, userB.id);
  ok(
    "B cannot accept auto-denied request",
    !rAcceptB.success && /no longer pending/i.test(rAcceptB.message),
    rAcceptB,
  );

  // Verify no second ACTIVE partnership was created for C.
  const cActives = await prisma.partnership.findMany({
    where: {
      seasonId: seasonOpenId,
      status: "ACTIVE",
      OR: [{ captainId: userC.id }, { partnerId: userC.id }],
    },
  });
  ok("C has exactly ONE ACTIVE partnership", cActives.length === 1, {
    count: cActives.length,
  });
}

async function scenario3_LeaveIncomplete() {
  section("SCENARIO 3 — Leave INCOMPLETE partnership (bug #103-9)");
  await resetPairingState();
  resetEmits();

  // Put B in an INCOMPLETE partnership (captain of IC, no partner).
  const ic = await prisma.partnership.create({
    data: {
      captainId: userB.id,
      partnerId: null,
      seasonId: seasonOpenId,
      divisionId,
      status: "INCOMPLETE",
    },
  });
  await prisma.seasonMembership.create({
    data: { userId: userB.id, seasonId: seasonOpenId, divisionId, status: "ACTIVE" },
  });

  // Give B a pending pair request they sent to C (should be swept on leave).
  const pr = await prisma.pairRequest.create({
    data: {
      requesterId: userB.id,
      recipientId: userC.id,
      seasonId: seasonOpenId,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  // Call dissolvePartnership on the INCOMPLETE — should succeed (new branch).
  const r = await dissolvePartnership(ic.id, userB.id);
  ok("dissolve INCOMPLETE succeeds", r.success, r);

  const icAfter = await prisma.partnership.findUnique({ where: { id: ic.id } });
  ok("partnership → DISSOLVED", icAfter?.status === "DISSOLVED");

  const membership = await prisma.seasonMembership.findFirst({
    where: { userId: userB.id, seasonId: seasonOpenId },
  });
  ok("B's membership → REMOVED", membership?.status === "REMOVED");

  const prAfter = await prisma.pairRequest.findUnique({ where: { id: pr.id } });
  ok(
    "B's pending pair request → AUTO_DENIED",
    prAfter?.status === "AUTO_DENIED",
    prAfter?.status,
  );

  const emit = findEmit("partnership_updated", userB.id);
  ok(
    "partnership_updated emitted with action=incomplete_cancelled",
    emit?.payload?.action === "incomplete_cancelled",
    emit,
  );
}

async function scenario4_GenderValidation() {
  section("SCENARIO 4 — Gender category rejection (bug #103-14)");
  await resetPairingState();
  resetEmits();

  // A (male) invites D (female) to the MALE-only season.
  const r = await sendSeasonInvitation({
    senderId: userA.id,
    recipientId: userD.id,
    seasonId: seasonMixedId,
  });
  ok("male-only season rejects male+female invite", !r.success, r);
  ok(
    "error mentions men's doubles",
    /men.*doubles/i.test(r.message),
    r.message,
  );

  // A (male) invites B (male) to the MALE-only season — should succeed.
  const r2 = await sendSeasonInvitation({
    senderId: userA.id,
    recipientId: userB.id,
    seasonId: seasonMixedId,
  });
  ok("male-only season accepts male+male invite", r2.success, r2);
}

async function scenario5_CountPhantom() {
  section("SCENARIO 5 — _count.memberships skips REMOVED (bug #103-6)");
  await resetPairingState();
  resetEmits();

  // Create two ACTIVE memberships + one REMOVED
  await prisma.seasonMembership.createMany({
    data: [
      { userId: userA.id, seasonId: seasonOpenId, divisionId, status: "ACTIVE" },
      { userId: userB.id, seasonId: seasonOpenId, divisionId, status: "ACTIVE" },
      { userId: userC.id, seasonId: seasonOpenId, divisionId, status: "REMOVED" },
    ],
  });

  const withCount = await prisma.season.findUnique({
    where: { id: seasonOpenId },
    select: {
      _count: {
        select: { memberships: { where: { status: "ACTIVE" } } },
      },
    },
  });
  ok(
    "filtered _count returns 2 (not 3)",
    withCount?._count?.memberships === 2,
    withCount?._count,
  );
}

async function scenario6_DenyEmitsSocket() {
  section("SCENARIO 6 — Deny season invitation emits socket (bug #103-1)");
  await resetPairingState();
  resetEmits();

  // A sends B a season invitation, B denies.
  const sent = await sendSeasonInvitation({
    senderId: userA.id,
    recipientId: userB.id,
    seasonId: seasonOpenId,
  });
  ok("invite sent", sent.success, sent);

  // Clear emits so we only capture the deny event
  resetEmits();
  const den = await denySeasonInvitation(sent.data!.id, userB.id);
  ok("deny succeeds", den.success);

  const emitToSender = findEmit("season_invitation_updated", userA.id);
  ok(
    "season_invitation_updated emitted to sender room",
    !!emitToSender && emitToSender.payload.status === "DENIED",
    emitToSender,
  );
}

async function scenario7_ExpireSweepsRow() {
  section("SCENARIO 7 — Expire old invitations (cron, bug #103-12, #103-17)");
  await resetPairingState();
  resetEmits();

  // Seed a stale PENDING invitation (expired in the past).
  await prisma.seasonInvitation.create({
    data: {
      senderId: userA.id,
      recipientId: userB.id,
      seasonId: seasonOpenId,
      status: "PENDING",
      expiresAt: new Date(Date.now() - 24 * 3600 * 1000),
    },
  });

  const result = await expireOldSeasonInvitations();
  ok("expireOldSeasonInvitations ran", result >= 1, { result });

  // Verify the stale row is now EXPIRED
  const post = await prisma.seasonInvitation.findMany({
    where: { senderId: userA.id, recipientId: userB.id, seasonId: seasonOpenId },
  });
  ok("stale row transitioned to EXPIRED", post[0]?.status === "EXPIRED", post);

  // Verify socket emit happened during expire
  const emitToSender = findEmit("season_invitation_updated", userA.id);
  ok("expire emitted to sender", !!emitToSender, emitToSender);
}

async function scenario8_LazyExpireUnblockResend() {
  section("SCENARIO 8 — Lazy expiry unblocks re-send (bug #103-17)");
  await resetPairingState();
  resetEmits();

  // Seed stale PENDING invitation.
  await prisma.seasonInvitation.create({
    data: {
      senderId: userA.id,
      recipientId: userB.id,
      seasonId: seasonOpenId,
      status: "PENDING",
      expiresAt: new Date(Date.now() - 24 * 3600 * 1000),
    },
  });

  // A tries to re-invite B. Before fix → blocked by duplicate check.
  // After fix → lazy-expire flips old row, new invite succeeds.
  const r = await sendSeasonInvitation({
    senderId: userA.id,
    recipientId: userB.id,
    seasonId: seasonOpenId,
  });
  ok("re-send not blocked by stale PENDING row", r.success, r);
}

async function scenario9_AllPairingEmits() {
  section("SCENARIO 9 — All pairing mutations emit socket events (bug #103-2 full)");
  await resetPairingState();

  // 9a. sendPairRequest → pair_request_updated (PENDING)
  resetEmits();
  const sent = await sendPairRequest({ requesterId: userA.id, recipientId: userB.id, seasonId: seasonOpenId });
  ok("sendPairRequest succeeds", sent.success);
  ok("sendPairRequest emits pair_request_updated PENDING",
    !!findEmit("pair_request_updated") && findEmit("pair_request_updated")!.payload.status === "PENDING");

  // 9b. cancelPairRequest → pair_request_updated (CANCELLED)
  resetEmits();
  const cancelled = await cancelPairRequest(sent.data!.id, userA.id);
  ok("cancelPairRequest succeeds", cancelled.success);
  ok("cancelPairRequest emits CANCELLED",
    !!findEmit("pair_request_updated") && findEmit("pair_request_updated")!.payload.status === "CANCELLED");

  // 9c. denyPairRequest → pair_request_updated (DENIED)
  const sent2 = await sendPairRequest({ requesterId: userA.id, recipientId: userB.id, seasonId: seasonOpenId });
  resetEmits();
  const denied = await denyPairRequest(sent2.data!.id, userB.id);
  ok("denyPairRequest succeeds", denied.success);
  ok("denyPairRequest emits DENIED",
    !!findEmit("pair_request_updated") && findEmit("pair_request_updated")!.payload.status === "DENIED");

  // 9d. acceptPairRequest → partnership_updated (created) + pair_request_updated (ACCEPTED)
  const sent3 = await sendPairRequest({ requesterId: userA.id, recipientId: userB.id, seasonId: seasonOpenId });
  resetEmits();
  const accepted = await acceptPairRequest(sent3.data!.id, userB.id);
  ok("acceptPairRequest succeeds", accepted.success);
  ok("acceptPairRequest emits partnership_updated (created)",
    emits.some(e => e.event === "partnership_updated" && e.payload.action === "created"));
  ok("acceptPairRequest emits pair_request_updated ACCEPTED",
    emits.some(e => e.event === "pair_request_updated" && e.payload.status === "ACCEPTED"));
  ok("both captain and partner receive partnership_updated",
    emits.filter(e => e.event === "partnership_updated").length >= 2);

  // 9e. cancelSeasonInvitation → season_invitation_updated CANCELLED
  await resetPairingState();
  const inv = await sendSeasonInvitation({ senderId: userA.id, recipientId: userB.id, seasonId: seasonOpenId });
  resetEmits();
  const cancInv = await cancelSeasonInvitation(inv.data!.id, userA.id);
  ok("cancelSeasonInvitation succeeds", cancInv.success);
  ok("cancelSeasonInvitation emits CANCELLED",
    !!findEmit("season_invitation_updated") && findEmit("season_invitation_updated")!.payload.status === "CANCELLED");
}

async function scenario10_SenderIncompleteBlocks() {
  section("SCENARIO 10 — Sender with INCOMPLETE cannot send season invite (bug #103-4)");
  await resetPairingState();
  resetEmits();

  // Put B into INCOMPLETE state (captain of orphan partnership)
  await prisma.partnership.create({
    data: {
      captainId: userB.id,
      partnerId: null,
      seasonId: seasonOpenId,
      divisionId,
      status: "INCOMPLETE",
    },
  });

  // B tries to send a new season invitation to C — must be rejected
  const r = await sendSeasonInvitation({ senderId: userB.id, recipientId: userC.id, seasonId: seasonOpenId });
  ok("sendSeasonInvitation rejects INCOMPLETE sender", !r.success, r);
  ok("error mentions Manage Partnership", /incomplete|manage partnership/i.test(r.message), r.message);
}

async function scenario11_GetPendingDeterministic() {
  section("SCENARIO 11 — getPendingSeasonInvitation deterministic (bug #103-5)");
  await resetPairingState();
  resetEmits();

  // A has both: sent invite → B, received invite from C, for the same season
  await sendSeasonInvitation({ senderId: userA.id, recipientId: userB.id, seasonId: seasonOpenId });
  // small delay to differentiate createdAt
  await new Promise((res) => setTimeout(res, 10));
  await sendSeasonInvitation({ senderId: userC.id, recipientId: userA.id, seasonId: seasonOpenId });

  // The fix says: sender-direction should take priority over received
  const pending = await getPendingSeasonInvitation(userA.id, seasonOpenId);
  ok("getPendingSeasonInvitation returns a row", !!pending, pending);
  ok("returns the SENT-direction invite (A → B)",
    pending?.senderId === userA.id && pending?.recipientId === userB.id,
    { senderId: pending?.senderId, recipientId: pending?.recipientId });
  ok("direction field is 'sent'", (pending as any)?.direction === "sent");

  // Run it 5 times to prove determinism
  let sameEveryTime = true;
  const first = pending?.id;
  for (let i = 0; i < 5; i++) {
    const p = await getPendingSeasonInvitation(userA.id, seasonOpenId);
    if (p?.id !== first) { sameEveryTime = false; break; }
  }
  ok("returns same row across 5 repeated calls", sameEveryTime);
}

async function scenario12_WithdrawalIdempotent() {
  section("SCENARIO 12 — processWithdrawalRequest idempotent (bug #103-11)");
  await resetPairingState();
  resetEmits();

  // Create an ACTIVE partnership A+B
  const p = await prisma.partnership.create({
    data: {
      captainId: userA.id, partnerId: userB.id, seasonId: seasonOpenId,
      divisionId, status: "ACTIVE", pairRating: 3500,
    },
  });
  await prisma.seasonMembership.createMany({
    data: [
      { userId: userA.id, seasonId: seasonOpenId, divisionId, status: "ACTIVE" },
      { userId: userB.id, seasonId: seasonOpenId, divisionId, status: "ACTIVE" },
    ],
  });

  // A submits a withdrawal request for P
  const wr = await prisma.withdrawalRequest.create({
    data: {
      userId: userA.id,
      seasonId: seasonOpenId,
      partnershipId: p.id,
      reason: "Test 103-11",
      status: "PENDING",
    },
  });

  // Force P into DISSOLVED state externally (simulating another path having dissolved it).
  await prisma.partnership.update({ where: { id: p.id }, data: { status: "DISSOLVED", dissolvedAt: new Date() } });

  // Now admin approves the withdrawal — should throw because P is no longer ACTIVE.
  let threw = false;
  let errMsg = "";
  try {
    await processWithdrawalRequest(wr.id, "APPROVED", userAdmin.id);
  } catch (e: any) {
    threw = true;
    errMsg = e?.message || String(e);
  }
  ok("processWithdrawalRequest throws on already-dissolved P", threw, errMsg);
  ok("error mentions 'no longer active'", /no longer active/i.test(errMsg), errMsg);

  // Verify no phantom IC was created
  const phantom = await prisma.partnership.findMany({
    where: { predecessorId: p.id, status: "INCOMPLETE" },
  });
  ok("no phantom INCOMPLETE created by processWithdrawalRequest", phantom.length === 0);
}

async function scenario12b_WithdrawalHappyPath() {
  section("SCENARIO 12b — processWithdrawalRequest happy path (admin approval)");
  await resetPairingState();
  resetEmits();

  // Create an ACTIVE partnership A+B
  const p = await prisma.partnership.create({
    data: {
      captainId: userA.id, partnerId: userB.id, seasonId: seasonOpenId,
      divisionId, status: "ACTIVE", pairRating: 3500,
    },
  });
  await prisma.seasonMembership.createMany({
    data: [
      { userId: userA.id, seasonId: seasonOpenId, divisionId, status: "ACTIVE" },
      { userId: userB.id, seasonId: seasonOpenId, divisionId, status: "ACTIVE" },
    ],
  });

  // A submits a withdrawal request (they want to leave the partnership via admin review)
  const wr = await prisma.withdrawalRequest.create({
    data: {
      userId: userA.id,
      seasonId: seasonOpenId,
      partnershipId: p.id,
      reason: "Test 12b",
      status: "PENDING",
    },
  });

  // Admin approves the withdrawal — full happy path.
  // This exercises the exact code path that was broken at runtime before
  // the Prisma client was regenerated + the data-shape fix.
  const result = await processWithdrawalRequest(wr.id, "APPROVED", userAdmin.id, "Approved in test");
  ok("admin approval returns a result", !!result, result);
  ok("withdrawal status is APPROVED", (result as any).status === "APPROVED", (result as any)?.status);

  // Verify partnership P is now DISSOLVED
  const pAfter = await prisma.partnership.findUnique({ where: { id: p.id } });
  ok("partnership → DISSOLVED", pAfter?.status === "DISSOLVED");

  // Verify INCOMPLETE partnership was created for B (the remaining player)
  const ic = await prisma.partnership.findFirst({
    where: { predecessorId: p.id, status: "INCOMPLETE" },
  });
  ok("INCOMPLETE partnership created for remaining player", !!ic, ic);
  ok("INCOMPLETE captain is the non-withdrawing player (B)", ic?.captainId === userB.id, ic);
  ok("INCOMPLETE has no partner", ic?.partnerId === null);

  // Verify A's membership was set to REMOVED
  const aMembership = await prisma.seasonMembership.findFirst({
    where: { userId: userA.id, seasonId: seasonOpenId },
  });
  ok("A's membership → REMOVED", aMembership?.status === "REMOVED");

  // Verify B's membership is still ACTIVE
  const bMembership = await prisma.seasonMembership.findFirst({
    where: { userId: userB.id, seasonId: seasonOpenId },
  });
  ok("B's membership stays ACTIVE", bMembership?.status === "ACTIVE");

  // Verify adminNotes was written correctly (the field that was broken before)
  const wrAfter = await prisma.withdrawalRequest.findUnique({ where: { id: wr.id } });
  ok("adminNotes was persisted", wrAfter?.adminNotes === "Approved in test", wrAfter?.adminNotes);
  ok("processedByAdminId was persisted", wrAfter?.processedByAdminId === userAdmin.id, wrAfter?.processedByAdminId);
  ok("processedAt was set", !!wrAfter?.processedAt);
}

async function scenario13_SendPairRequestSeasonStatus() {
  section("SCENARIO 13 — sendPairRequest rejects CANCELLED season (bug #103-13)");
  await resetPairingState();
  resetEmits();

  const r = await sendPairRequest({
    requesterId: userA.id, recipientId: userB.id, seasonId: seasonCancelledId,
  });
  ok("rejects CANCELLED season", !r.success, r);
  ok("error mentions 'not accepting'", /not accepting/i.test(r.message), r.message);
}

async function scenario14_GenderMatrix() {
  section("SCENARIO 14 — Gender validation matrix + singles rejection (bug #103-14 full)");
  await resetPairingState();
  resetEmits();

  // FEMALE season: D + E accepted, D + A rejected
  const r1 = await sendSeasonInvitation({ senderId: userD.id, recipientId: userE.id, seasonId: seasonFemaleOnlyId });
  ok("FEMALE season: female+female accepted", r1.success, r1);
  await resetPairingState();

  const r2 = await sendSeasonInvitation({ senderId: userD.id, recipientId: userA.id, seasonId: seasonFemaleOnlyId });
  ok("FEMALE season: female+male rejected", !r2.success, r2);
  ok("error mentions women's doubles", /women.*doubles/i.test(r2.message), r2.message);
  await resetPairingState();

  // MIXED season: A + D accepted, A + B rejected
  const r3 = await sendSeasonInvitation({ senderId: userA.id, recipientId: userD.id, seasonId: seasonMixedTrueId });
  ok("MIXED season: male+female accepted", r3.success, r3);
  await resetPairingState();

  const r4 = await sendSeasonInvitation({ senderId: userA.id, recipientId: userB.id, seasonId: seasonMixedTrueId });
  ok("MIXED season: male+male rejected", !r4.success, r4);
  ok("error mentions mixed doubles", /mixed doubles|one male/i.test(r4.message), r4.message);
  await resetPairingState();

  // OPEN season: any combo accepted
  const r5 = await sendSeasonInvitation({ senderId: userA.id, recipientId: userD.id, seasonId: seasonOpenId });
  ok("OPEN season: any combo accepted", r5.success, r5);
  await resetPairingState();

  // SINGLES category: any doubles invite should be rejected (#103-14 "not a doubles category")
  const r6 = await sendSeasonInvitation({ senderId: userA.id, recipientId: userB.id, seasonId: seasonSinglesCategoryId });
  ok("SINGLES category rejects doubles invite", !r6.success, r6);
  ok("error mentions 'not a doubles category'", /not a doubles/i.test(r6.message), r6.message);
}

async function scenario15_SenderQuestionnaireCheck() {
  section("SCENARIO 15 — Sender must have completed questionnaire (bug #103-15)");
  await resetPairingState();
  resetEmits();

  // F has NO pickleball questionnaire
  const r = await sendSeasonInvitation({ senderId: userF.id, recipientId: userA.id, seasonId: seasonOpenId });
  ok("sender without questionnaire rejected", !r.success, r);
  ok("error mentions questionnaire", /questionnaire/i.test(r.message), r.message);

  // Same check in sendPairRequest
  const r2 = await sendPairRequest({ requesterId: userF.id, recipientId: userA.id, seasonId: seasonOpenId });
  ok("sendPairRequest rejects sender without questionnaire", !r2.success, r2);
  ok("sendPairRequest error mentions questionnaire", /questionnaire/i.test(r2.message), r2.message);
}

async function scenario16_DivisionIdPropagation() {
  section("SCENARIO 16 — acceptSeasonInvitation INCOMPLETE branch propagates divisionId (bug #103-16)");
  await resetPairingState();
  resetEmits();

  // Put B in INCOMPLETE state with divisionId set
  const ic = await prisma.partnership.create({
    data: {
      captainId: userB.id, partnerId: null,
      seasonId: seasonOpenId, divisionId,
      status: "INCOMPLETE",
    },
  });
  await prisma.seasonMembership.create({
    data: { userId: userB.id, seasonId: seasonOpenId, divisionId, status: "ACTIVE" },
  });

  // A sends a season invitation to B. B accepts → INCOMPLETE branch fires.
  const inv = await sendSeasonInvitation({ senderId: userA.id, recipientId: userB.id, seasonId: seasonOpenId });
  ok("invite sent to INCOMPLETE captain", inv.success, inv);

  const accepted = await acceptSeasonInvitation(inv.data!.id, userB.id);
  ok("accept-into-INCOMPLETE succeeds", accepted.success, accepted);

  // Verify A's new membership has divisionId set (NOT null)
  const aMembership = await prisma.seasonMembership.findFirst({
    where: { userId: userA.id, seasonId: seasonOpenId },
  });
  ok("A's membership was created", !!aMembership, aMembership);
  ok("A's membership has divisionId (not null)",
    aMembership?.divisionId === divisionId,
    { divisionId: aMembership?.divisionId, expected: divisionId });

  // Verify the partnership is now ACTIVE with B still captain, A as partner
  const pAfter = await prisma.partnership.findUnique({ where: { id: ic.id } });
  ok("partnership is now ACTIVE", pAfter?.status === "ACTIVE");
  ok("B is still captain", pAfter?.captainId === userB.id);
  ok("A is now partner", pAfter?.partnerId === userA.id);
}

async function scenario17_AcceptSweepsOverlapping() {
  section("SCENARIO 17 — Accept paths sweep overlapping pending items (bug #103-18 full)");
  await resetPairingState();
  resetEmits();

  // Seed: C has pair request pending from A. D has season invitation pending from A.
  // A+B are about to form a partnership. Expect both dangling rows to be swept.
  const pr1 = await prisma.pairRequest.create({
    data: {
      requesterId: userA.id, recipientId: userC.id, seasonId: seasonOpenId,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
  const inv1 = await prisma.seasonInvitation.create({
    data: {
      senderId: userA.id, recipientId: userD.id, seasonId: seasonOpenId,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  // A sends pair request to B, B accepts. Partnership created.
  const newPr = await sendPairRequest({ requesterId: userA.id, recipientId: userB.id, seasonId: seasonOpenId });
  const accept = await acceptPairRequest(newPr.data!.id, userB.id);
  ok("A+B partnership created", accept.success);

  // A's old pair request to C should be AUTO_DENIED
  const pr1After = await prisma.pairRequest.findUnique({ where: { id: pr1.id } });
  ok("A's dangling pair request to C swept to AUTO_DENIED",
    pr1After?.status === "AUTO_DENIED", pr1After?.status);

  // A's old season invitation to D should be CANCELLED
  const inv1After = await prisma.seasonInvitation.findUnique({ where: { id: inv1.id } });
  ok("A's dangling season invitation to D swept to CANCELLED",
    inv1After?.status === "CANCELLED", inv1After?.status);
}

async function scenario18_ReplacementInviteFull() {
  section("SCENARIO 18 — Replacement invite end-to-end (bug #103-2 + #103-8 for replacement)");
  await resetPairingState();
  resetEmits();

  // Put B in INCOMPLETE
  const ic = await prisma.partnership.create({
    data: {
      captainId: userB.id, partnerId: null,
      seasonId: seasonOpenId, divisionId,
      status: "INCOMPLETE",
    },
  });
  await prisma.seasonMembership.create({
    data: { userId: userB.id, seasonId: seasonOpenId, divisionId, status: "ACTIVE" },
  });

  // B invites A as replacement
  resetEmits();
  const invite = await inviteReplacementPartner(ic.id, userB.id, userA.id, "Come join");
  ok("inviteReplacementPartner succeeds", invite.success, invite);
  ok("inviteReplacementPartner emits pair_request_updated",
    !!findEmit("pair_request_updated"),
    emits);

  // A accepts the replacement invite
  resetEmits();
  const accepted = await acceptReplacementInvite(invite.data!.id, userA.id);
  ok("acceptReplacementInvite succeeds", accepted.success, accepted);

  // Verify partnership is ACTIVE, B is captain, A is partner
  const pAfter = await prisma.partnership.findUnique({ where: { id: ic.id } });
  ok("partnership → ACTIVE", pAfter?.status === "ACTIVE");
  ok("B still captain", pAfter?.captainId === userB.id);
  ok("A now partner", pAfter?.partnerId === userA.id);

  ok("acceptReplacementInvite emits partnership_updated (partner_joined)",
    emits.some(e => e.event === "partnership_updated" && e.payload.action === "partner_joined"));
}

async function scenario19_ReplacementConflictCheck() {
  section("SCENARIO 19 — Replacement accept with conflict (bug #103-8 for replacement)");
  await resetPairingState();
  resetEmits();

  // B in INCOMPLETE, invites A
  const ic = await prisma.partnership.create({
    data: {
      captainId: userB.id, partnerId: null,
      seasonId: seasonOpenId, divisionId,
      status: "INCOMPLETE",
    },
  });
  const inv = await inviteReplacementPartner(ic.id, userB.id, userA.id);
  ok("replacement invite created", inv.success);

  // Between send and accept, A forms a partnership with C (via direct DB)
  await prisma.partnership.create({
    data: {
      captainId: userA.id, partnerId: userC.id,
      seasonId: seasonOpenId, divisionId,
      status: "ACTIVE", pairRating: 3500,
    },
  });

  // A tries to accept B's replacement invite — should fail (conflict check inside tx)
  const r = await acceptReplacementInvite(inv.data!.id, userA.id);
  ok("acceptReplacementInvite rejects when A already in a partnership", !r.success, r);
  ok("error mentions 'already in a partnership'", /already in a partnership/i.test(r.message), r.message);

  // IC should still be INCOMPLETE
  const icAfter = await prisma.partnership.findUnique({ where: { id: ic.id } });
  ok("IC partnership still INCOMPLETE", icAfter?.status === "INCOMPLETE");
}

async function scenario20_ConcurrentDissolve() {
  section("SCENARIO 20 — True concurrent dissolve race (bug #103-3 real concurrency)");
  await resetPairingState();
  resetEmits();

  // Create ACTIVE partnership A+B
  const p = await prisma.partnership.create({
    data: {
      captainId: userA.id, partnerId: userB.id, seasonId: seasonOpenId,
      divisionId, status: "ACTIVE", pairRating: 3500,
    },
  });
  await prisma.seasonMembership.createMany({
    data: [
      { userId: userA.id, seasonId: seasonOpenId, divisionId, status: "ACTIVE" },
      { userId: userB.id, seasonId: seasonOpenId, divisionId, status: "ACTIVE" },
    ],
  });

  // Fire both dissolves simultaneously via Promise.all — race condition
  const [r1, r2] = await Promise.all([
    dissolvePartnership(p.id, userA.id),
    dissolvePartnership(p.id, userB.id),
  ]);

  // Exactly one must succeed, exactly one must fail with "no longer active"
  const successes = [r1, r2].filter((r) => r.success).length;
  const failures = [r1, r2].filter((r) => !r.success).length;
  ok("exactly one succeeds", successes === 1, { r1, r2 });
  ok("exactly one fails", failures === 1, { r1, r2 });
  const failMsg = [r1, r2].find((r) => !r.success)?.message || "";
  ok("failure message mentions 'no longer active'", /no longer active/i.test(failMsg), failMsg);

  // Verify exactly ONE INCOMPLETE partnership exists as successor
  const incompletes = await prisma.partnership.findMany({
    where: { predecessorId: p.id, status: "INCOMPLETE" },
  });
  ok("exactly one INCOMPLETE successor created (no phantom)", incompletes.length === 1,
    { count: incompletes.length });
}

async function scenario21_DissolveWithdrawalGuard() {
  section("SCENARIO 21 — Dissolve blocked by pending withdrawal (regression guard)");
  await resetPairingState();
  resetEmits();

  // Create ACTIVE partnership A+B
  const p = await prisma.partnership.create({
    data: {
      captainId: userA.id, partnerId: userB.id, seasonId: seasonOpenId,
      divisionId, status: "ACTIVE", pairRating: 3500,
    },
  });

  // A submits a withdrawal request
  await prisma.withdrawalRequest.create({
    data: {
      userId: userA.id,
      seasonId: seasonOpenId,
      partnershipId: p.id,
      reason: "regression test",
      status: "PENDING",
    },
  });

  // A tries to dissolve — should be blocked by the existing pending-withdrawal guard
  const r = await dissolvePartnership(p.id, userA.id);
  ok("dissolve blocked by pending withdrawal", !r.success, r);
  ok("error mentions withdrawal / pending", /pending|withdrawal|change request/i.test(r.message), r.message);

  // Verify P is still ACTIVE
  const pAfter = await prisma.partnership.findUnique({ where: { id: p.id } });
  ok("partnership still ACTIVE after blocked dissolve", pAfter?.status === "ACTIVE");
}

async function scenario22_AcceptCancelledSeason() {
  section("SCENARIO 22 — Accept dead invitation in CANCELLED season (#103 Part 5 finding)");
  await resetPairingState();
  resetEmits();

  // Seed a PENDING season invitation in a CANCELLED season directly.
  // This simulates a user invite sent before admin cancelled the season.
  const inv = await prisma.seasonInvitation.create({
    data: {
      senderId: userA.id,
      recipientId: userB.id,
      seasonId: seasonCancelledId,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  // After the #103 Part 5 fix, acceptSeasonInvitation re-checks season.status
  // inside the transaction. CANCELLED seasons should reject the accept.
  const r = await acceptSeasonInvitation(inv.id, userB.id);
  ok("CANCELLED-season accept rejected", !r.success, r);
  ok("error mentions 'no longer accepting'", /no longer accepting/i.test(r.message), r.message);

  // Also verify the pair-request side
  await resetPairingState();
  const pr = await prisma.pairRequest.create({
    data: {
      requesterId: userA.id, recipientId: userB.id, seasonId: seasonCancelledId,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
  const rPr = await acceptPairRequest(pr.id, userB.id);
  ok("acceptPairRequest in CANCELLED season rejected", !rPr.success, rPr);
  ok("pair request error mentions 'no longer accepting'", /no longer accepting/i.test(rPr.message), rPr.message);
}

// ------------------------------------------------------------------
// Runner
// ------------------------------------------------------------------
async function main() {
  try {
    await seed();
    await scenario1_DissolveThenDissolve();
    await scenario2_DuplicatePartnership();
    await scenario3_LeaveIncomplete();
    await scenario4_GenderValidation();
    await scenario5_CountPhantom();
    await scenario6_DenyEmitsSocket();
    await scenario7_ExpireSweepsRow();
    await scenario8_LazyExpireUnblockResend();
    await scenario9_AllPairingEmits();
    await scenario10_SenderIncompleteBlocks();
    await scenario11_GetPendingDeterministic();
    await scenario12_WithdrawalIdempotent();
    await scenario12b_WithdrawalHappyPath();
    await scenario13_SendPairRequestSeasonStatus();
    await scenario14_GenderMatrix();
    await scenario15_SenderQuestionnaireCheck();
    await scenario16_DivisionIdPropagation();
    await scenario17_AcceptSweepsOverlapping();
    await scenario18_ReplacementInviteFull();
    await scenario19_ReplacementConflictCheck();
    await scenario20_ConcurrentDissolve();
    await scenario21_DissolveWithdrawalGuard();
    await scenario22_AcceptCancelledSeason();
  } catch (err) {
    console.error("\n💥 Test harness threw:", err);
    failed++;
  } finally {
    try {
      await cleanup();
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
    }
  }

  console.log(`\n${"━".repeat(60)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("━".repeat(60));
  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
  }

  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main();
