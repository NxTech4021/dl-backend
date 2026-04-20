/**
 * Player Matches & DMR Ratings Seed
 *
 * Seeds 10 singles + 10 doubles completed matches for every existing
 * onboarded user, then processes them through the DMR (Glicko-2) engine
 * to generate real rating histories.
 *
 * Dummy opponent accounts (Password@123) are created on first run and
 * reused on subsequent runs.
 *
 * Run standalone:
 *   npx tsx prisma/seeds/player-matches.seed.ts
 * Or import seedPlayerMatches() from the main seed orchestrator.
 */

import {
  GameType,
  GenderType,
  InvitationStatus,
  MatchFormat,
  MatchStatus,
  MatchType,
  ParticipantRole,
  RatingChangeReason,
  Role,
  SportType,
  UserStatus,
} from '@prisma/client';
import DMRRatingService from '../../src/services/rating/dmrRatingService';
import {
  daysAgo,
  logProgress,
  logSection,
  logSuccess,
  logWarning,
  monthsAgo,
  prisma,
  randomDate,
  randomElement,
  randomInt,
} from './utils';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const MATCHES_PER_USER_SINGLES = 10;
const MATCHES_PER_USER_DOUBLES = 10;
const DEFAULT_SPORT = SportType.PICKLEBALL;

const DUMMY_USERS = [
  { name: 'Bot Alpha',   email: 'bot1@dleague.com', username: 'bot_alpha' },
  { name: 'Bot Bravo',   email: 'bot2@dleague.com', username: 'bot_bravo' },
  { name: 'Bot Charlie', email: 'bot3@dleague.com', username: 'bot_charlie' },
  { name: 'Bot Delta',   email: 'bot4@dleague.com', username: 'bot_delta' },
  { name: 'Bot Echo',    email: 'bot5@dleague.com', username: 'bot_echo' },
];

// Realistic pickleball set scores (winner perspective: score1 > score2)
const PICKLEBALL_WINNING_SCORES: Array<[number, number][]> = [
  [[ 11, 7 ], [ 11, 5 ]],
  [[ 11, 9 ], [ 11, 8 ]],
  [[ 11, 3 ], [ 11, 6 ]],
  [[ 11, 8 ], [  9, 11 ], [ 11, 7 ]],
  [[ 11, 6 ], [ 11, 4 ]],
  [[ 11, 9 ], [  7, 11 ], [ 11, 9 ]],
  [[ 11, 5 ], [ 11, 3 ]],
  [[ 11, 8 ], [ 11, 7 ]],
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function pickScores() {
  return randomElement(PICKLEBALL_WINNING_SCORES).map(([s1, s2]) => ({ score1: s1, score2: s2 }));
}

async function ensureOrGetSeason(): Promise<string> {
  // Prefer an active season
  const active = await prisma.season.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  if (active) return active.id;

  // Fall back to any existing season
  const any = await prisma.season.findFirst({ orderBy: { createdAt: 'desc' } });
  if (any) return any.id;

  // Create a minimal test season
  logProgress('   No season found – creating seed season...');
  const season = await prisma.season.create({
    data: {
      name: 'Seed Season 2026',
      status: 'ACTIVE' as any,
      isActive: true,
      entryFee: 0,
      startDate: monthsAgo(6),
      endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    },
  });
  return season.id;
}

async function ensureDummyUsers(): Promise<string[]> {
  const { hashPassword } = await import('better-auth/crypto');
  const hashed = await hashPassword('Password@123');

  const ids: string[] = [];
  for (const d of DUMMY_USERS) {
    let user = await prisma.user.findUnique({ where: { email: d.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: d.name,
          email: d.email,
          username: d.username,
          role: Role.USER,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          completedOnboarding: true,
          gender: 'MALE' as GenderType,
          createdAt: monthsAgo(8),
        },
      });
      await prisma.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: 'credential',
          password: hashed,
        },
      });
    }
    ids.push(user.id);
  }
  return ids;
}

async function createSinglesMatch(
  seasonId: string,
  player1Id: string,
  player2Id: string,
  matchDate: Date,
): Promise<string> {
  const match = await prisma.match.create({
    data: {
      sport: DEFAULT_SPORT as unknown as string,
      matchType: MatchType.SINGLES,
      status: MatchStatus.COMPLETED,
      matchDate,
      format: MatchFormat.STANDARD,
      seasonId,
      isFriendly: false,
      outcome: 'team1',      // player1 wins by default; DMR service honours winnerId
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      {
        matchId: match.id,
        userId: player1Id,
        team: 'team1',
        role: ParticipantRole.CREATOR,
        invitationStatus: InvitationStatus.ACCEPTED,
        isStarter: true,
      },
      {
        matchId: match.id,
        userId: player2Id,
        team: 'team2',
        role: ParticipantRole.OPPONENT,
        invitationStatus: InvitationStatus.ACCEPTED,
        isStarter: true,
      },
    ],
  });

  return match.id;
}

async function createDoublesMatch(
  seasonId: string,
  team1: [string, string],
  team2: [string, string],
  matchDate: Date,
): Promise<string> {
  const match = await prisma.match.create({
    data: {
      sport: DEFAULT_SPORT as unknown as string,
      matchType: MatchType.DOUBLES,
      status: MatchStatus.COMPLETED,
      matchDate,
      format: MatchFormat.STANDARD,
      seasonId,
      isFriendly: false,
      outcome: 'team1',
    },
  });

  const participants = [
    { userId: team1[0], team: 'team1', role: ParticipantRole.CREATOR },
    { userId: team1[1], team: 'team1', role: ParticipantRole.PARTNER },
    { userId: team2[0], team: 'team2', role: ParticipantRole.OPPONENT },
    { userId: team2[1], team: 'team2', role: ParticipantRole.OPPONENT },
  ];

  await prisma.matchParticipant.createMany({
    data: participants.map(p => ({
      matchId: match.id,
      userId: p.userId,
      team: p.team,
      role: p.role,
      invitationStatus: InvitationStatus.ACCEPTED,
      isStarter: true,
    })),
  });

  return match.id;
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

export async function seedPlayerMatches(): Promise<void> {
  logSection('🏓 Seeding player match history & DMR ratings...');

  // 1. Season
  const seasonId = await ensureOrGetSeason();
  logProgress(`   Using season: ${seasonId}`);

  // 2. Dummy bot users
  const botIds = await ensureDummyUsers();
  logProgress(`   Ensured ${botIds.length} dummy bot users`);

  // 3. All onboarded real users
  const realUsers = await prisma.user.findMany({
    where: { completedOnboarding: true, status: UserStatus.ACTIVE, role: Role.USER },
    select: { id: true, name: true },
  });

  if (realUsers.length === 0) {
    logWarning('   No onboarded users found – skipping match seed.');
    return;
  }
  logProgress(`   Found ${realUsers.length} real users to seed matches for`);

  // 4. DMR services (one per sport)
  const dmrPickleball = new DMRRatingService(SportType.PICKLEBALL);

  let singlesCreated = 0;
  let doublesCreated = 0;
  let errors = 0;

  for (let i = 0; i < realUsers.length; i++) {
    const user = realUsers[i]!;

    // ── Singles ──────────────────────────────
    for (let m = 0; m < MATCHES_PER_USER_SINGLES; m++) {
      const opponent = botIds[m % botIds.length]!;
      if (opponent === user.id) continue;

      const matchDate = randomDate(monthsAgo(6), daysAgo(1));
      // Alternate wins/losses to build realistic history
      const userWins = m % 2 === 0;
      const winnerId = userWins ? user.id : opponent;
      const loserId  = userWins ? opponent : user.id;
      const rawScores = pickScores();
      // If user lost, flip scores so winner's score1 > score2
      const setScores = userWins
        ? rawScores
        : rawScores.map(s => ({ score1: s.score2, score2: s.score1 }));

      try {
        const matchId = await createSinglesMatch(seasonId, user.id, opponent, matchDate);
        await dmrPickleball.processSinglesMatch({
          winnerId,
          loserId,
          setScores,
          seasonId,
          matchId,
          matchDate,
        });
        singlesCreated++;
      } catch (err: any) {
        // Unique constraint hit (player already has max rating record) — skip silently
        if (!err?.message?.includes('Unique constraint')) {
          logWarning(`   Singles match error for ${user.name}: ${err?.message}`);
        }
        errors++;
      }
    }

    // ── Doubles ──────────────────────────────
    for (let m = 0; m < MATCHES_PER_USER_DOUBLES; m++) {
      // Partner: pick another real user if available, else a bot
      const partnerId = realUsers.length > 1
        ? realUsers[(i + m + 1) % realUsers.length]!.id
        : botIds[0]!;

      // Avoid self-matchup
      if (partnerId === user.id) continue;

      const opp1 = botIds[m % botIds.length]!;
      const opp2 = botIds[(m + 1) % botIds.length]!;
      if (opp1 === opp2 || opp1 === user.id || opp1 === partnerId) continue;
      if (opp2 === user.id || opp2 === partnerId) continue;

      const matchDate = randomDate(monthsAgo(6), daysAgo(1));
      const userTeamWins = m % 2 === 0;
      const rawScores = pickScores(); // score1 > score2 (team1 wins)

      // team1Ids is always the WINNING team for the DMR service
      const team1Ids: [string, string] = userTeamWins ? [user.id, partnerId] : [opp1, opp2];
      const team2Ids: [string, string] = userTeamWins ? [opp1, opp2] : [user.id, partnerId];

      try {
        const matchId = await createDoublesMatch(
          seasonId,
          [user.id, partnerId],
          [opp1, opp2],
          matchDate,
        );
        await dmrPickleball.processDoublesMatch({
          team1Ids,
          team2Ids,
          setScores: rawScores,
          seasonId,
          matchId,
          matchDate,
        });
        doublesCreated++;
      } catch (err: any) {
        if (!err?.message?.includes('Unique constraint')) {
          logWarning(`   Doubles match error for ${user.name}: ${err?.message}`);
        }
        errors++;
      }
    }

    if ((i + 1) % 5 === 0 || i === realUsers.length - 1) {
      logProgress(`   Progress: ${i + 1}/${realUsers.length} users processed`);
    }
  }

  logSuccess(`✅ Match seed complete`);
  logSuccess(`   Singles matches created: ${singlesCreated}`);
  logSuccess(`   Doubles matches created: ${doublesCreated}`);
  if (errors > 0) logWarning(`   Skipped/errors: ${errors}`);
  logProgress('');
  logProgress('   Dummy bot accounts (Password@123):');
  DUMMY_USERS.forEach(d => logProgress(`   - ${d.email}`));
}

// ─────────────────────────────────────────────
// Standalone runner
// ─────────────────────────────────────────────

async function main() {
  await seedPlayerMatches();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
