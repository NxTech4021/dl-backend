/**
 * Match Invitation Service
 * Handles match creation, invitations, time slot proposals, and scheduling
 */

import { prisma } from '../../lib/prisma';
import {
  MatchType,
  MatchFormat,
  MatchStatus,
  InvitationStatus,
  ParticipantRole,
  TimeSlotStatus,
  CancellationReason
} from '@prisma/client';
import { logger } from '../../utils/logger';
import { NotificationService } from '../notificationService';

// Types
export interface CreateMatchInput {
  createdById: string;
  divisionId: string;
  matchType: MatchType;
  format?: MatchFormat;
  opponentId?: string;         // For direct challenge
  partnerId?: string;          // For doubles - creator's partner
  opponentPartnerId?: string;  // For doubles - opponent's partner
  proposedTimes?: Date[];
  location?: string;
  venue?: string;
  notes?: string;
  message?: string;            // Message to send with invitation
  expiresInHours?: number;     // How long until invitation expires (default 48)
}

export interface ProposeTimeSlotInput {
  matchId: string;
  proposedById: string;
  proposedTime: Date;
  location?: string;
  notes?: string;
}

export interface VoteTimeSlotInput {
  timeSlotId: string;
  userId: string;
}

export interface RespondToInvitationInput {
  invitationId: string;
  userId: string;
  accept: boolean;
  declineReason?: string;
}

export interface MatchFilters {
  divisionId?: string;
  seasonId?: string;
  status?: MatchStatus;
  matchType?: MatchType;
  userId?: string;           // Matches where user is participant
  excludeUserId?: string;    // Matches where user is NOT participant
  fromDate?: Date;
  toDate?: Date;
  hasOpenSlots?: boolean;    // For joinable matches
}

export class MatchInvitationService {
  private notificationService: NotificationService;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }

  /**
   * Create a new match with optional direct challenge
   */
  async createMatch(input: CreateMatchInput) {
    const {
      createdById,
      divisionId,
      matchType,
      format = MatchFormat.STANDARD,
      opponentId,
      partnerId,
      opponentPartnerId,
      proposedTimes,
      location,
      venue,
      notes,
      message,
      expiresInHours = 48
    } = input;

    // Validate division exists and get season/league info
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      include: { season: true, league: true }
    });

    if (!division) {
      throw new Error('Division not found');
    }

    // Validate creator is in this division
    const creatorMembership = await prisma.seasonMembership.findFirst({
      where: {
        userId: createdById,
        divisionId,
        status: 'ACTIVE'
      }
    });

    if (!creatorMembership) {
      throw new Error('You must be an active member of this division to create a match');
    }

    // For doubles, validate partner
    if (matchType === MatchType.DOUBLES && !partnerId) {
      throw new Error('Partner is required for doubles matches');
    }

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Create match with transaction
    const match = await prisma.$transaction(async (tx) => {
      // Create the match
      const matchData: any = {
        divisionId,
        seasonId: division.seasonId,
        leagueId: division.leagueId,
        sport: division.league?.sportType || 'PADEL',
        matchType,
        format,
        status: MatchStatus.SCHEDULED,
        createdById
      };
      if (location) matchData.location = location;
      if (venue) matchData.venue = venue;
      if (notes) matchData.notes = notes;
      if (proposedTimes) matchData.proposedTimes = proposedTimes.map(t => t.toISOString());

      const newMatch = await tx.match.create({ data: matchData });

      // Add creator as participant
      await tx.matchParticipant.create({
        data: {
          matchId: newMatch.id,
          userId: createdById,
          role: ParticipantRole.CREATOR,
          invitationStatus: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          team: matchType === MatchType.DOUBLES ? 'team1' : null
        }
      });

      // Add creator's partner for doubles
      if (matchType === MatchType.DOUBLES && partnerId) {
        await tx.matchParticipant.create({
          data: {
            matchId: newMatch.id,
            userId: partnerId,
            role: ParticipantRole.PARTNER,
            invitationStatus: InvitationStatus.PENDING,
            team: 'team1'
          }
        });

        // Create invitation for partner
        await tx.matchInvitation.create({
          data: {
            matchId: newMatch.id,
            inviterId: createdById,
            inviteeId: partnerId,
            status: InvitationStatus.PENDING,
            message: message || 'You have been invited to join a doubles match as partner',
            expiresAt
          }
        });
      }

      // Handle direct challenge to opponent
      if (opponentId) {
        // Validate opponent is in same division
        const opponentMembership = await tx.seasonMembership.findFirst({
          where: {
            userId: opponentId,
            divisionId,
            status: 'ACTIVE'
          }
        });

        if (!opponentMembership) {
          throw new Error('Opponent must be an active member of this division');
        }

        // Add opponent as participant
        await tx.matchParticipant.create({
          data: {
            matchId: newMatch.id,
            userId: opponentId,
            role: ParticipantRole.OPPONENT,
            invitationStatus: InvitationStatus.PENDING,
            team: matchType === MatchType.DOUBLES ? 'team2' : null
          }
        });

        // Create invitation for opponent
        await tx.matchInvitation.create({
          data: {
            matchId: newMatch.id,
            inviterId: createdById,
            inviteeId: opponentId,
            status: InvitationStatus.PENDING,
            message: message || 'You have been challenged to a match',
            expiresAt
          }
        });

        // For doubles, add opponent's partner
        if (matchType === MatchType.DOUBLES && opponentPartnerId) {
          await tx.matchParticipant.create({
            data: {
              matchId: newMatch.id,
              userId: opponentPartnerId,
              role: ParticipantRole.PARTNER,
              invitationStatus: InvitationStatus.PENDING,
              team: 'team2'
            }
          });

          await tx.matchInvitation.create({
            data: {
              matchId: newMatch.id,
              inviterId: createdById,
              inviteeId: opponentPartnerId,
              status: InvitationStatus.PENDING,
              message: message || 'You have been invited to join a doubles match',
              expiresAt
            }
          });
        }
      }

      // Create time slots from proposed times
      if (proposedTimes && proposedTimes.length > 0) {
        for (const time of proposedTimes) {
          const timeSlotData: any = {
            matchId: newMatch.id,
            proposedById: createdById,
            proposedTime: time,
            status: TimeSlotStatus.PROPOSED,
            votes: [createdById],
            voteCount: 1
          };
          if (location) timeSlotData.location = location;
          await tx.matchTimeSlot.create({ data: timeSlotData });
        }
      }

      return newMatch;
    });

    // Send notifications (outside transaction)
    await this.sendMatchInvitationNotifications(match.id);

    logger.info(`Match created: ${match.id} by user ${createdById}`);

    return this.getMatchById(match.id);
  }

  /**
   * Get match by ID with full details
   */
  async getMatchById(matchId: string) {
    return prisma.match.findUnique({
      where: { id: matchId },
      include: {
        division: {
          include: { season: true, league: true }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                image: true
              }
            }
          }
        },
        invitations: {
          include: {
            inviter: {
              select: { id: true, name: true, username: true }
            },
            invitee: {
              select: { id: true, name: true, username: true }
            }
          }
        },
        timeSlots: {
          include: {
            proposedBy: {
              select: { id: true, name: true, username: true }
            }
          },
          orderBy: { proposedTime: 'asc' }
        },
        createdBy: {
          select: { id: true, name: true, username: true, image: true }
        },
        stats: true,
        scores: { orderBy: { setNumber: 'asc' } }
      }
    });
  }

  /**
   * Get matches with filters
   */
  async getMatches(filters: MatchFilters, page = 1, limit = 20) {
    const where: any = {};

    if (filters.divisionId) where.divisionId = filters.divisionId;
    if (filters.seasonId) where.seasonId = filters.seasonId;
    if (filters.status) where.status = filters.status;
    if (filters.matchType) where.matchType = filters.matchType;

    if (filters.userId) {
      where.participants = {
        some: { userId: filters.userId }
      };
    }

    if (filters.excludeUserId) {
      where.participants = {
        none: { userId: filters.excludeUserId }
      };
    }

    if (filters.fromDate || filters.toDate) {
      where.scheduledTime = {};
      if (filters.fromDate) where.scheduledTime.gte = filters.fromDate;
      if (filters.toDate) where.scheduledTime.lte = filters.toDate;
    }

    // For joinable matches (open slots)
    if (filters.hasOpenSlots) {
      where.status = MatchStatus.SCHEDULED;
      where.participants = {
        some: {
          invitationStatus: InvitationStatus.PENDING
        }
      };
    }

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        include: {
          division: true,
          participants: {
            include: {
              user: {
                select: { id: true, name: true, username: true, image: true }
              }
            }
          },
          timeSlots: {
            where: { status: TimeSlotStatus.CONFIRMED },
            take: 1
          },
          createdBy: {
            select: { id: true, name: true, username: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.match.count({ where })
    ]);

    return {
      matches,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get available matches to join in a division
   */
  async getAvailableMatches(userId: string, divisionId: string) {
    return prisma.match.findMany({
      where: {
        divisionId,
        status: MatchStatus.SCHEDULED,
        // Match has open slots (pending invitations or needs opponent)
        OR: [
          {
            // Matches created but no opponent yet
            participants: {
              none: {
                role: ParticipantRole.OPPONENT
              }
            }
          },
          {
            // Matches with pending invitations (opponent hasn't accepted)
            participants: {
              some: {
                role: ParticipantRole.OPPONENT,
                invitationStatus: InvitationStatus.PENDING
              }
            }
          }
        ],
        // User is not already a participant
        participants: {
          none: { userId }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true }
            }
          }
        },
        timeSlots: {
          orderBy: { proposedTime: 'asc' }
        },
        createdBy: {
          select: { id: true, name: true, username: true, image: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Respond to match invitation (accept/decline)
   */
  async respondToInvitation(input: RespondToInvitationInput) {
    const { invitationId, userId, accept, declineReason } = input;

    const invitation = await prisma.matchInvitation.findUnique({
      where: { id: invitationId },
      include: { match: { include: { participants: true } } }
    });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.inviteeId !== userId) {
      throw new Error('You are not authorized to respond to this invitation');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new Error('This invitation has already been responded to');
    }

    if (invitation.expiresAt < new Date()) {
      throw new Error('This invitation has expired');
    }

    const newStatus = accept ? InvitationStatus.ACCEPTED : InvitationStatus.DECLINED;

    await prisma.$transaction(async (tx) => {
      // Update invitation
      const updateData: any = {
        status: newStatus,
        respondedAt: new Date()
      };
      if (!accept && declineReason) updateData.declineReason = declineReason;

      await tx.matchInvitation.update({
        where: { id: invitationId },
        data: updateData
      });

      // Update participant
      await tx.matchParticipant.updateMany({
        where: {
          matchId: invitation.matchId,
          userId
        },
        data: {
          invitationStatus: newStatus,
          acceptedAt: accept ? new Date() : null
        }
      });

      // Check if all invitations are responded
      if (accept) {
        await this.checkMatchReadyToSchedule(tx, invitation.matchId);
      }
    });

    // Send notification
    await this.sendInvitationResponseNotification(invitation.matchId, userId, accept);

    logger.info(`Invitation ${invitationId} ${accept ? 'accepted' : 'declined'} by user ${userId}`);

    return this.getMatchById(invitation.matchId);
  }

  /**
   * Join an available match
   */
  async joinMatch(matchId: string, userId: string, asPartner = false) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true,
        division: true
      }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.status !== MatchStatus.SCHEDULED) {
      throw new Error('This match is no longer available to join');
    }

    // Check user is in the division
    const membership = await prisma.seasonMembership.findFirst({
      where: {
        userId,
        divisionId: match.divisionId!,
        status: 'ACTIVE'
      }
    });

    if (!membership) {
      throw new Error('You must be an active member of this division to join');
    }

    // Check user is not already in the match
    const existingParticipant = match.participants.find(p => p.userId === userId);
    if (existingParticipant) {
      throw new Error('You are already a participant in this match');
    }

    // Determine role and team
    let role: ParticipantRole = ParticipantRole.OPPONENT;
    let team: string | null = null;

    if (match.matchType === MatchType.DOUBLES) {
      // Find which team needs players
      const team1Count = match.participants.filter(p => p.team === 'team1').length;
      const team2Count = match.participants.filter(p => p.team === 'team2').length;

      if (asPartner && team1Count < 2) {
        team = 'team1';
        role = ParticipantRole.PARTNER;
      } else if (team2Count < 2) {
        team = 'team2';
        role = team2Count === 0 ? ParticipantRole.OPPONENT : ParticipantRole.PARTNER;
      } else {
        throw new Error('This match is already full');
      }
    }

    await prisma.$transaction(async (tx) => {
      // Add as participant
      await tx.matchParticipant.create({
        data: {
          matchId,
          userId,
          role,
          team,
          invitationStatus: InvitationStatus.ACCEPTED,
          acceptedAt: new Date()
        }
      });

      // Check if match is ready
      await this.checkMatchReadyToSchedule(tx, matchId);
    });

    logger.info(`User ${userId} joined match ${matchId}`);

    return this.getMatchById(matchId);
  }

  /**
   * Propose a time slot for a match
   */
  async proposeTimeSlot(input: ProposeTimeSlotInput) {
    const { matchId, proposedById, proposedTime, location, notes } = input;

    // Verify user is participant
    const participant = await prisma.matchParticipant.findUnique({
      where: {
        matchId_userId: { matchId, userId: proposedById }
      }
    });

    if (!participant) {
      throw new Error('You must be a participant to propose time slots');
    }

    const timeSlotData: any = {
      matchId,
      proposedById,
      proposedTime,
      status: TimeSlotStatus.PROPOSED,
      votes: [proposedById],
      voteCount: 1
    };
    if (location) timeSlotData.location = location;
    if (notes) timeSlotData.notes = notes;

    const timeSlot = await prisma.matchTimeSlot.create({
      data: timeSlotData,
      include: {
        proposedBy: {
          select: { id: true, name: true, username: true }
        }
      }
    });

    logger.info(`Time slot proposed for match ${matchId} by user ${proposedById}`);

    return timeSlot;
  }

  /**
   * Vote for a time slot
   */
  async voteForTimeSlot(input: VoteTimeSlotInput) {
    const { timeSlotId, userId } = input;

    const timeSlot = await prisma.matchTimeSlot.findUnique({
      where: { id: timeSlotId },
      include: { match: { include: { participants: true } } }
    });

    if (!timeSlot) {
      throw new Error('Time slot not found');
    }

    // Verify user is participant
    const isParticipant = timeSlot.match.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      throw new Error('You must be a participant to vote');
    }

    // Check if already voted
    const votes = (timeSlot.votes as string[]) || [];
    if (votes.includes(userId)) {
      throw new Error('You have already voted for this time slot');
    }

    // Add vote
    const newVotes = [...votes, userId];
    const updatedSlot = await prisma.matchTimeSlot.update({
      where: { id: timeSlotId },
      data: {
        votes: newVotes,
        voteCount: newVotes.length
      }
    });

    // Check if all participants have voted
    const acceptedParticipants = timeSlot.match.participants.filter(
      p => p.invitationStatus === InvitationStatus.ACCEPTED
    );

    if (newVotes.length === acceptedParticipants.length) {
      // Auto-confirm if unanimous
      await this.confirmTimeSlot(timeSlotId);
    }

    logger.info(`User ${userId} voted for time slot ${timeSlotId}`);

    return updatedSlot;
  }

  /**
   * Confirm a time slot
   */
  async confirmTimeSlot(timeSlotId: string) {
    const timeSlot = await prisma.matchTimeSlot.findUnique({
      where: { id: timeSlotId }
    });

    if (!timeSlot) {
      throw new Error('Time slot not found');
    }

    await prisma.$transaction(async (tx) => {
      // Mark this slot as confirmed
      await tx.matchTimeSlot.update({
        where: { id: timeSlotId },
        data: {
          status: TimeSlotStatus.CONFIRMED,
          confirmedAt: new Date()
        }
      });

      // Reject other slots for this match
      await tx.matchTimeSlot.updateMany({
        where: {
          matchId: timeSlot.matchId,
          id: { not: timeSlotId }
        },
        data: { status: TimeSlotStatus.REJECTED }
      });

      // Update match with confirmed time
      await tx.match.update({
        where: { id: timeSlot.matchId },
        data: {
          scheduledTime: timeSlot.proposedTime,
          scheduledStartTime: timeSlot.proposedTime,
          location: timeSlot.location
        }
      });
    });

    // Send notifications
    await this.sendTimeConfirmedNotification(timeSlot.matchId);

    logger.info(`Time slot ${timeSlotId} confirmed for match ${timeSlot.matchId}`);

    return this.getMatchById(timeSlot.matchId);
  }

  /**
   * Check if match is ready to be scheduled (all participants accepted)
   */
  private async checkMatchReadyToSchedule(tx: any, matchId: string) {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      include: { participants: true }
    });

    if (!match) return;

    const requiredParticipants = match.matchType === MatchType.DOUBLES ? 4 : 2;
    const acceptedCount = match.participants.filter(
      (p: any) => p.invitationStatus === InvitationStatus.ACCEPTED
    ).length;

    if (acceptedCount >= requiredParticipants) {
      // All participants accepted - match is ready
      logger.info(`Match ${matchId} has all participants - ready to schedule`);
      // Could trigger notification here
    }
  }

  /**
   * Send notifications for match invitations
   */
  private async sendMatchInvitationNotifications(matchId: string) {
    try {
      const invitations = await prisma.matchInvitation.findMany({
        where: { matchId },
        include: {
          inviter: { select: { name: true } },
          match: { include: { division: true } }
        }
      });

      for (const invitation of invitations) {
        await this.notificationService.createNotification({
          type: 'MATCH_INVITATION',
          title: 'Match Invitation',
          message: `${invitation.inviter.name} has invited you to a match in ${invitation.match.division?.name}`,
          category: 'MATCH',
          matchId,
          userIds: [invitation.inviteeId]
        });
      }
    } catch (error) {
      logger.error('Error sending match invitation notifications', {}, error as Error);
    }
  }

  /**
   * Send notification when invitation is responded to
   */
  private async sendInvitationResponseNotification(matchId: string, userId: string, accepted: boolean) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          createdBy: { select: { id: true, name: true } },
          participants: { select: { userId: true } }
        }
      });

      if (!match) return;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      });

      // Notify other participants
      const otherParticipants = match.participants
        .filter(p => p.userId !== userId)
        .map(p => p.userId);

      await this.notificationService.createNotification({
        type: accepted ? 'MATCH_INVITATION_ACCEPTED' : 'MATCH_INVITATION_DECLINED',
        title: accepted ? 'Invitation Accepted' : 'Invitation Declined',
        message: `${user?.name} has ${accepted ? 'accepted' : 'declined'} the match invitation`,
        category: 'MATCH',
        matchId,
        userIds: otherParticipants
      });
    } catch (error) {
      logger.error('Error sending invitation response notification', {}, error as Error);
    }
  }

  /**
   * Send notification when time is confirmed
   */
  private async sendTimeConfirmedNotification(matchId: string) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          participants: { select: { userId: true } },
          timeSlots: {
            where: { status: TimeSlotStatus.CONFIRMED },
            take: 1
          }
        }
      });

      if (!match || !match.timeSlots[0]) return;

      const confirmedTime = match.timeSlots[0].proposedTime;
      const participantIds = match.participants.map(p => p.userId);

      await this.notificationService.createNotification({
        type: 'MATCH_TIME_CONFIRMED',
        title: 'Match Time Confirmed',
        message: `Your match has been scheduled for ${confirmedTime.toLocaleString()}`,
        category: 'MATCH',
        matchId,
        userIds: participantIds
      });
    } catch (error) {
      logger.error('Error sending time confirmed notification', {}, error as Error);
    }
  }
}

// Export singleton instance
let matchInvitationService: MatchInvitationService | null = null;

export function getMatchInvitationService(notificationService?: NotificationService): MatchInvitationService {
  if (!matchInvitationService) {
    matchInvitationService = new MatchInvitationService(notificationService);
  }
  return matchInvitationService;
}
