/**
 * Division Standings Seed
 * Computes DivisionStanding records from MatchResult data using the Best 6 system.
 */

import { prisma, logSection, logSuccess, logProgress } from "./utils";

export async function seedStandings(): Promise<{ standingCount: number }> {
  logSection("📊 Computing Division Standings from Match Results...");

  // Clear existing standings to rebuild from scratch
  await prisma.divisionStanding.deleteMany({});

  const divisions = await prisma.division.findMany({
    include: {
      season: { select: { id: true, status: true } },
    },
  });

  let standingCount = 0;
  let divisionsProcessed = 0;

  for (const division of divisions) {
    if (!division.season) continue;

    // Get all completed matches in this division
    const matchIds = await prisma.match.findMany({
      where: {
        divisionId: division.id,
        status: "COMPLETED",
      },
      select: { id: true },
    });

    if (matchIds.length === 0) continue;

    const ids = matchIds.map((m) => m.id);

    // Get all MatchResults for these matches
    const results = await prisma.matchResult.findMany({
      where: { matchId: { in: ids } },
      orderBy: { datePlayed: "asc" },
    });

    if (results.length === 0) continue;

    // Check if this is a doubles division
    const isDoubles = division.gameType === "DOUBLES";

    if (isDoubles) {
      // For doubles: compute standings by partnership
      // Get partnerships in this division
      const partnerships = await prisma.partnership.findMany({
        where: {
          divisionId: division.id,
          seasonId: division.season.id,
          status: "ACTIVE",
        },
        select: {
          id: true,
          captainId: true,
          partnerId: true,
        },
      });

      if (partnerships.length === 0) continue;

      // Map userId -> partnershipId
      const userToPartnership = new Map<string, string>();
      for (const p of partnerships) {
        userToPartnership.set(p.captainId, p.id);
        if (p.partnerId) userToPartnership.set(p.partnerId, p.id);
      }

      // Group results by partnershipId (use captainId's results as proxy)
      const byPartnership = new Map<
        string,
        Array<(typeof results)[0]>
      >();
      for (const r of results) {
        const pId = userToPartnership.get(r.playerId);
        if (!pId) continue;
        const arr = byPartnership.get(pId) || [];
        arr.push(r);
        byPartnership.set(pId, arr);
      }

      // Deduplicate: keep only one result per match per partnership
      for (const [pId, pResults] of byPartnership) {
        const seen = new Set<string>();
        const deduped = pResults.filter((r) => {
          if (seen.has(r.matchId)) return false;
          seen.add(r.matchId);
          return true;
        });
        byPartnership.set(pId, deduped);
      }

      const standings = computeStandings(byPartnership);

      // Sort and create standings
      standings.sort(standingComparator);

      for (let rank = 0; rank < standings.length; rank++) {
        const s = standings[rank]!;
        await prisma.divisionStanding.create({
          data: {
            divisionId: division.id,
            seasonId: division.season.id,
            partnershipId: s.entityId,
            rank: rank + 1,
            ...s.stats,
            isLocked: division.season.status === "FINISHED",
          },
        });
        standingCount++;
      }
    } else {
      // For singles: compute standings by playerId
      const byPlayer = new Map<string, Array<(typeof results)[0]>>();
      for (const r of results) {
        const arr = byPlayer.get(r.playerId) || [];
        arr.push(r);
        byPlayer.set(r.playerId, arr);
      }

      const standings = computeStandings(byPlayer);

      // Update countsForStandings and resultSequence on MatchResult records
      for (const [playerId, playerResults] of byPlayer) {
        const sorted = [...playerResults].sort(
          (a, b) => b.matchPoints - a.matchPoints
        );
        for (let i = 0; i < sorted.length; i++) {
          const r = sorted[i]!;
          const isBest6 = i < 6;
          await prisma.matchResult.update({
            where: { id: r.id },
            data: {
              countsForStandings: isBest6,
              resultSequence: isBest6 ? i + 1 : null,
            },
          });
        }
      }

      standings.sort(standingComparator);

      for (let rank = 0; rank < standings.length; rank++) {
        const s = standings[rank]!;
        await prisma.divisionStanding.create({
          data: {
            divisionId: division.id,
            seasonId: division.season.id,
            userId: s.entityId,
            rank: rank + 1,
            ...s.stats,
            isLocked: division.season.status === "FINISHED",
          },
        });
        standingCount++;
      }
    }

    divisionsProcessed++;
    if (divisionsProcessed % 10 === 0) {
      logProgress(
        `   Processed ${divisionsProcessed}/${divisions.length} divisions (${standingCount} standings)`
      );
    }
  }

  logSuccess(
    `Created ${standingCount} division standings across ${divisionsProcessed} divisions`
  );
  return { standingCount };
}

// =============================================
// HELPERS
// =============================================

interface StandingEntry {
  entityId: string; // userId or partnershipId
  stats: {
    wins: number;
    losses: number;
    matchesPlayed: number;
    totalPoints: number;
    countedWins: number;
    countedLosses: number;
    setsWon: number;
    setsLost: number;
    gamesWon: number;
    gamesLost: number;
    best6SetsWon: number;
    best6SetsTotal: number;
    best6GamesWon: number;
    best6GamesTotal: number;
  };
}

function computeStandings(
  grouped: Map<string, Array<{ matchPoints: number; isWin: boolean; setsWon: number; setsLost: number; gamesWon: number; gamesLost: number }>>
): StandingEntry[] {
  const standings: StandingEntry[] = [];

  for (const [entityId, entityResults] of grouped) {
    // Sort by matchPoints descending to select Best 6
    const sorted = [...entityResults].sort(
      (a, b) => b.matchPoints - a.matchPoints
    );
    const best6 = sorted.slice(0, 6);

    // All matches aggregates
    const wins = entityResults.filter((r) => r.isWin).length;
    const losses = entityResults.filter((r) => !r.isWin).length;
    const setsWon = entityResults.reduce((s, r) => s + r.setsWon, 0);
    const setsLost = entityResults.reduce((s, r) => s + r.setsLost, 0);
    const gamesWon = entityResults.reduce((s, r) => s + r.gamesWon, 0);
    const gamesLost = entityResults.reduce((s, r) => s + r.gamesLost, 0);

    // Best 6 aggregates
    const totalPoints = best6.reduce((s, r) => s + r.matchPoints, 0);
    const countedWins = best6.filter((r) => r.isWin).length;
    const countedLosses = best6.filter((r) => !r.isWin).length;
    const best6SetsWon = best6.reduce((s, r) => s + r.setsWon, 0);
    const best6SetsTotal = best6.reduce(
      (s, r) => s + r.setsWon + r.setsLost,
      0
    );
    const best6GamesWon = best6.reduce((s, r) => s + r.gamesWon, 0);
    const best6GamesTotal = best6.reduce(
      (s, r) => s + r.gamesWon + r.gamesLost,
      0
    );

    standings.push({
      entityId,
      stats: {
        wins,
        losses,
        matchesPlayed: entityResults.length,
        totalPoints,
        countedWins,
        countedLosses,
        setsWon,
        setsLost,
        gamesWon,
        gamesLost,
        best6SetsWon,
        best6SetsTotal,
        best6GamesWon,
        best6GamesTotal,
      },
    });
  }

  return standings;
}

function standingComparator(a: StandingEntry, b: StandingEntry): number {
  if (b.stats.totalPoints !== a.stats.totalPoints)
    return b.stats.totalPoints - a.stats.totalPoints;
  if (b.stats.best6SetsWon !== a.stats.best6SetsWon)
    return b.stats.best6SetsWon - a.stats.best6SetsWon;
  return b.stats.best6GamesWon - a.stats.best6GamesWon;
}
