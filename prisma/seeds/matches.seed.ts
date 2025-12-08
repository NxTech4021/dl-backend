/**
 * Match Seeding
 * Creates 2,500+ matches spread over 12 months for realistic reports
 */

import {
  MatchStatus,
  MatchType,
  MatchFormat,
  ParticipantRole,
  InvitationStatus,
  WalkoverReason,
  CancellationReason,
  MatchAdminActionType,
  User,
  UserStatus,
  Season,
  SeasonStatus,
  Division,
  Match,
} from "@prisma/client";
import { SeededAdmin } from "./users.seed";
import {
  prisma,
  randomDate,
  randomElement,
  randomInt,
  randomBoolean,
  weightedRandom,
  monthsAgo,
  daysAgo,
  daysFromNow,
  logSection,
  logSuccess,
  logProgress,
  VENUES,
  COURT_NAMES,
} from "./utils";

// =============================================
// SEED LEAGUE MATCHES
// =============================================

export async function seedMatches(
  users: User[],
  divisions: Division[],
  seasons: Season[],
  admins: SeededAdmin[]
): Promise<Match[]> {
  logSection("🎾 Seeding matches with all status variations...");

  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const activeDivisions = divisions.filter(d => d.isActiveDivision);
  const finishedDivisions = divisions.filter(d => !d.isActiveDivision);
  const allDivisions = [...activeDivisions, ...finishedDivisions];
  const adminId = admins[0]!.adminId;

  const createdMatches: Match[] = [];

  // Match configurations - weighted for realistic distribution
  // Total: ~2500 league matches spread over 12 months
  const matchConfigs = [
    // COMPLETED matches - bulk of matches (spread over 12 months)
    { status: MatchStatus.COMPLETED, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 1800 },
    { status: MatchStatus.COMPLETED, isWalkover: true, isDisputed: false, isLateCancellation: false, count: 150, walkoverReason: WalkoverReason.NO_SHOW },
    { status: MatchStatus.COMPLETED, isWalkover: true, isDisputed: false, isLateCancellation: false, count: 80, walkoverReason: WalkoverReason.LATE_CANCELLATION },
    { status: MatchStatus.COMPLETED, isWalkover: true, isDisputed: false, isLateCancellation: false, count: 40, walkoverReason: WalkoverReason.INJURY },
    { status: MatchStatus.COMPLETED, isWalkover: true, isDisputed: false, isLateCancellation: false, count: 30, walkoverReason: WalkoverReason.OTHER },
    { status: MatchStatus.COMPLETED, isDisputed: true, isWalkover: false, isLateCancellation: false, count: 100 },

    // SCHEDULED matches - future matches
    { status: MatchStatus.SCHEDULED, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 150 },

    // ONGOING matches - currently playing
    { status: MatchStatus.ONGOING, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 15 },

    // DRAFT matches - incomplete setup
    { status: MatchStatus.DRAFT, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 40 },

    // CANCELLED matches - various reasons
    { status: MatchStatus.CANCELLED, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 30, cancellationReason: CancellationReason.WEATHER },
    { status: MatchStatus.CANCELLED, isWalkover: false, isDisputed: false, isLateCancellation: true, count: 25, cancellationReason: CancellationReason.PERSONAL_EMERGENCY },
    { status: MatchStatus.CANCELLED, isWalkover: false, isDisputed: false, isLateCancellation: true, count: 20, cancellationReason: CancellationReason.ILLNESS },
    { status: MatchStatus.CANCELLED, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 15, cancellationReason: CancellationReason.OTHER },

    // VOID matches - admin voided
    { status: MatchStatus.VOID, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 20 },

    // UNFINISHED matches - started but not completed
    { status: MatchStatus.UNFINISHED, isWalkover: false, isDisputed: false, isLateCancellation: false, count: 25 },
  ];

  const totalMatches = matchConfigs.reduce((sum, c) => sum + c.count, 0);
  let matchIndex = 0;
  let lastLoggedPercent = 0;

  for (const config of matchConfigs) {
    for (let i = 0; i < config.count; i++) {
      const division = allDivisions[matchIndex % allDivisions.length];
      if (!division) {
        matchIndex++;
        continue;
      }

      const season = seasons.find(s => s.id === division.seasonId);
      if (!season) {
        matchIndex++;
        continue;
      }

      // Select different players for each match
      const player1Index = (matchIndex * 2) % activeUsers.length;
      const player2Index = (matchIndex * 2 + 1) % activeUsers.length;
      const player1 = activeUsers[player1Index]!;
      const player2 = activeUsers[player2Index]!;

      // Determine match date based on status - spread over 12 months
      let matchDate: Date;
      if (config.status === MatchStatus.COMPLETED || config.status === MatchStatus.VOID || config.status === MatchStatus.UNFINISHED) {
        // Spread completed matches over 12 months for good chart data
        matchDate = randomDate(monthsAgo(12), daysAgo(1));
      } else if (config.status === MatchStatus.ONGOING) {
        matchDate = new Date();
      } else if (config.status === MatchStatus.SCHEDULED) {
        matchDate = randomDate(daysFromNow(1), daysFromNow(60));
      } else if (config.status === MatchStatus.CANCELLED) {
        matchDate = randomDate(monthsAgo(6), daysAgo(1));
      } else {
        matchDate = randomDate(daysAgo(14), daysFromNow(14));
      }

      // Generate scores for completed matches
      let playerScore: number | null = null;
      let opponentScore: number | null = null;
      let setScores: any = null;

      if (config.status === MatchStatus.COMPLETED && !config.isWalkover) {
        playerScore = randomInt(0, 2);
        opponentScore = playerScore === 2 ? randomInt(0, 1) : 2;
        setScores = generateSetScores(playerScore, opponentScore);
      } else if (config.isWalkover) {
        playerScore = 2;
        opponentScore = 0;
        setScores = { sets: [{ player1: 6, player2: 0 }, { player1: 6, player2: 0 }] };
      }

      const match = await prisma.match.create({
        data: {
          divisionId: division.id,
          leagueId: division.leagueId,
          seasonId: season.id,
          sport: randomElement(["TENNIS", "PICKLEBALL", "PADEL"]),
          matchType: division.gameType === "SINGLES" ? MatchType.SINGLES : MatchType.DOUBLES,
          format: MatchFormat.STANDARD,
          status: config.status,
          matchDate: matchDate,
          location: randomElement(VENUES),
          venue: randomElement(COURT_NAMES),

          // Scores
          playerScore: playerScore,
          opponentScore: opponentScore,
          team1Score: division.gameType === "DOUBLES" ? playerScore : null,
          team2Score: division.gameType === "DOUBLES" ? opponentScore : null,
          setScores: setScores,

          // Flags
          isWalkover: config.isWalkover,
          isDisputed: config.isDisputed,
          isLateCancellation: config.isLateCancellation,
          walkoverReason: config.walkoverReason as WalkoverReason || null,
          cancellationReason: config.cancellationReason as CancellationReason || null,

          // Result tracking for completed matches
          resultSubmittedById: config.status === MatchStatus.COMPLETED ? player1.id : null,
          resultSubmittedAt: config.status === MatchStatus.COMPLETED ? matchDate : null,
          resultConfirmedById: config.status === MatchStatus.COMPLETED ? player2.id : null,
          resultConfirmedAt: config.status === MatchStatus.COMPLETED ? matchDate : null,

          // Cancellation tracking
          cancelledById: config.status === MatchStatus.CANCELLED ? player1.id : null,
          cancelledAt: config.status === MatchStatus.CANCELLED ? matchDate : null,
          cancellationComment: config.status === MatchStatus.CANCELLED ? "Match cancelled due to circumstances" : null,

          // Creator tracking
          createdById: player1.id,
          createdAt: new Date(matchDate.getTime() - randomInt(1, 14) * 24 * 60 * 60 * 1000),

          // Admin notes
          adminNotes: config.isDisputed ? "Match disputed - requires review" :
                      config.isWalkover ? "Walkover recorded" :
                      config.status === MatchStatus.VOID ? "Match voided by admin" : null,
          requiresAdminReview: config.isDisputed || config.isLateCancellation,
        },
      });

      // Create match participants
      await prisma.matchParticipant.createMany({
        data: [
          {
            matchId: match.id,
            userId: player1.id,
            role: ParticipantRole.CREATOR,
            team: division.gameType === "DOUBLES" ? "team1" : null,
            invitationStatus: InvitationStatus.ACCEPTED,
            acceptedAt: new Date(matchDate.getTime() - 7 * 24 * 60 * 60 * 1000),
            didAttend: config.status === MatchStatus.COMPLETED || config.status === MatchStatus.ONGOING,
          },
          {
            matchId: match.id,
            userId: player2.id,
            role: ParticipantRole.OPPONENT,
            team: division.gameType === "DOUBLES" ? "team2" : null,
            invitationStatus: config.status === MatchStatus.DRAFT ? InvitationStatus.PENDING : InvitationStatus.ACCEPTED,
            acceptedAt: config.status !== MatchStatus.DRAFT ? new Date(matchDate.getTime() - 5 * 24 * 60 * 60 * 1000) : null,
            didAttend: config.status === MatchStatus.COMPLETED && !config.isWalkover,
          },
        ],
        skipDuplicates: true,
      });

      // Add partners for doubles matches
      if (division.gameType === "DOUBLES" && activeUsers.length > player2Index + 2) {
        const partner1Index = (player1Index + Math.floor(activeUsers.length / 2)) % activeUsers.length;
        const partner2Index = (player2Index + Math.floor(activeUsers.length / 2)) % activeUsers.length;
        const partner1 = activeUsers[partner1Index]!;
        const partner2 = activeUsers[partner2Index]!;

        await prisma.matchParticipant.createMany({
          data: [
            {
              matchId: match.id,
              userId: partner1.id,
              role: ParticipantRole.PARTNER,
              team: "team1",
              invitationStatus: InvitationStatus.ACCEPTED,
              acceptedAt: new Date(matchDate.getTime() - 6 * 24 * 60 * 60 * 1000),
              didAttend: config.status === MatchStatus.COMPLETED || config.status === MatchStatus.ONGOING,
            },
            {
              matchId: match.id,
              userId: partner2.id,
              role: ParticipantRole.PARTNER,
              team: "team2",
              invitationStatus: config.status === MatchStatus.DRAFT ? InvitationStatus.PENDING : InvitationStatus.ACCEPTED,
              acceptedAt: config.status !== MatchStatus.DRAFT ? new Date(matchDate.getTime() - 4 * 24 * 60 * 60 * 1000) : null,
              didAttend: config.status === MatchStatus.COMPLETED && !config.isWalkover,
            },
          ],
          skipDuplicates: true,
        });
      }

      // Create match scores for completed non-walkover matches
      if (config.status === MatchStatus.COMPLETED && !config.isWalkover && setScores) {
        for (let setNum = 0; setNum < setScores.sets.length; setNum++) {
          const set = setScores.sets[setNum];
          await prisma.matchScore.create({
            data: {
              matchId: match.id,
              setNumber: setNum + 1,
              player1Games: set.player1,
              player2Games: set.player2,
              hasTiebreak: set.player1 === 7 || set.player2 === 7,
              player1Tiebreak: set.player1 === 7 ? randomInt(7, 10) : null,
              player2Tiebreak: set.player2 === 7 ? randomInt(7, 10) : null,
            },
          });
        }
      }

      createdMatches.push(match);
      matchIndex++;

      // Log progress every 10%
      const percent = Math.floor((matchIndex / totalMatches) * 100);
      if (percent >= lastLoggedPercent + 10) {
        logProgress(`League matches: ${matchIndex}/${totalMatches} (${percent}%)`);
        lastLoggedPercent = percent;
      }
    }
  }

  logSuccess(`Created ${createdMatches.length} league matches`);
  logProgress("- COMPLETED (normal, walkover, disputed)");
  logProgress("- SCHEDULED, ONGOING, DRAFT");
  logProgress("- CANCELLED, VOID, UNFINISHED");

  return createdMatches;
}

// =============================================
// SEED FRIENDLY MATCHES
// =============================================

export async function seedFriendlyMatches(users: User[], leagues: any[]): Promise<Match[]> {
  logSection("🏓 Seeding friendly matches...");

  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE && u.completedOnboarding);
  const createdMatches: Match[] = [];

  // 200 friendly matches spread over 12 months
  const friendlyCount = 200;

  for (let i = 0; i < friendlyCount; i++) {
    const player1Index = (i * 2) % activeUsers.length;
    const player2Index = (i * 2 + 1) % activeUsers.length;
    const player1 = activeUsers[player1Index]!;
    const player2 = activeUsers[player2Index]!;

    const league = leagues[i % leagues.length];
    const isCompleted = i < friendlyCount * 0.7; // 70% completed
    const matchDate = isCompleted
      ? randomDate(monthsAgo(12), daysAgo(1))
      : randomDate(daysFromNow(1), daysFromNow(30));

    const playerScore = isCompleted ? randomInt(0, 2) : null;
    const opponentScore = isCompleted ? (playerScore === 2 ? randomInt(0, 1) : 2) : null;

    const match = await prisma.match.create({
      data: {
        divisionId: null, // No division = friendly match
        leagueId: league?.id || null,
        seasonId: null,
        sport: randomElement(["TENNIS", "PICKLEBALL", "PADEL"]),
        matchType: randomElement([MatchType.SINGLES, MatchType.DOUBLES]),
        format: MatchFormat.STANDARD,
        status: isCompleted ? MatchStatus.COMPLETED : MatchStatus.SCHEDULED,
        matchDate: matchDate,
        location: randomElement(["Community Courts", "Private Club", "Public Park", "Sports Center", ...VENUES]),
        venue: randomElement(COURT_NAMES),
        playerScore: playerScore,
        opponentScore: opponentScore,
        createdById: player1.id,
        createdAt: new Date(matchDate.getTime() - randomInt(1, 14) * 24 * 60 * 60 * 1000),
      },
    });

    // Add participants
    await prisma.matchParticipant.createMany({
      data: [
        {
          matchId: match.id,
          userId: player1.id,
          role: ParticipantRole.CREATOR,
          invitationStatus: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
        {
          matchId: match.id,
          userId: player2.id,
          role: ParticipantRole.OPPONENT,
          invitationStatus: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      ],
      skipDuplicates: true,
    });

    createdMatches.push(match);

    if ((i + 1) % 50 === 0) {
      logProgress(`Friendly matches: ${i + 1}/${friendlyCount}`);
    }
  }

  logSuccess(`Created ${createdMatches.length} friendly matches`);
  return createdMatches;
}

// =============================================
// SEED MATCH RESULTS (Best 6 System)
// =============================================

export async function seedMatchResults(matches: Match[], users: User[]) {
  logSection("📈 Seeding match results (Best 6 system)...");

  const completedMatches = matches.filter(m => m.status === MatchStatus.COMPLETED && !m.isWalkover);
  let created = 0;

  for (const match of completedMatches) {
    const participants = await prisma.matchParticipant.findMany({
      where: { matchId: match.id },
    });

    const player1 = participants.find(p => p.role === ParticipantRole.CREATOR);
    const player2 = participants.find(p => p.role === ParticipantRole.OPPONENT);

    if (!player1 || !player2) continue;

    // Check if results already exist
    const existingResult = await prisma.matchResult.findFirst({
      where: { matchId: match.id },
    });
    if (existingResult) continue;

    const player1Won = (match.playerScore || 0) > (match.opponentScore || 0);
    const setsWon1 = match.playerScore || 0;
    const setsLost1 = match.opponentScore || 0;
    const gamesWon1 = setsWon1 * 6 + randomInt(0, 10);
    const gamesLost1 = setsLost1 * 6 + randomInt(0, 10);

    // Player 1 result
    await prisma.matchResult.create({
      data: {
        matchId: match.id,
        playerId: player1.userId,
        opponentId: player2.userId,
        sportType: "PICKLEBALL",
        gameType: match.matchType === MatchType.SINGLES ? "SINGLES" : "DOUBLES",
        isWin: player1Won,
        matchPoints: player1Won ? randomInt(3, 5) : randomInt(1, 2),
        participationPoints: 1,
        setsWonPoints: Math.min(setsWon1, 2),
        winBonusPoints: player1Won ? 2 : 0,
        margin: gamesWon1 - gamesLost1,
        setsWon: setsWon1,
        setsLost: setsLost1,
        gamesWon: gamesWon1,
        gamesLost: gamesLost1,
        datePlayed: match.matchDate,
        countsForStandings: true,
        resultSequence: randomInt(1, 9),
      },
    });

    // Player 2 result (inverse)
    await prisma.matchResult.create({
      data: {
        matchId: match.id,
        playerId: player2.userId,
        opponentId: player1.userId,
        sportType: "PICKLEBALL",
        gameType: match.matchType === MatchType.SINGLES ? "SINGLES" : "DOUBLES",
        isWin: !player1Won,
        matchPoints: !player1Won ? randomInt(3, 5) : randomInt(1, 2),
        participationPoints: 1,
        setsWonPoints: Math.min(setsLost1, 2),
        winBonusPoints: !player1Won ? 2 : 0,
        margin: gamesLost1 - gamesWon1,
        setsWon: setsLost1,
        setsLost: setsWon1,
        gamesWon: gamesLost1,
        gamesLost: gamesWon1,
        datePlayed: match.matchDate,
        countsForStandings: true,
        resultSequence: randomInt(1, 9),
      },
    });

    created += 2;

    if (created % 500 === 0) {
      logProgress(`Match results: ${created} created`);
    }
  }

  logSuccess(`Created ${created} match results`);
}

// =============================================
// SEED PICKLEBALL GAME SCORES
// =============================================

export async function seedPickleballGameScores(matches: Match[]) {
  logSection("🏓 Seeding pickleball game scores...");

  const pickleballMatches = matches.filter(
    m => m.sport === "PICKLEBALL" && m.status === MatchStatus.COMPLETED && !m.isWalkover
  ).slice(0, 300); // First 300 pickleball matches

  let created = 0;

  for (const match of pickleballMatches) {
    const existingScore = await prisma.pickleballGameScore.findFirst({
      where: { matchId: match.id },
    });
    if (existingScore) continue;

    const gamesCount = (match.playerScore || 0) === 2 || (match.opponentScore || 0) === 2 ? 3 : 2;

    for (let gameNum = 1; gameNum <= gamesCount; gameNum++) {
      await prisma.pickleballGameScore.create({
        data: {
          matchId: match.id,
          gameNumber: gameNum,
          player1Points: randomInt(5, 11),
          player2Points: randomInt(5, 11),
        },
      });
      created++;
    }
  }

  logSuccess(`Created ${created} pickleball game scores`);
}

// =============================================
// SEED MATCH INVITATIONS
// =============================================

export async function seedMatchInvitations(matches: Match[], users: User[]) {
  logSection("✉️ Seeding match invitations...");

  const scheduledMatches = matches.filter(
    m => m.status === MatchStatus.SCHEDULED || m.status === MatchStatus.DRAFT
  );
  let created = 0;

  for (const match of scheduledMatches) {
    const participants = await prisma.matchParticipant.findMany({
      where: { matchId: match.id },
    });

    if (participants.length < 2) continue;

    const inviter = participants[0];
    const invitee = participants[1];

    if (!inviter || !invitee) continue;

    const existing = await prisma.matchInvitation.findFirst({
      where: { matchId: match.id, inviteeId: invitee.userId },
    });

    if (existing) continue;

    const status = match.status === MatchStatus.DRAFT
      ? randomElement([InvitationStatus.PENDING, InvitationStatus.EXPIRED, InvitationStatus.DECLINED])
      : InvitationStatus.ACCEPTED;

    await prisma.matchInvitation.create({
      data: {
        matchId: match.id,
        inviterId: inviter.userId,
        inviteeId: invitee.userId,
        status: status,
        message: status === InvitationStatus.PENDING ? "Would you like to play a match?" : null,
        declineReason: status === InvitationStatus.DECLINED ? randomElement(["Schedule conflict", "Already committed", "Not feeling well"]) : null,
        expiresAt: daysFromNow(7),
        respondedAt: status !== InvitationStatus.PENDING ? new Date() : null,
        reminderSentAt: status === InvitationStatus.PENDING ? new Date() : null,
        reminderCount: status === InvitationStatus.PENDING ? 1 : 0,
      },
    });
    created++;
  }

  logSuccess(`Created ${created} match invitations`);
}

// =============================================
// SEED ADMIN ACTIONS ON MATCHES
// =============================================

export async function seedMatchAdminActions(matches: Match[], admins: SeededAdmin[]) {
  logSection("📝 Seeding match admin actions...");

  const adminId = admins[0]!.adminId;
  const actionTypes = [
    MatchAdminActionType.EDIT_RESULT,
    MatchAdminActionType.VOID_MATCH,
    MatchAdminActionType.CONVERT_TO_WALKOVER,
    MatchAdminActionType.APPLY_PENALTY,
    MatchAdminActionType.EDIT_SCHEDULE,
    MatchAdminActionType.OVERRIDE_DISPUTE,
    MatchAdminActionType.REMOVE_PARTICIPANT,
  ];

  // Create actions for ~5% of matches
  const matchesToAction = matches.filter(() => randomBoolean(0.05)).slice(0, 100);
  let created = 0;

  for (const match of matchesToAction) {
    const actionType = randomElement(actionTypes);

    await prisma.matchAdminAction.create({
      data: {
        matchId: match.id,
        adminId: adminId,
        actionType: actionType,
        oldValue: { status: "SCHEDULED", score: null },
        newValue: { status: match.status, score: { player1: match.playerScore, player2: match.opponentScore } },
        reason: `Admin action: ${actionType.toLowerCase().replace(/_/g, ' ')}`,
        triggeredRecalculation: actionType === MatchAdminActionType.EDIT_RESULT,
        ipAddress: "192.168.1.1",
        createdAt: randomDate(monthsAgo(6), new Date()),
      },
    });
    created++;
  }

  logSuccess(`Created ${created} match admin actions`);
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function generateSetScores(playerSets: number, opponentSets: number): { sets: { player1: number; player2: number }[] } {
  const sets: { player1: number; player2: number }[] = [];
  let p1Wins = 0;
  let p2Wins = 0;

  while (p1Wins < playerSets || p2Wins < opponentSets) {
    const p1WinsThisSet = p1Wins < playerSets && (p2Wins >= opponentSets || randomBoolean());

    if (p1WinsThisSet) {
      const loserGames = randomInt(0, 5);
      const isTiebreak = loserGames === 6;
      sets.push({
        player1: isTiebreak ? 7 : 6,
        player2: loserGames,
      });
      p1Wins++;
    } else {
      const loserGames = randomInt(0, 5);
      const isTiebreak = loserGames === 6;
      sets.push({
        player1: loserGames,
        player2: isTiebreak ? 7 : 6,
      });
      p2Wins++;
    }
  }

  return { sets };
}
