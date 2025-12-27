/**
 * Match Result Creation Service
 * Creates MatchResult records after match completion
 */

import { prisma } from '../../../lib/prisma';
import { MatchPointsCalculator } from './matchPointsCalculator';
import { logger } from '../../../utils/logger';

export class MatchResultCreationService {
  private pointsCalculator = new MatchPointsCalculator();

  /**
   * Create MatchResult records after match completion
   */
  async createMatchResults(matchId: string): Promise<void> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true,
        scores: true,
        pickleballScores: true
      }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.status !== 'COMPLETED') {
      throw new Error('Match must be completed before creating results');
    }

    // Validate match has division and season (required for Best 6)
    if (!match.divisionId || !match.seasonId) {
      logger.warn(`Match ${matchId} has no division or season - skipping MatchResult creation`);
      return;
    }

    // Check if results already exist
    const existingResults = await prisma.matchResult.findMany({
      where: { matchId }
    });

    if (existingResults.length > 0) {
      logger.warn(`MatchResult records already exist for match ${matchId}`);
      return;
    }

    // Parse outcome based on sport
    let outcome;

    // Handle walkover matches - winner gets full points, loser gets 0
    if (match.isWalkover) {
      // For walkovers, determine winner from team1Score/team2Score
      const team1Won = (match.team1Score ?? 0) > (match.team2Score ?? 0);
      outcome = {
        winner: (team1Won ? 'team1' : 'team2') as 'team1' | 'team2',
        team1SetsWon: team1Won ? 2 : 0,
        team2SetsWon: team1Won ? 0 : 2,
        team1GamesWon: team1Won ? 12 : 0,
        team2GamesWon: team1Won ? 0 : 12
      };
    } else if (match.sport === 'PICKLEBALL') {
      if (!match.pickleballScores || match.pickleballScores.length === 0) {
        throw new Error('Pickleball scores not found');
      }
      outcome = this.pointsCalculator.parsePickleballOutcome(
        match.pickleballScores.map(s => ({
          gameNumber: s.gameNumber,
          player1Points: s.player1Points,
          player2Points: s.player2Points
        }))
      );
    } else {
      // Tennis or Padel
      if (!match.scores || match.scores.length === 0) {
        throw new Error('Set scores not found');
      }
      outcome = this.pointsCalculator.parseTennisPadelOutcome(
        match.scores.map(s => ({
          setNumber: s.setNumber,
          player1Games: s.player1Games,
          player2Games: s.player2Games,
          ...(s.player1Tiebreak !== null && { player1Tiebreak: s.player1Tiebreak }),
          ...(s.player2Tiebreak !== null && { player2Tiebreak: s.player2Tiebreak }),
          ...(s.tiebreakType && { tiebreakType: s.tiebreakType })
        })),
        match.set3Format || 'MATCH_TIEBREAK'
      );
    }

    // Calculate points for all participants
    // For singles matches where team is null, assign teams based on participant order
    let participantsWithTeams: Array<{ userId: string; team: string | null }>;

    if (match.matchType === 'SINGLES') {
      // For singles: first participant = team1, second = team2
      participantsWithTeams = match.participants.map((p, index) => ({
        userId: p.userId,
        team: index === 0 ? 'team1' : 'team2'
      }));
    } else {
      // For doubles: use existing team assignments (should already be team1/team2)
      // If somehow null, use array position as fallback
      const team1Count = match.participants.filter(p => p.team === 'team1').length;
      const team2Count = match.participants.filter(p => p.team === 'team2').length;

      if (team1Count > 0 && team2Count > 0) {
        // Teams are properly assigned
        participantsWithTeams = match.participants.map(p => ({
          userId: p.userId,
          team: p.team
        }));
      } else {
        // Fallback: first 2 = team1, last 2 = team2
        participantsWithTeams = match.participants.map((p, index) => ({
          userId: p.userId,
          team: index < 2 ? 'team1' : 'team2'
        }));
        logger.warn(`Match ${matchId} had improper team assignments, using fallback`);
      }
    }

    const matchPoints = this.pointsCalculator.calculateForMatch(
      matchId,
      outcome,
      participantsWithTeams
    );

    // Create MatchResult records in transaction
    await prisma.$transaction(async (tx) => {
      for (const points of matchPoints) {
        await tx.matchResult.create({
          data: {
            matchId,
            playerId: points.playerId,
            opponentId: points.opponentId,
            sportType: match.sport as any,
            gameType: match.matchType === 'SINGLES' ? 'SINGLES' : 'DOUBLES',
            isWin: points.isWin,
            matchPoints: points.matchPoints,
            participationPoints: points.participationPoints,
            setsWonPoints: points.setsWonPoints,
            winBonusPoints: points.winBonusPoints,
            margin: points.margin,
            setsWon: points.setsWon,
            setsLost: points.setsLost,
            gamesWon: points.gamesWon,
            gamesLost: points.gamesLost,
            datePlayed: match.matchDate,
            countsForStandings: false,  // Will be calculated by Best 6 algorithm
            resultSequence: null
          }
        });
      }
    });

    logger.info(`Created MatchResult records for match ${matchId}`, {
      resultCount: matchPoints.length
    });
  }

  /**
   * Delete MatchResult records (for match deletion/voiding)
   */
  async deleteMatchResults(matchId: string): Promise<void> {
    await prisma.matchResult.deleteMany({
      where: { matchId }
    });

    logger.info(`Deleted MatchResult records for match ${matchId}`);
  }
}
