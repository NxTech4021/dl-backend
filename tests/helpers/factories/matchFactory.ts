import { prismaTest } from '../../setup/prismaTestClient';
import {
  MatchStatus,
  MatchType,
  MatchFormat,
  MatchFeeType,
  ParticipantRole,
  InvitationStatus,
} from '@prisma/client';
import { createTestUser } from './userFactory';
import { createTestDivision } from './divisionFactory';

// Simple random string generator
function randomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomFutureDate(): Date {
  const days = Math.floor(Math.random() * 30) + 7; // 7-37 days in future
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function randomCity(): string {
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Austin', 'Miami', 'Seattle'];
  return cities[Math.floor(Math.random() * cities.length)];
}

function randomCourtNumber(): number {
  return Math.floor(Math.random() * 10) + 1;
}

export interface CreateMatchOptions {
  id?: string;
  creatorId?: string;
  divisionId?: string;
  leagueId?: string;
  seasonId?: string;
  sport?: string;
  matchType?: MatchType;
  matchDate?: Date;
  location?: string;
  venue?: string;
  notes?: string;
  status?: MatchStatus;
  format?: MatchFormat;
  fee?: MatchFeeType;
  feeAmount?: number;
  isWalkover?: boolean;
  isDisputed?: boolean;
}

/**
 * Create a test match with sensible defaults
 * Automatically creates a creator user and division if not provided
 */
export async function createTestMatch(options: CreateMatchOptions = {}) {
  const uniqueSuffix = randomString(8);

  // Create creator if not provided
  let creatorId = options.creatorId;
  if (!creatorId) {
    const creator = await createTestUser({ name: 'Match Creator' });
    creatorId = creator.id;
  }

  // Create division if not provided
  let divisionId = options.divisionId;
  let leagueId = options.leagueId;
  let seasonId = options.seasonId;

  if (!divisionId) {
    const division = await createTestDivision();
    divisionId = division.id;
    leagueId = division.leagueId!;
    seasonId = division.seasonId!;
  }

  const match = await prismaTest.match.create({
    data: {
      id: options.id ?? `test-match-${uniqueSuffix}`,
      sport: options.sport ?? 'PICKLEBALL',
      matchType: options.matchType ?? MatchType.SINGLES,
      matchDate: options.matchDate ?? randomFutureDate(),
      location: options.location ?? randomCity(),
      venue: options.venue ?? `Court ${randomCourtNumber()}`,
      notes: options.notes,
      status: options.status ?? MatchStatus.DRAFT,
      format: options.format ?? MatchFormat.STANDARD,
      fee: options.fee ?? MatchFeeType.FREE,
      feeAmount: options.feeAmount ?? 0,
      isWalkover: options.isWalkover ?? false,
      isDisputed: options.isDisputed ?? false,
      createdById: creatorId,
      divisionId: divisionId,
      leagueId: leagueId,
      seasonId: seasonId,
      // Create the creator as a participant
      participants: {
        create: {
          userId: creatorId,
          role: ParticipantRole.CREATOR,
          team: 'team1',
          isStarter: true,
          invitationStatus: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      },
    },
    include: {
      participants: {
        include: {
          user: true,
        },
      },
      division: true,
      createdBy: true,
    },
  });

  return match;
}

/**
 * Create a match with two participants (ready for play)
 */
export async function createMatchWithOpponent(options: CreateMatchOptions = {}) {
  // Create the base match
  const match = await createTestMatch({
    ...options,
    status: MatchStatus.SCHEDULED,
  });

  // Create and add opponent
  const opponent = await createTestUser({ name: 'Opponent' });

  // Create match participant for opponent with PENDING status
  await prismaTest.matchParticipant.create({
    data: {
      matchId: match.id,
      userId: opponent.id,
      role: ParticipantRole.OPPONENT,
      team: 'team2',
      isStarter: true,
      invitationStatus: InvitationStatus.PENDING, // Start as PENDING
    },
  });

  // Create the match invitation
  await prismaTest.matchInvitation.create({
    data: {
      matchId: match.id,
      inviterId: match.createdById!,
      inviteeId: opponent.id,
      status: InvitationStatus.PENDING,
      message: 'Match invitation',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
  });

  // Get the creator
  const creator = await prismaTest.user.findUnique({
    where: { id: match.createdById! },
  });

  // Update match status to SCHEDULED
  const updatedMatch = await prismaTest.match.update({
    where: { id: match.id },
    data: { status: MatchStatus.SCHEDULED },
    include: {
      participants: {
        include: {
          user: true,
        },
      },
      division: true,
      createdBy: true,
    },
  });

  return { match: updatedMatch, opponent, creator: creator! };
}

/**
 * Create a match with submitted scores (ONGOING status)
 */
export async function createMatchWithSubmittedScores(options: CreateMatchOptions = {}) {
  const { match, opponent } = await createMatchWithOpponent(options);

  // Add scores
  const scores = [
    { gameNumber: 1, team1Points: 15, team2Points: 10 },
    { gameNumber: 2, team1Points: 15, team2Points: 12 },
  ];

  const updatedMatch = await prismaTest.match.update({
    where: { id: match.id },
    data: {
      status: MatchStatus.ONGOING,
      setScores: JSON.stringify(scores),
      playerScore: 2,
      opponentScore: 0,
      resultSubmittedById: match.createdById,
      resultSubmittedAt: new Date(),
    },
    include: {
      participants: {
        include: {
          user: true,
        },
      },
      division: true,
      createdBy: true,
    },
  });

  return { match: updatedMatch, opponent, scores };
}

/**
 * Create a completed match
 */
export async function createCompletedMatch(options: CreateMatchOptions = {}) {
  const { match, opponent, scores } = await createMatchWithSubmittedScores(options);

  const updatedMatch = await prismaTest.match.update({
    where: { id: match.id },
    data: {
      status: MatchStatus.COMPLETED,
      resultConfirmedById: opponent.id,
      resultConfirmedAt: new Date(),
      outcome: 'team1_win',
    },
    include: {
      participants: {
        include: {
          user: true,
        },
      },
      division: true,
      createdBy: true,
    },
  });

  return { match: updatedMatch, opponent, scores };
}

/**
 * Create a disputed match
 */
export async function createDisputedMatch(options: CreateMatchOptions = {}) {
  const { match, opponent, scores } = await createMatchWithSubmittedScores(options);

  // Create dispute
  const dispute = await prismaTest.matchDispute.create({
    data: {
      matchId: match.id,
      raisedByUserId: opponent.id,
      disputeCategory: 'WRONG_SCORE',
      disputeComment: 'The scores are incorrect.',
      disputerScore: [
        { gameNumber: 1, team1Points: 10, team2Points: 15 },
        { gameNumber: 2, team1Points: 12, team2Points: 15 },
      ],
      status: 'OPEN',
      priority: 'NORMAL',
    },
  });

  // Update match to disputed
  const updatedMatch = await prismaTest.match.update({
    where: { id: match.id },
    data: { isDisputed: true },
    include: {
      participants: {
        include: {
          user: true,
        },
      },
      division: true,
      createdBy: true,
      disputes: true,
    },
  });

  return { match: updatedMatch, opponent, scores, dispute };
}

/**
 * Create a walkover match
 */
export async function createWalkoverMatch(options: CreateMatchOptions = {}) {
  const { match, opponent } = await createMatchWithOpponent(options);

  // Create walkover record
  const walkover = await prismaTest.matchWalkover.create({
    data: {
      matchId: match.id,
      walkoverReason: 'NO_SHOW',
      walkoverReasonDetail: 'Opponent did not show up',
      defaultingPlayerId: opponent.id,
      winningPlayerId: match.createdById!,
      reportedBy: match.createdById!,
    },
  });

  // Update match
  const updatedMatch = await prismaTest.match.update({
    where: { id: match.id },
    data: {
      status: MatchStatus.COMPLETED,
      isWalkover: true,
      walkoverReason: 'NO_SHOW',
      notes: 'Match ended as walkover - opponent no show',
    },
    include: {
      participants: {
        include: {
          user: true,
        },
      },
      division: true,
      createdBy: true,
      walkover: true,
    },
  });

  return { match: updatedMatch, opponent, walkover };
}
