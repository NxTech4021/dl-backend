/**
 * DMR Ratings Seeding
 * Processes seeded matches through the DMR (Glicko-2) rating system
 * to generate realistic player ratings and rating history.
 *
 * This replaces the old random rating generation with actual
 * algorithmic ratings based on match results.
 */

import {
  MatchStatus,
  MatchType,
  SportType,
  GameType,
} from "@prisma/client";
import {
  prisma,
  logSection,
  logSuccess,
  logProgress,
  logWarning,
} from "./utils";
import { DMRRatingService } from "../../src/services/rating/dmrRatingService";

// =============================================
// TYPES
// =============================================

export interface DMRSeedResult {
  matchesProcessed: number;
  ratingsCreated: number;
  historyEntriesCreated: number;
  errors: number;
}

interface MatchWithDetails {
  id: string;
  sport: string;
  matchType: MatchType;
  seasonId: string | null;
  matchDate: Date;
  playerScore: number | null;
  opponentScore: number | null;
  team1Score: number | null;
  team2Score: number | null;
  outcome: string | null;
  isWalkover: boolean;
  participants: Array<{
    userId: string;
    team: string | null;
    role: string;
  }>;
  scores: Array<{
    setNumber: number;
    player1Games: number;
    player2Games: number;
  }>;
  pickleballScores: Array<{
    gameNumber: number;
    player1Points: number;
    player2Points: number;
  }>;
}

// =============================================
// CLEAR EXISTING RATINGS
// =============================================

async function clearExistingRatings(): Promise<void> {
  logProgress("   Clearing existing PlayerRating and RatingHistory...");

  // Delete in correct order due to foreign keys
  await prisma.ratingHistory.deleteMany({});
  await prisma.playerRating.deleteMany({});

  logProgress("   Cleared existing rating data");
}

// =============================================
// DETERMINE MATCH OUTCOME
// =============================================

function determineOutcome(match: MatchWithDetails): 'team1' | 'team2' | null {
  // If outcome is already set, use it
  if (match.outcome === 'team1' || match.outcome === 'team1_win') return 'team1';
  if (match.outcome === 'team2' || match.outcome === 'team2_win') return 'team2';

  // For singles matches, use playerScore/opponentScore
  if (match.matchType === MatchType.SINGLES) {
    if (match.playerScore !== null && match.opponentScore !== null) {
      return match.playerScore > match.opponentScore ? 'team1' : 'team2';
    }
  }

  // For doubles, use team1Score/team2Score
  if (match.matchType === MatchType.DOUBLES) {
    if (match.team1Score !== null && match.team2Score !== null) {
      return match.team1Score > match.team2Score ? 'team1' : 'team2';
    }
  }

  // Try to determine from set scores
  if (match.scores.length > 0) {
    let team1Sets = 0;
    let team2Sets = 0;
    for (const score of match.scores) {
      if (score.player1Games > score.player2Games) team1Sets++;
      else if (score.player2Games > score.player1Games) team2Sets++;
    }
    if (team1Sets > team2Sets) return 'team1';
    if (team2Sets > team1Sets) return 'team2';
  }

  // Try pickleball scores
  if (match.pickleballScores.length > 0) {
    let team1Games = 0;
    let team2Games = 0;
    for (const score of match.pickleballScores) {
      if (score.player1Points > score.player2Points) team1Games++;
      else if (score.player2Points > score.player1Points) team2Games++;
    }
    if (team1Games > team2Games) return 'team1';
    if (team2Games > team1Games) return 'team2';
  }

  return null;
}

// =============================================
// CONVERT SCORES TO DMR FORMAT
// =============================================

function convertScoresToDMR(match: MatchWithDetails): Array<{ score1: number; score2: number }> {
  if (match.sport === 'PICKLEBALL') {
    if (match.pickleballScores.length > 0) {
      return match.pickleballScores.map(s => ({
        score1: s.player1Points,
        score2: s.player2Points,
      }));
    }
  }

  if (match.scores.length > 0) {
    return match.scores.map(s => ({
      score1: s.player1Games,
      score2: s.player2Games,
    }));
  }

  // Generate default scores based on outcome for walkovers
  if (match.isWalkover) {
    if (match.sport === 'PICKLEBALL') {
      return [
        { score1: 11, score2: 0 },
        { score1: 11, score2: 0 },
      ];
    } else {
      return [
        { score1: 6, score2: 0 },
        { score1: 6, score2: 0 },
      ];
    }
  }

  return [];
}

// =============================================
// PROCESS SINGLES MATCH
// =============================================

async function processSinglesMatch(
  match: MatchWithDetails,
  dmrService: DMRRatingService,
  outcome: 'team1' | 'team2'
): Promise<boolean> {
  const team1Participants = match.participants.filter(p => p.team === 'team1' || p.role === 'CREATOR');
  const team2Participants = match.participants.filter(p => p.team === 'team2' || p.role === 'OPPONENT');

  if (team1Participants.length === 0 || team2Participants.length === 0) {
    return false;
  }

  const winnerId = outcome === 'team1' ? team1Participants[0].userId : team2Participants[0].userId;
  const loserId = outcome === 'team1' ? team2Participants[0].userId : team1Participants[0].userId;

  let setScores = convertScoresToDMR(match);

  // Adjust scores so winner's score is always score1
  if (outcome === 'team2') {
    setScores = setScores.map(s => ({ score1: s.score2, score2: s.score1 }));
  }

  if (setScores.length === 0) {
    // Create default winning scores
    setScores = match.sport === 'PICKLEBALL'
      ? [{ score1: 11, score2: 5 }, { score1: 11, score2: 7 }]
      : [{ score1: 6, score2: 3 }, { score1: 6, score2: 4 }];
  }

  await dmrService.processsinglesMatch({
    winnerId,
    loserId,
    setScores,
    seasonId: match.seasonId!,
    matchId: match.id,
    matchDate: match.matchDate,
    isWalkover: match.isWalkover,
  });

  return true;
}

// =============================================
// PROCESS DOUBLES MATCH
// =============================================

async function processDoublesMatch(
  match: MatchWithDetails,
  dmrService: DMRRatingService,
  outcome: 'team1' | 'team2'
): Promise<boolean> {
  const team1Participants = match.participants.filter(p => p.team === 'team1');
  const team2Participants = match.participants.filter(p => p.team === 'team2');

  if (team1Participants.length < 2 || team2Participants.length < 2) {
    return false;
  }

  const team1Ids: [string, string] = [team1Participants[0].userId, team1Participants[1].userId];
  const team2Ids: [string, string] = [team2Participants[0].userId, team2Participants[1].userId];

  let setScores = convertScoresToDMR(match);

  // Adjust scores so winning team's score is always score1
  if (outcome === 'team2') {
    setScores = setScores.map(s => ({ score1: s.score2, score2: s.score1 }));
  }

  if (setScores.length === 0) {
    // Create default winning scores
    setScores = match.sport === 'PICKLEBALL'
      ? [{ score1: 11, score2: 5 }, { score1: 11, score2: 7 }]
      : [{ score1: 6, score2: 3 }, { score1: 6, score2: 4 }];
  }

  await dmrService.processDoublesMatch({
    team1Ids: outcome === 'team1' ? team1Ids : team2Ids,
    team2Ids: outcome === 'team1' ? team2Ids : team1Ids,
    setScores,
    seasonId: match.seasonId!,
    matchId: match.id,
    matchDate: match.matchDate,
    isWalkover: match.isWalkover,
  });

  return true;
}

// =============================================
// MAIN DMR SEEDING FUNCTION
// =============================================

export async function seedDMRRatings(): Promise<DMRSeedResult> {
  logSection("🎯 Seeding DMR (Glicko-2) Ratings from Match Results...");

  const result: DMRSeedResult = {
    matchesProcessed: 0,
    ratingsCreated: 0,
    historyEntriesCreated: 0,
    errors: 0,
  };

  // Clear existing ratings to start fresh
  await clearExistingRatings();

  // Fetch all completed matches with scores, ordered chronologically
  const matches = await prisma.match.findMany({
    where: {
      status: MatchStatus.COMPLETED,
      seasonId: { not: null }, // Only league matches (need seasonId for ratings)
    },
    include: {
      participants: {
        select: {
          userId: true,
          team: true,
          role: true,
        },
      },
      scores: {
        orderBy: { setNumber: 'asc' },
      },
      pickleballScores: {
        orderBy: { gameNumber: 'asc' },
      },
    },
    orderBy: { matchDate: 'asc' }, // Process in chronological order
  });

  logProgress(`   Found ${matches.length} completed league matches to process`);

  // Create DMR services for each sport
  const dmrServices: Record<string, DMRRatingService> = {
    PICKLEBALL: new DMRRatingService(SportType.PICKLEBALL),
    TENNIS: new DMRRatingService(SportType.TENNIS),
    PADEL: new DMRRatingService(SportType.PADEL),
  };

  let lastLogPercent = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i] as unknown as MatchWithDetails;

    try {
      // Skip if no season (can't create ratings without season context)
      if (!match.seasonId) {
        continue;
      }

      // Determine outcome
      const outcome = determineOutcome(match);
      if (!outcome) {
        result.errors++;
        continue;
      }

      // Get the appropriate DMR service
      const dmrService = dmrServices[match.sport] || dmrServices.PICKLEBALL;

      // Process based on match type
      let success = false;
      if (match.matchType === MatchType.DOUBLES) {
        success = await processDoublesMatch(match, dmrService, outcome);
      } else {
        success = await processSinglesMatch(match, dmrService, outcome);
      }

      if (success) {
        result.matchesProcessed++;
      } else {
        result.errors++;
      }

      // Log progress every 10%
      const percent = Math.floor(((i + 1) / matches.length) * 100);
      if (percent >= lastLogPercent + 10) {
        logProgress(`   DMR Processing: ${i + 1}/${matches.length} (${percent}%)`);
        lastLogPercent = percent;
      }

    } catch (error) {
      result.errors++;
      // Don't log every error to avoid spam, but track them
    }
  }

  // Count created records
  result.ratingsCreated = await prisma.playerRating.count();
  result.historyEntriesCreated = await prisma.ratingHistory.count();

  logSuccess(`DMR Rating Seeding Complete:`);
  logProgress(`   • Matches processed: ${result.matchesProcessed}`);
  logProgress(`   • Player ratings created: ${result.ratingsCreated}`);
  logProgress(`   • History entries created: ${result.historyEntriesCreated}`);
  if (result.errors > 0) {
    logWarning(`   • Errors/skipped: ${result.errors}`);
  }

  return result;
}

// =============================================
// UPDATE MATCH OUTCOMES (Helper for existing matches)
// =============================================

export async function updateMatchOutcomes(): Promise<number> {
  logSection("📝 Updating match outcomes...");

  const matches = await prisma.match.findMany({
    where: {
      status: MatchStatus.COMPLETED,
      outcome: null, // Only matches without outcome set
    },
    include: {
      participants: true,
      scores: true,
      pickleballScores: true,
    },
  });

  let updated = 0;

  for (const match of matches) {
    const outcome = determineOutcome(match as unknown as MatchWithDetails);

    if (outcome) {
      await prisma.match.update({
        where: { id: match.id },
        data: { outcome },
      });
      updated++;
    }
  }

  logSuccess(`Updated ${updated} match outcomes`);
  return updated;
}
