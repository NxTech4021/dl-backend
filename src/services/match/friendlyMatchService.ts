/**
 * Friendly Match Service
 * Handles friendly match creation, listing, joining, and result submission
 * Note: Friendly matches do NOT affect ratings or standings
 */

import { prisma } from '../../lib/prisma';
import {
  MatchType,
  MatchFormat,
  MatchStatus,
  InvitationStatus,
  ParticipantRole,
  GenderRestriction,
  SportType
} from '@prisma/client';
import { logger } from '../../utils/logger';
import { NotificationService } from '../notificationService';

// Type alias until Prisma client is regenerated after migration
type MatchFeeType = 'FREE' | 'SPLIT' | 'FIXED';

// Types
export interface CreateFriendlyMatchInput {
  createdById: string;
  sport: SportType;
  matchType: MatchType;
  format?: MatchFormat;
  matchDate: Date;
  location?: string;
  venue?: string;
  notes?: string;
  duration?: number;
  courtBooked?: boolean;
  fee?: MatchFeeType;
  feeAmount?: number;
  genderRestriction?: GenderRestriction; // MALE, FEMALE, OPEN (null = OPEN/All)
  skillLevels: string[]; // ["BEGINNER", "IMPROVER", "INTERMEDIATE", "UPPER_INTERMEDIATE", "EXPERT"]
  opponentId?: string;
  partnerId?: string;
  opponentPartnerId?: string;
  message?: string;
  expiresInHours?: number;
  // Request fields
  isRequest?: boolean;
  requestRecipientId?: string;
}

export interface FriendlyMatchFilters {
  sport?: SportType;
  matchType?: MatchType;
  status?: MatchStatus;
  fromDate?: Date;
  toDate?: Date;
  hasOpenSlots?: boolean;
  genderRestriction?: GenderRestriction;
  skillLevels?: string[];
  userId?: string; // Matches where user is participant
}

export interface SubmitFriendlyResultInput {
  matchId: string;
  submittedById: string;
  setScores?: SetScore[];
  gameScores?: PickleballScore[];
  comment?: string;
  evidence?: string;
}

export interface SetScore {
  setNumber: number;
  team1Games: number;
  team2Games: number;
  team1Tiebreak?: number;
  team2Tiebreak?: number;
}

export interface PickleballScore {
  gameNumber: number;
  team1Points: number;
  team2Points: number;
}

export interface ConfirmFriendlyResultInput {
  matchId: string;
  userId: string;
  confirmed: boolean;
  disputeReason?: string;
}

export class FriendlyMatchService {
  private notificationService: NotificationService;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }

  /**
   * Create a friendly match
   */
  async createFriendlyMatch(input: CreateFriendlyMatchInput) {
    const {
      createdById,
      sport,
      matchType,
      format = MatchFormat.STANDARD,
      matchDate,
      location,
      venue,
      notes,
      duration,
      courtBooked,
      fee = 'FREE',
      feeAmount,
      genderRestriction,
      skillLevels,
      opponentId,
      partnerId,
      opponentPartnerId,
      message,
      expiresInHours = 48,
      isRequest = false,
      requestRecipientId
    } = input;

    // Validate skill levels
    const validSkillLevels = ['BEGINNER', 'IMPROVER', 'INTERMEDIATE', 'UPPER_INTERMEDIATE', 'EXPERT'];
    if (!skillLevels || skillLevels.length === 0) {
      throw new Error('At least one skill level is required');
    }
    if (!skillLevels.every(level => validSkillLevels.includes(level))) {
      throw new Error('Invalid skill level. Must be one of: BEGINNER, IMPROVER, INTERMEDIATE, UPPER_INTERMEDIATE, EXPERT');
    }

    // Calculate expiration date for requests (24 hours from now)
    const requestExpiresAt = isRequest && requestRecipientId
      ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      : null;

    // Create match with isFriendly = true
    const match = await prisma.match.create({
      data: {
        isFriendly: true,
        isFriendlyRequest: isRequest && requestRecipientId ? true : false,
        requestRecipientId: isRequest && requestRecipientId ? requestRecipientId : null,
        requestExpiresAt: requestExpiresAt,
        requestStatus: isRequest && requestRecipientId ? InvitationStatus.PENDING : null,
        sport,
        matchType,
        format,
        matchDate,
        location,
        venue,
        notes,
        duration,
        courtBooked,
        fee: fee as any,
        feeAmount: feeAmount ? feeAmount : null,
        genderRestriction: genderRestriction || null,
        skillLevels: skillLevels as any, // Prisma will handle string array
        status: MatchStatus.SCHEDULED,
        createdById,
        // No divisionId, leagueId, seasonId for friendly matches
      } as any,
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, image: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        }
      }
    });

    // Add creator as participant
    await prisma.matchParticipant.create({
      data: {
        matchId: match.id,
        userId: createdById,
        role: ParticipantRole.CREATOR,
        invitationStatus: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
        team: 'team1'
      }
    });

    // Handle direct challenge (opponent specified)
    if (opponentId) {
      if (matchType === MatchType.SINGLES) {
        // Add opponent
        await prisma.matchParticipant.create({
          data: {
            matchId: match.id,
            userId: opponentId,
            role: ParticipantRole.OPPONENT,
            invitationStatus: InvitationStatus.PENDING,
            team: 'team2'
          }
        });

        // Create invitation
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expiresInHours);

        await prisma.matchInvitation.create({
          data: {
            matchId: match.id,
            inviterId: createdById,
            inviteeId: opponentId,
            status: InvitationStatus.PENDING,
            message: message || null,
            expiresAt
          }
        });
      } else if (matchType === MatchType.DOUBLES) {
        // Doubles: need partner and opponent partner
        if (!partnerId || !opponentPartnerId) {
          throw new Error('partnerId and opponentPartnerId are required for doubles matches');
        }

        // Add partner
        await prisma.matchParticipant.create({
          data: {
            matchId: match.id,
            userId: partnerId,
            role: ParticipantRole.PARTNER,
            invitationStatus: InvitationStatus.PENDING,
            team: 'team1'
          }
        });

        // Add opponent
        await prisma.matchParticipant.create({
          data: {
            matchId: match.id,
            userId: opponentId,
            role: ParticipantRole.OPPONENT,
            invitationStatus: InvitationStatus.PENDING,
            team: 'team2'
          }
        });

        // Add opponent partner
        await prisma.matchParticipant.create({
          data: {
            matchId: match.id,
            userId: opponentPartnerId,
            role: ParticipantRole.OPPONENT,
            invitationStatus: InvitationStatus.PENDING,
            team: 'team2'
          }
        });

        // Create invitations
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expiresInHours);

        await Promise.all([
          prisma.matchInvitation.create({
            data: {
              matchId: match.id,
              inviterId: createdById,
              inviteeId: partnerId,
              status: InvitationStatus.PENDING,
              message: message || null,
              expiresAt
            }
          }),
          prisma.matchInvitation.create({
            data: {
              matchId: match.id,
              inviterId: createdById,
              inviteeId: opponentId,
              status: InvitationStatus.PENDING,
              message: message || null,
              expiresAt
            }
          }),
          prisma.matchInvitation.create({
            data: {
              matchId: match.id,
              inviterId: createdById,
              inviteeId: opponentPartnerId,
              status: InvitationStatus.PENDING,
              message: message || null,
              expiresAt
            }
          })
        ]);
      }
    }

    // Fetch full match with all relations
    const fullMatch = await prisma.match.findUnique({
      where: { id: match.id },
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, image: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        },
        invitations: {
          include: {
            inviter: {
              select: { id: true, name: true, username: true, image: true }
            },
            invitee: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        }
      }
    });

    return fullMatch;
  }

  /**
   * Get friendly matches with filters
   */
  async getFriendlyMatches(filters: FriendlyMatchFilters, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where: any = {
      isFriendly: true as any,
      // Exclude pending/declined/expired requests - only show accepted requests or regular friendly matches
      OR: [
        { isFriendlyRequest: false }, // Regular friendly matches
        { 
          isFriendlyRequest: true,
          requestStatus: InvitationStatus.ACCEPTED // Only accepted requests
        }
      ]
    };

    if (filters.sport) {
      where.sport = filters.sport;
    }

    if (filters.matchType) {
      where.matchType = filters.matchType;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.fromDate) {
      where.matchDate = { ...where.matchDate, gte: filters.fromDate };
    }

    if (filters.toDate) {
      where.matchDate = { ...where.matchDate, lte: filters.toDate };
    }

    if (filters.genderRestriction) {
      (where as any).OR = [
        { genderRestriction: filters.genderRestriction },
        { genderRestriction: null } // Also include matches with no restriction (OPEN)
      ];
    }

    if (filters.skillLevels && filters.skillLevels.length > 0) {
      // Match if any of the user's skill levels match any of the match's skill levels
      (where as any).skillLevels = {
        hasSome: filters.skillLevels
      };
    }

    if (filters.userId) {
      where.participants = {
        some: {
          userId: filters.userId
        }
      };
    }

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, name: true, username: true, image: true }
          },
          participants: {
            include: {
              user: {
                select: { id: true, name: true, username: true, image: true }
              }
            }
          }
        },
        orderBy: { matchDate: 'asc' },
        skip,
        take: limit
      }),
      prisma.match.count({ where })
    ]);

    // Filter by hasOpenSlots if requested
    let filteredMatches = matches;
    if (filters.hasOpenSlots === true) {
      filteredMatches = matches.filter((match: any) => {
        const requiredParticipants = match.matchType === MatchType.DOUBLES ? 4 : 2;
        // Count both ACCEPTED and PENDING participants as they represent reserved slots
        const activeParticipants = (match.participants || []).filter(
          (p: any) => p.invitationStatus === InvitationStatus.ACCEPTED || 
                     p.invitationStatus === InvitationStatus.PENDING
        );
        return activeParticipants.length < requiredParticipants;
      });
    }

    return {
      matches: filteredMatches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get friendly match by ID
   */
  async getFriendlyMatchById(id: string) {
    const match = await prisma.match.findFirst({
      where: { id, isFriendly: true } as any,
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, image: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        },
        invitations: {
          include: {
            inviter: {
              select: { id: true, name: true, username: true, image: true }
            },
            invitee: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        },
        scores: true,
        pickleballScores: true
      }
    });

    if (!match) {
      throw new Error('Friendly match not found');
    }

    return match;
  }

  /**
   * Join a friendly match
   */
  async joinFriendlyMatch(matchId: string, userId: string, asPartner: boolean = false, partnerId?: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true,
        createdBy: true
      }
    }) as any;

    if (!match || !match.isFriendly) {
      throw new Error('Friendly match not found');
    }

    // If this is a request, check expiration and status
    if (match.isFriendlyRequest) {
      // Check if expired
      if (match.requestExpiresAt && new Date(match.requestExpiresAt) < new Date()) {
        // Auto-expire if not already expired
        if (match.requestStatus !== InvitationStatus.EXPIRED) {
          await prisma.match.update({
            where: { id: matchId },
            data: {
              requestStatus: InvitationStatus.EXPIRED
            } as any
          });
        }
        throw new Error('This friendly match request has expired');
      }

      // Check if declined
      if (match.requestStatus === InvitationStatus.DECLINED) {
        throw new Error('This friendly match request has been declined');
      }

      // Check if user is the recipient
      if (match.requestRecipientId !== userId) {
        throw new Error('You are not the recipient of this request');
      }

      // If joining a request, automatically accept it
      await prisma.match.update({
        where: { id: matchId },
        data: {
          isFriendlyRequest: false,
          requestStatus: InvitationStatus.ACCEPTED,
          requestExpiresAt: null
        } as any
      });
    }

    // Check if match is full
    // Count both ACCEPTED and PENDING participants as they represent reserved slots
    const requiredParticipants = match.matchType === MatchType.DOUBLES ? 4 : 2;
    const activeParticipants = (match.participants || []).filter(
      (p: any) => p.invitationStatus === InvitationStatus.ACCEPTED || 
                 p.invitationStatus === InvitationStatus.PENDING
    );

    if (activeParticipants.length >= requiredParticipants) {
      throw new Error('Match is full');
    }

    // Check if user is already a participant
    const existingParticipant = match.participants.find((p: any) => p.userId === userId);
    if (existingParticipant) {
      throw new Error('You are already a participant in this match');
    }

    // Validate gender restriction
    const matchGenderRestriction = (match as any).genderRestriction;
    if (matchGenderRestriction) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { gender: true }
      });

      if (user?.gender) {
        const userGenderUpper = user.gender.toUpperCase();
        const restrictionUpper = matchGenderRestriction.toString().toUpperCase();

        if (restrictionUpper === 'MALE' && userGenderUpper !== 'MALE') {
          throw new Error('This match is restricted to male players only');
        }
        if (restrictionUpper === 'FEMALE' && userGenderUpper !== 'FEMALE') {
          throw new Error('This match is restricted to female players only');
        }
      }
    }

    // Validate skill level (if user has skill level info - this would need to be stored in User model or fetched from ratings)
    // For now, we'll skip this validation as skill level isn't stored on User model
    // This can be enhanced later by checking user's rating or adding skillLevel to User model

    // Determine role and team
    let role: ParticipantRole;
    let team: string;

    if (match.matchType === MatchType.SINGLES) {
      role = ParticipantRole.OPPONENT;
      team = 'team2';
    } else {
      // Doubles
      if (asPartner) {
        role = ParticipantRole.PARTNER;
        team = 'team1';
      } else {
        role = ParticipantRole.OPPONENT;
        team = 'team2';
      }
    }

    // Add participant
    await prisma.matchParticipant.create({
      data: {
        matchId: match.id,
        userId,
        role,
        invitationStatus: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
        team
      }
    });

    // If doubles and asPartner, also add partnerId if provided
    if (match.matchType === MatchType.DOUBLES && asPartner && partnerId) {
      const partnerParticipant = (match.participants || []).find((p: any) => p.userId === partnerId);
      if (!partnerParticipant) {
        await prisma.matchParticipant.create({
          data: {
            matchId: match.id,
            userId: partnerId,
            role: ParticipantRole.PARTNER,
            invitationStatus: InvitationStatus.ACCEPTED,
            acceptedAt: new Date(),
            team: 'team1'
          }
        });
      }
    }

    // Return updated match
    return this.getFriendlyMatchById(matchId);
  }

  /**
   * Submit friendly match result (NO rating calculation)
   */
  async submitFriendlyResult(input: SubmitFriendlyResultInput) {
    const { matchId, submittedById, setScores, gameScores, comment, evidence } = input;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true,
        scores: true,
        pickleballScores: true
      }
    }) as any;

    if (!match || !match.isFriendly) {
      throw new Error('Friendly match not found');
    }

    // Verify submitter is a participant
    const submitterParticipant = (match.participants || []).find(
      (p: any) => p.userId === submittedById && p.invitationStatus === InvitationStatus.ACCEPTED
    );

    if (!submitterParticipant) {
      throw new Error('Submitter must be a participant in the match');
    }

    // Check match status
    if (match.status === MatchStatus.COMPLETED) {
      throw new Error('Match has already been completed');
    }

    if (match.status === MatchStatus.ONGOING) {
      throw new Error('Match result is pending opponent confirmation');
    }

    // Calculate scores
    let team1Score: number, team2Score: number, winner: string;

    if (match.sport === 'PICKLEBALL') {
      if (!gameScores || !Array.isArray(gameScores) || gameScores.length === 0) {
        throw new Error('gameScores array is required for Pickleball matches');
      }
      const result = this.calculatePickleballFinalScore(gameScores);
      team1Score = result.team1Score;
      team2Score = result.team2Score;
      winner = result.winner;

      // Save pickleball scores
      await Promise.all(
        gameScores.map(score =>
          prisma.pickleballGameScore.upsert({
            where: {
              matchId_gameNumber: {
                matchId: match.id,
                gameNumber: score.gameNumber
              }
            },
            create: {
              matchId: match.id,
              gameNumber: score.gameNumber,
              player1Points: score.team1Points,
              player2Points: score.team2Points
            },
            update: {
              player1Points: score.team1Points,
              player2Points: score.team2Points
            }
          })
        )
      );
    } else {
      // Tennis/Padel
      if (!setScores || !Array.isArray(setScores) || setScores.length === 0) {
        throw new Error('setScores array is required for Tennis/Padel matches');
      }
      const result = this.calculateFinalScore(setScores);
      team1Score = result.team1Score;
      team2Score = result.team2Score;
      winner = result.winner;

      // Save set scores
      await Promise.all(
        setScores.map(score =>
          prisma.matchScore.upsert({
            where: {
              matchId_setNumber: {
                matchId: match.id,
                setNumber: score.setNumber
              }
            },
            create: {
              matchId: match.id,
              setNumber: score.setNumber,
              player1Games: score.team1Games,
              player2Games: score.team2Games,
              player1Tiebreak: score.team1Tiebreak ?? null,
              player2Tiebreak: score.team2Tiebreak ?? null
            },
            update: {
              player1Games: score.team1Games,
              player2Games: score.team2Games,
              player1Tiebreak: score.team1Tiebreak ?? null,
              player2Tiebreak: score.team2Tiebreak ?? null
            }
          })
        )
      );
    }

    // Update match with result
    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        team1Score,
        team2Score,
        outcome: winner,
        status: MatchStatus.ONGOING, // Pending confirmation
        resultSubmittedById: submittedById,
        resultSubmittedAt: new Date(),
        resultComment: comment || null,
        resultEvidence: evidence || null
      },
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, image: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        },
        scores: true,
        pickleballScores: true
      }
    });

    // NOTE: NO rating calculation for friendly matches
    // NOTE: NO standings update for friendly matches

    return updatedMatch;
  }

  /**
   * Confirm friendly match result
   */
  async confirmFriendlyResult(input: ConfirmFriendlyResultInput) {
    const { matchId, userId, confirmed, disputeReason } = input;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true
      }
    }) as any;

    if (!match || !match.isFriendly) {
      throw new Error('Friendly match not found');
    }

    if (match.status !== MatchStatus.ONGOING) {
      throw new Error('Match result has not been submitted yet');
    }

    // Verify user is a participant (but not the submitter)
    const userParticipant = (match.participants || []).find(
      (p: any) => p.userId === userId && p.invitationStatus === InvitationStatus.ACCEPTED
    );

    if (!userParticipant) {
      throw new Error('You must be a participant to confirm results');
    }

    if (match.resultSubmittedById === userId) {
      throw new Error('You cannot confirm your own submitted result');
    }

    if (confirmed) {
      // Mark match as completed
      await prisma.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.COMPLETED,
          resultConfirmedById: userId,
          resultConfirmedAt: new Date()
        }
      });
    } else {
      // Create dispute (but don't affect ratings)
      await prisma.matchDispute.create({
        data: {
          matchId: match.id,
          raisedByUserId: userId,
          disputeCategory: 'OTHER',
          disputeComment: disputeReason || 'Result disputed',
          status: 'OPEN'
        }
      });

      // Reset match status
      await prisma.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.SCHEDULED,
          resultSubmittedById: null,
          resultSubmittedAt: null,
          resultComment: null,
          resultEvidence: null
        }
      });
    }

    return this.getFriendlyMatchById(matchId);
  }

  // Helper methods for score calculation
  private calculatePickleballFinalScore(gameScores: PickleballScore[]): {
    team1Score: number;
    team2Score: number;
    winner: string;
  } {
    let team1Wins = 0;
    let team2Wins = 0;

    gameScores.forEach(score => {
      if (score.team1Points > score.team2Points) {
        team1Wins++;
      } else if (score.team2Points > score.team1Points) {
        team2Wins++;
      }
    });

    const winner = team1Wins > team2Wins ? 'team1' : team2Wins > team1Wins ? 'team2' : 'tie';

    return {
      team1Score: team1Wins,
      team2Score: team2Wins,
      winner
    };
  }

  private calculateFinalScore(setScores: SetScore[]): {
    team1Score: number;
    team2Score: number;
    winner: string;
  } {
    let team1Sets = 0;
    let team2Sets = 0;

    setScores.forEach(score => {
      if (score.team1Games > score.team2Games) {
        team1Sets++;
      } else if (score.team2Games > score.team1Games) {
        team2Sets++;
      }
    });

    const winner = team1Sets > team2Sets ? 'team1' : team2Sets > team1Sets ? 'team2' : 'tie';

    return {
      team1Score: team1Sets,
      team2Score: team2Sets,
      winner
    };
  }

  /**
   * Accept a friendly match request
   * This converts the request to a regular friendly match
   */
  async acceptFriendlyMatchRequest(matchId: string, userId: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true
      }
    }) as any;

    if (!match || !match.isFriendly || !match.isFriendlyRequest) {
      throw new Error('Friendly match request not found');
    }

    // Check if user is the recipient
    if (match.requestRecipientId !== userId) {
      throw new Error('You are not the recipient of this request');
    }

    // Check if already expired
    if (match.requestExpiresAt && new Date(match.requestExpiresAt) < new Date()) {
      throw new Error('This friendly match request has expired');
    }

    // Check if already declined
    if (match.requestStatus === InvitationStatus.DECLINED) {
      throw new Error('This friendly match request has been declined');
    }

    // Check if already accepted
    if (match.requestStatus === InvitationStatus.ACCEPTED) {
      return this.getFriendlyMatchById(matchId);
    }

    // Accept the request - convert to regular friendly match
    await prisma.match.update({
      where: { id: matchId },
      data: {
        isFriendlyRequest: false,
        requestStatus: InvitationStatus.ACCEPTED,
        requestExpiresAt: null
      } as any
    });

    return this.getFriendlyMatchById(matchId);
  }

  /**
   * Decline a friendly match request
   */
  async declineFriendlyMatchRequest(matchId: string, userId: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true
      }
    }) as any;

    if (!match) {
      throw new Error('Match not found');
    }

    if (!match.isFriendly) {
      throw new Error('This is not a friendly match');
    }

    if (!match.isFriendlyRequest) {
      throw new Error('This is not a friendly match request');
    }

    // Check if user is the recipient
    if (match.requestRecipientId !== userId) {
      throw new Error('You are not the recipient of this request');
    }

    // Check if already expired
    if (match.requestExpiresAt && new Date(match.requestExpiresAt) < new Date()) {
      throw new Error('This friendly match request has already expired');
    }

    // Check if already declined
    if (match.requestStatus === InvitationStatus.DECLINED) {
      return this.getFriendlyMatchById(matchId);
    }

    // Check if already accepted
    if (match.requestStatus === InvitationStatus.ACCEPTED) {
      throw new Error('This friendly match request has already been accepted');
    }

    // Decline the request
    await prisma.match.update({
      where: { id: matchId },
      data: {
        requestStatus: InvitationStatus.DECLINED
      } as any
    });

    return this.getFriendlyMatchById(matchId);
  }

  /**
   * Check and expire friendly match requests (background job)
   */
  async checkAndExpireFriendlyRequests() {
    const now = new Date();
    
    const expiredRequests = await prisma.match.findMany({
      where: {
        isFriendlyRequest: true,
        requestStatus: InvitationStatus.PENDING,
        requestExpiresAt: {
          lte: now
        }
      } as any
    });

    if (expiredRequests.length > 0) {
      await prisma.match.updateMany({
        where: {
          id: {
            in: expiredRequests.map(m => m.id)
          }
        },
        data: {
          requestStatus: InvitationStatus.EXPIRED
        } as any
      });

      logger.info(`Expired ${expiredRequests.length} friendly match requests`);
    }

    return expiredRequests.length;
  }
}

// Singleton instance
let friendlyMatchServiceInstance: FriendlyMatchService | null = null;

export function getFriendlyMatchService(): FriendlyMatchService {
  if (!friendlyMatchServiceInstance) {
    friendlyMatchServiceInstance = new FriendlyMatchService();
  }
  return friendlyMatchServiceInstance;
}
