/**
 * Brackets Seed
 * Creates Bracket, BracketRound, and BracketMatch records from division standings.
 */

import {
  BracketType,
  BracketStatus,
  BracketMatchStatus,
  SeedingSource,
} from "@prisma/client";
import {
  prisma,
  randomElement,
  randomDate,
  randomInt,
  monthsAgo,
  logSection,
  logSuccess,
  logProgress,
} from "./utils";

// =============================================
// CONSTANTS
// =============================================

const COURT_LOCATIONS = [
  "Court 1", "Court 2", "Court 3", "Court 4",
  "Main Court", "Centre Court", "Practice Court A",
  "Indoor Court 1", "Indoor Court 2",
];

// =============================================
// SEED FUNCTION
// =============================================

export async function seedBrackets(): Promise<{
  bracketCount: number;
  roundCount: number;
  matchCount: number;
}> {
  logSection("🏆 Seeding tournament brackets...");

  // Get FINISHED seasons with divisions that have standings
  const finishedSeasons = await prisma.season.findMany({
    where: { status: "FINISHED" },
    include: {
      divisions: {
        include: {
          divisionStandings: {
            orderBy: { rank: "asc" },
            take: 8,
            select: { userId: true, rank: true },
          },
        },
      },
    },
    take: 10,
  });

  // Get first admin for publishedById
  const admin = await prisma.admin.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  let bracketCount = 0;
  let roundCount = 0;
  let matchCount = 0;

  for (const season of finishedSeasons) {
    // Pick divisions with at least 4 standings (players)
    const eligibleDivisions = season.divisions.filter(
      (d) => d.divisionStandings.length >= 4 && d.gameType === "SINGLES"
    );

    if (eligibleDivisions.length === 0) continue;

    // Create a bracket for the first eligible division per season
    const division = eligibleDivisions[0]!;
    const standingCount = division.divisionStandings.length;
    const numPlayers = standingCount >= 8 ? 8 : 4;
    const players = division.divisionStandings
      .slice(0, numPlayers)
      .map((s) => s.userId)
      .filter((id): id is string => id !== null);

    if (players.length < numPlayers) continue;

    // Determine bracket status — mostly COMPLETED since these are FINISHED seasons
    const statusRoll = Math.random();
    let status: BracketStatus;
    if (statusRoll < 0.6) {
      status = BracketStatus.COMPLETED;
    } else if (statusRoll < 0.85) {
      status = BracketStatus.IN_PROGRESS;
    } else {
      status = BracketStatus.PUBLISHED;
    }

    const bracketType = Math.random() < 0.8
      ? BracketType.SINGLE_ELIMINATION
      : BracketType.ROUND_ROBIN;

    const startDate = randomDate(monthsAgo(6), monthsAgo(1));
    const endDate = new Date(startDate.getTime() + randomInt(7, 21) * 24 * 60 * 60 * 1000);

    let bracket;
    try {
      bracket = await prisma.bracket.create({
        data: {
          seasonId: season.id,
          divisionId: division.id,
          bracketName: `${division.name} Finals`,
          bracketType,
          status,
          isLocked: status === BracketStatus.COMPLETED || status === BracketStatus.IN_PROGRESS,
          seedingSource: SeedingSource.STANDINGS,
          numPlayers,
          startDate,
          endDate: status === BracketStatus.COMPLETED ? endDate : null,
          publishedAt: startDate,
          publishedById: admin ? admin.id : null,
          createdAt: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
      });
    } catch {
      // Unique constraint on [seasonId, divisionId] — skip duplicates
      continue;
    }
    bracketCount++;

    // Create rounds based on numPlayers (single elimination)
    const rounds: Array<{ id: string; roundNumber: number; roundName: string }> = [];

    if (numPlayers === 8) {
      const roundDefs = [
        { roundNumber: 1, roundName: "Quarter-Finals" },
        { roundNumber: 2, roundName: "Semi-Finals" },
        { roundNumber: 3, roundName: "Finals" },
      ];
      for (const rd of roundDefs) {
        const round = await prisma.bracketRound.create({
          data: {
            bracketId: bracket.id,
            roundNumber: rd.roundNumber,
            roundName: rd.roundName,
            startDate: new Date(startDate.getTime() + (rd.roundNumber - 1) * 3 * 24 * 60 * 60 * 1000),
            endDate: new Date(startDate.getTime() + rd.roundNumber * 3 * 24 * 60 * 60 * 1000),
          },
        });
        rounds.push({ id: round.id, roundNumber: rd.roundNumber, roundName: rd.roundName });
        roundCount++;
      }
    } else {
      // 4 players: 2 rounds
      const roundDefs = [
        { roundNumber: 1, roundName: "Semi-Finals" },
        { roundNumber: 2, roundName: "Finals" },
      ];
      for (const rd of roundDefs) {
        const round = await prisma.bracketRound.create({
          data: {
            bracketId: bracket.id,
            roundNumber: rd.roundNumber,
            roundName: rd.roundName,
            startDate: new Date(startDate.getTime() + (rd.roundNumber - 1) * 5 * 24 * 60 * 60 * 1000),
            endDate: new Date(startDate.getTime() + rd.roundNumber * 5 * 24 * 60 * 60 * 1000),
          },
        });
        rounds.push({ id: round.id, roundNumber: rd.roundNumber, roundName: rd.roundName });
        roundCount++;
      }
    }

    // Create bracket matches
    // Round 1 matches use seeded players
    const round1 = rounds.find((r) => r.roundNumber === 1)!;
    const round1Matches: Array<{ id: string; player1Id: string; player2Id: string }> = [];

    if (numPlayers === 8) {
      // Standard 8-player bracket seeding: 1v8, 4v5, 2v7, 3v6
      const matchups = [
        [0, 7], [3, 4], [1, 6], [2, 5],
      ];
      for (let i = 0; i < matchups.length; i++) {
        const [s1, s2] = matchups[i]!;
        const p1 = players[s1!]!;
        const p2 = players[s2!]!;
        const isCompleted = status === BracketStatus.COMPLETED || (status === BracketStatus.IN_PROGRESS);
        const matchStatus = isCompleted
          ? BracketMatchStatus.COMPLETED
          : BracketMatchStatus.SCHEDULED;
        const winnerId = isCompleted ? randomElement([p1, p2]) : null;

        const bm = await prisma.bracketMatch.create({
          data: {
            bracketId: bracket.id,
            roundId: round1.id,
            matchNumber: i + 1,
            seed1: s1! + 1,
            seed2: s2! + 1,
            player1Id: p1,
            player2Id: p2,
            winnerId,
            status: matchStatus,
            scheduledTime: new Date(startDate.getTime() + i * 2 * 60 * 60 * 1000),
            courtLocation: randomElement(COURT_LOCATIONS),
          },
        });
        round1Matches.push({ id: bm.id, player1Id: p1, player2Id: p2 });
        matchCount++;
      }

      // Semi-finals (round 2)
      const round2 = rounds.find((r) => r.roundNumber === 2)!;
      const round2Matches: Array<{ id: string; winnerId: string | null }> = [];

      for (let i = 0; i < 2; i++) {
        const m1 = round1Matches[i * 2]!;
        const m2 = round1Matches[i * 2 + 1]!;
        // Winners from previous round
        const p1 = status === BracketStatus.COMPLETED || status === BracketStatus.IN_PROGRESS
          ? randomElement([m1.player1Id, m1.player2Id])
          : null;
        const p2 = status === BracketStatus.COMPLETED || status === BracketStatus.IN_PROGRESS
          ? randomElement([m2.player1Id, m2.player2Id])
          : null;

        const isR2Completed = status === BracketStatus.COMPLETED;
        const matchStatus = isR2Completed
          ? BracketMatchStatus.COMPLETED
          : p1 && p2
            ? BracketMatchStatus.SCHEDULED
            : BracketMatchStatus.PENDING;
        const winnerId = isR2Completed && p1 && p2 ? randomElement([p1, p2]) : null;

        const bm = await prisma.bracketMatch.create({
          data: {
            bracketId: bracket.id,
            roundId: round2.id,
            matchNumber: i + 1,
            player1Id: p1,
            player2Id: p2,
            winnerId,
            status: matchStatus,
            scheduledTime: new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000 + i * 2 * 60 * 60 * 1000),
            courtLocation: randomElement(COURT_LOCATIONS),
          },
        });
        round2Matches.push({ id: bm.id, winnerId });
        matchCount++;
      }

      // Finals (round 3)
      const round3 = rounds.find((r) => r.roundNumber === 3)!;
      const sf1Winner = round2Matches[0]?.winnerId;
      const sf2Winner = round2Matches[1]?.winnerId;
      const finalsCompleted = status === BracketStatus.COMPLETED && sf1Winner && sf2Winner;
      const finalsStatus = finalsCompleted
        ? BracketMatchStatus.COMPLETED
        : sf1Winner && sf2Winner
          ? BracketMatchStatus.SCHEDULED
          : BracketMatchStatus.PENDING;

      await prisma.bracketMatch.create({
        data: {
          bracketId: bracket.id,
          roundId: round3.id,
          matchNumber: 1,
          player1Id: sf1Winner,
          player2Id: sf2Winner,
          winnerId: finalsCompleted ? randomElement([sf1Winner!, sf2Winner!]) : null,
          status: finalsStatus,
          scheduledTime: new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000),
          courtLocation: "Centre Court",
        },
      });
      matchCount++;
    } else {
      // 4-player bracket: 2 semi-finals + 1 final
      const matchups = [[0, 3], [1, 2]];
      const sfWinners: (string | null)[] = [];

      for (let i = 0; i < matchups.length; i++) {
        const [s1, s2] = matchups[i]!;
        const p1 = players[s1!]!;
        const p2 = players[s2!]!;
        const isCompleted = status === BracketStatus.COMPLETED || status === BracketStatus.IN_PROGRESS;
        const matchStatus = isCompleted
          ? BracketMatchStatus.COMPLETED
          : BracketMatchStatus.SCHEDULED;
        const winnerId = isCompleted ? randomElement([p1, p2]) : null;
        sfWinners.push(winnerId);

        await prisma.bracketMatch.create({
          data: {
            bracketId: bracket.id,
            roundId: round1.id,
            matchNumber: i + 1,
            seed1: s1! + 1,
            seed2: s2! + 1,
            player1Id: p1,
            player2Id: p2,
            winnerId,
            status: matchStatus,
            scheduledTime: new Date(startDate.getTime() + i * 2 * 60 * 60 * 1000),
            courtLocation: randomElement(COURT_LOCATIONS),
          },
        });
        matchCount++;
      }

      // Finals
      const round2 = rounds.find((r) => r.roundNumber === 2)!;
      const f1 = sfWinners[0];
      const f2 = sfWinners[1];
      const finalsCompleted = status === BracketStatus.COMPLETED && f1 && f2;

      await prisma.bracketMatch.create({
        data: {
          bracketId: bracket.id,
          roundId: round2.id,
          matchNumber: 1,
          player1Id: f1,
          player2Id: f2,
          winnerId: finalsCompleted ? randomElement([f1!, f2!]) : null,
          status: finalsCompleted
            ? BracketMatchStatus.COMPLETED
            : f1 && f2
              ? BracketMatchStatus.SCHEDULED
              : BracketMatchStatus.PENDING,
          scheduledTime: new Date(startDate.getTime() + 5 * 24 * 60 * 60 * 1000),
          courtLocation: "Centre Court",
        },
      });
      matchCount++;
    }

    if (bracketCount % 3 === 0) {
      logProgress(`   Brackets: ${bracketCount}`);
    }
  }

  logSuccess(
    `Created ${bracketCount} brackets, ${roundCount} rounds, ${matchCount} bracket matches`
  );
  return { bracketCount, roundCount, matchCount };
}
