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
  CancellationReason,
  MembershipStatus,
  JoinRequestStatus
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
  duration?: number;           // Match duration in hours
  courtBooked?: boolean;       // Whether court has been booked
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
  format?: MatchFormat;      // STANDARD or ONE_SET
  venue?: string;            // Filter by specific venue
  location?: string;         // Filter by general location
  userId?: string;           // Matches where user is participant
  excludeUserId?: string;    // Matches where user is NOT participant
  fromDate?: Date;
  toDate?: Date;
  hasOpenSlots?: boolean;    // For joinable matches
  friendsOnly?: boolean;     // Show matches created by friends only
  favoritesOnly?: boolean;   // Show matches created by favorites only
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
      duration,
      courtBooked,
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

    // Check for scheduling conflicts for creator and partner
    if (proposedTimes && proposedTimes.length > 0) {
      const firstProposedTime = proposedTimes[0];
      if (firstProposedTime) {
        const conflictCheck = await this.checkSchedulingConflicts(
          createdById, 
          partnerId, 
          firstProposedTime,
          divisionId
        );
        
        if (conflictCheck.hasConflict) {
          throw new Error(conflictCheck.message || 'Scheduling conflict detected');
        }
      }
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
      if (duration !== undefined) matchData.duration = duration;
      if (courtBooked !== undefined) matchData.courtBooked = courtBooked;
      
      // Set scheduledStartTime from the first proposed time
      if (proposedTimes && proposedTimes.length > 0) {
        const firstProposedTime = proposedTimes[0];
        if (firstProposedTime) {
          // Store the date as-is (already in UTC from frontend)
          matchData.scheduledStartTime = firstProposedTime;
          matchData.scheduledTime = firstProposedTime; // For backward compatibility
          matchData.proposedTimes = proposedTimes.map(t => t.toISOString());

          // Log for verification (displays in Malaysia time)
          const malaysiaTime = new Date(firstProposedTime).toLocaleString('en-MY', {
            timeZone: 'Asia/Kuala_Lumpur',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          console.log('✅ Match time stored:', {
            utc: firstProposedTime.toISOString(),
            malaysiaTime: malaysiaTime,
            note: 'UTC time is stored, displays as Malaysia Time'
          });
        }
      }

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

      // Add creator's partner for doubles (send invitation, not auto-accept)
      if (matchType === MatchType.DOUBLES && partnerId) {
        await tx.matchParticipant.create({
          data: {
            matchId: newMatch.id,
            userId: partnerId,
            role: ParticipantRole.PARTNER,
            invitationStatus: InvitationStatus.PENDING, // Changed from ACCEPTED to PENDING
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
            message: message || 'Your partner has created a match and invited you to join',
            expiresAt
          }
        });

        // Send notification to partner
        // await NotificationService.sendNotification({
        //   userId: partnerId,
        //   type: 'MATCH_INVITATION',
        //   title: 'Match Invitation',
        //   message: `Your partner has invited you to join a ${matchType.toLowerCase()} match`,
        //   data: {
        //     matchId: newMatch.id,
        //     inviterId: createdById
        //   }
        // });
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
    if (filters.format) where.format = filters.format;
    if (filters.venue) where.venue = { contains: filters.venue, mode: 'insensitive' };
    if (filters.location) where.location = { contains: filters.location, mode: 'insensitive' };

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

    // Friends/Favorites filtering - requires userId to be set
    if ((filters.friendsOnly || filters.favoritesOnly) && filters.userId) {
      const creatorIds: string[] = [];

      if (filters.friendsOnly) {
        // Get accepted friendships (both directions)
        const friendships = await prisma.friendship.findMany({
          where: {
            OR: [
              { requesterId: filters.userId, status: 'ACCEPTED' },
              { recipientId: filters.userId, status: 'ACCEPTED' }
            ]
          },
          select: { requesterId: true, recipientId: true }
        });

        const friendIds = friendships.map(f =>
          f.requesterId === filters.userId ? f.recipientId : f.requesterId
        );
        creatorIds.push(...friendIds);
      }

      if (filters.favoritesOnly) {
        // Get users that the current user has favorited
        const favorites = await prisma.favorite.findMany({
          where: { userId: filters.userId },
          select: { favoritedId: true }
        });

        const favoriteIds = favorites.map(f => f.favoritedId);
        creatorIds.push(...favoriteIds);
      }

      // Remove duplicates if both filters are active
      const uniqueCreatorIds = Array.from(new Set(creatorIds));

      if (uniqueCreatorIds.length > 0) {
        where.createdById = { in: uniqueCreatorIds };
      } else {
        // If no friends/favorites found, return empty results
        where.createdById = 'no-matches';
      }
    }

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        include: {
          division: {
            include: {
              league: true,
              season: true
            }
          },
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
   * Get available matches to join in a division with optional filters and pagination
   */
  async getAvailableMatches(
    userId: string,
    divisionId: string,
    additionalFilters?: Partial<Pick<MatchFilters, 'format' | 'venue' | 'location' | 'fromDate' | 'toDate' | 'friendsOnly' | 'favoritesOnly'>>,
    page = 1,
    limit = 20
  ) {
    const where: any = {
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
    };

    // Apply additional filters if provided
    if (additionalFilters) {
      if (additionalFilters.format) where.format = additionalFilters.format;
      if (additionalFilters.venue) where.venue = additionalFilters.venue;
      if (additionalFilters.location) {
        where.location = { contains: additionalFilters.location, mode: 'insensitive' };
      }

      // Date range filtering on scheduledTime
      if (additionalFilters.fromDate || additionalFilters.toDate) {
        where.AND = where.AND || [];
        where.AND.push({
          scheduledTime: {
            ...(additionalFilters.fromDate && { gte: additionalFilters.fromDate }),
            ...(additionalFilters.toDate && { lte: additionalFilters.toDate })
          }
        });
      }

      // Friends/Favorites filtering
      if (additionalFilters.friendsOnly || additionalFilters.favoritesOnly) {
        const creatorIds: string[] = [];

        if (additionalFilters.friendsOnly) {
          const friendships = await prisma.friendship.findMany({
            where: {
              OR: [
                { requesterId: userId, status: 'ACCEPTED' },
                { recipientId: userId, status: 'ACCEPTED' }
              ]
            },
            select: { requesterId: true, recipientId: true }
          });

          const friendIds = friendships.map(f =>
            f.requesterId === userId ? f.recipientId : f.requesterId
          );
          creatorIds.push(...friendIds);
        }

        if (additionalFilters.favoritesOnly) {
          const favorites = await prisma.favorite.findMany({
            where: { userId },
            select: { favoritedId: true }
          });

          const favoriteIds = favorites.map(f => f.favoritedId);
          creatorIds.push(...favoriteIds);
        }

        const uniqueCreatorIds = [...new Set(creatorIds)];

        if (uniqueCreatorIds.length > 0) {
          where.createdById = { in: uniqueCreatorIds };
        } else {
          // If no friends/favorites found, return empty results
          where.createdById = 'no-matches';
        }
      }
    }

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
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
          },
          division: {
            select: { id: true, name: true }
          }
        },
        orderBy: [
          { scheduledTime: 'asc' },
          { createdAt: 'desc' }
        ],
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
   * Respond to match invitation (accept/decline)
   */
  async respondToInvitation(input: RespondToInvitationInput) {
    const { invitationId, userId, accept, declineReason } = input;

    const invitation = await prisma.matchInvitation.findUnique({
      where: { id: invitationId },
      include: {
        match: {
          include: {
            participants: true,
            timeSlots: {
              where: { status: TimeSlotStatus.CONFIRMED }
            }
          }
        }
      }
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

    // Check for time conflicts if accepting
    if (accept) {
      const matchTime = invitation.match.scheduledTime || invitation.match.timeSlots[0]?.proposedTime;

      if (matchTime) {
        const conflictCheck = await this.checkTimeConflict(userId, matchTime, invitation.matchId);

        if (conflictCheck.hasConflict) {
          throw new Error(
            `You have a scheduling conflict. You already have a match scheduled in ${conflictCheck.conflictingMatch?.division} around this time.`
          );
        }
      }
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

    // Get match details with partner status
    const match = await this.getMatchById(invitation.matchId);

    // Add partner confirmation status for doubles
    let partnerStatus = null;
    if (match?.matchType === MatchType.DOUBLES) {
      partnerStatus = this.getPartnerConfirmationStatus(match);
    }

    return {
      ...match,
      partnerStatus
    };
  }

  /**
   * Join an available match
   */
  async joinMatch(matchId: string, userId: string, asPartner = false, partnerId?: string) {
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

    // For doubles with partnerId, check partner is not already in the match
    if (partnerId && match.matchType === MatchType.DOUBLES) {
      // Verify both players are assigned to the same division
      const userDivisionAssignment = await prisma.divisionAssignment.findUnique({
        where: {
          divisionId_userId: {
            divisionId: match.divisionId!,
            userId: userId
          }
        }
      });

      const partnerDivisionAssignment = await prisma.divisionAssignment.findUnique({
        where: {
          divisionId_userId: {
            divisionId: match.divisionId!,
            userId: partnerId
          }
        }
      });

      if (!userDivisionAssignment || !partnerDivisionAssignment) {
        throw new Error('Both you and your partner must be assigned to this division');
      }

      // Verify the user is in an active partnership with the provided partnerId
      const partnership = await prisma.partnership.findFirst({
        where: {
          OR: [
            { captainId: userId, partnerId: partnerId },
            { captainId: partnerId, partnerId: userId }
          ],
          status: 'ACTIVE'
        }
      });

      if (!partnership) {
        throw new Error('You must be in an active partnership with this player');
      }

      const existingPartner = match.participants.find(p => p.userId === partnerId);
      if (existingPartner) {
        throw new Error('Your partner is already in this match');
      }

      // Check partner membership
      const partnerMembership = await prisma.seasonMembership.findFirst({
        where: {
          userId: partnerId,
          divisionId: match.divisionId!,
          status: 'ACTIVE'
        }
      });

      if (!partnerMembership) {
        throw new Error('Your partner must be an active member of this division');
      }
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

      // If joining with a partner, check if team has space for both
      if (partnerId) {
        const targetTeamCount = team === 'team1' ? team1Count : team2Count;
        if (targetTeamCount > 0) {
          throw new Error('Not enough space on the team for both you and your partner');
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      // Add user as participant
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

      // For doubles matches, add partner with PENDING status and create invitation
      if (partnerId && match.matchType === MatchType.DOUBLES && team) {
        // Add partner as PENDING participant
        await tx.matchParticipant.create({
          data: {
            matchId,
            userId: partnerId,
            role: ParticipantRole.PARTNER,
            team,
            invitationStatus: InvitationStatus.PENDING
          }
        });

        // Create invitation for partner
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 72);

        await tx.matchInvitation.create({
          data: {
            matchId,
            inviterId: userId,
            inviteeId: partnerId,
            status: InvitationStatus.PENDING,
            expiresAt,
            message: 'Your partner has joined this match and invited you to join as well.'
          }
        });

        logger.info(`Partner ${partnerId} invited to match ${matchId} on ${team}`);
      }

      // Check if match is ready
      await this.checkMatchReadyToSchedule(tx, matchId);
    });

    // Send notification to match creator and other participants
    await this.sendMatchJoinedNotification(matchId, userId);
    
    // Send invitation notification for partner if they were invited
    if (partnerId && match.matchType === MatchType.DOUBLES) {
      await this.notificationService.createNotification({
        userIds: [partnerId],
        type: 'MATCH_INVITATION',
        category: 'MATCH',
        title: 'Match Invitation from Partner',
        message: 'Your partner has joined a match and invited you to join.',
        matchId
      });
    }

    logger.info(`User ${userId} joined match ${matchId}${partnerId ? ` with partner ${partnerId}` : ''}`);

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

  /**
   * Check and expire old match invitations
   * Moves matches with expired invitations to DRAFT status
   */
  async checkExpiredInvitations() {
    try {
      const now = new Date();

      // Find all pending invitations that have expired
      const expiredInvitations = await prisma.matchInvitation.findMany({
        where: {
          status: InvitationStatus.PENDING,
          expiresAt: { lt: now }
        },
        include: {
          match: {
            include: {
              participants: true,
              invitations: true
            }
          }
        }
      });

      const matchesAffected = new Set<string>();
      let invitationsExpired = 0;

      // Update all expired invitations
      for (const invitation of expiredInvitations) {
        await prisma.matchInvitation.update({
          where: { id: invitation.id },
          data: {
            status: InvitationStatus.EXPIRED,
            respondedAt: now
          }
        });

        // Update corresponding participant
        await prisma.matchParticipant.updateMany({
          where: {
            matchId: invitation.matchId,
            userId: invitation.inviteeId
          },
          data: {
            invitationStatus: InvitationStatus.EXPIRED
          }
        });

        matchesAffected.add(invitation.matchId);
        invitationsExpired++;
      }

      // For each affected match, check if it should move to DRAFT
      let matchesMovedToDraft = 0;
      for (const matchId of matchesAffected) {
        const match = await prisma.match.findUnique({
          where: { id: matchId },
          include: {
            participants: true,
            invitations: true,
            createdBy: { select: { id: true, name: true } }
          }
        });

        if (!match || match.status !== MatchStatus.SCHEDULED) continue;

        // Check if all invitations are either expired or declined
        const allInvitationsResolved = match.invitations.every(
          inv => inv.status === InvitationStatus.EXPIRED ||
                 inv.status === InvitationStatus.DECLINED ||
                 inv.status === InvitationStatus.CANCELLED
        );

        // Check if any invitations were expired or declined
        const hasExpiredOrDeclined = match.invitations.some(
          inv => inv.status === InvitationStatus.EXPIRED ||
                 inv.status === InvitationStatus.DECLINED
        );

        if (hasExpiredOrDeclined && allInvitationsResolved) {
          // Move match to DRAFT status
          await prisma.match.update({
            where: { id: matchId },
            data: { status: MatchStatus.DRAFT }
          });

          // Notify creator
          if (match.createdById) {
            await this.notificationService.createNotification({
              type: 'MATCH_INVITATION_EXPIRED',
              title: 'Match Invitation Expired',
              message: 'Your match invitation has expired. You can edit and resend it from your drafts.',
              category: 'MATCH',
              matchId,
              userIds: [match.createdById]
            });
          }

          matchesMovedToDraft++;
        }
      }

      logger.info(`Expired invitations check complete: ${invitationsExpired} invitations expired, ${matchesMovedToDraft} matches moved to DRAFT`);

      return {
        invitationsExpired,
        matchesMovedToDraft,
        matchesAffected: matchesAffected.size
      };
    } catch (error) {
      logger.error('Error checking expired invitations', {}, error as Error);
      throw error;
    }
  }

  /**
   * Handle matches where all invitations have been declined
   * Moves them to DRAFT status for editing
   */
  async handleFullyDeclinedMatches() {
    try {
      // Find matches where ALL invitations are declined
      const matches = await prisma.match.findMany({
        where: {
          status: MatchStatus.SCHEDULED
        },
        include: {
          invitations: true,
          createdBy: { select: { id: true, name: true } }
        }
      });

      let matchesMovedToDraft = 0;

      for (const match of matches) {
        // Skip if no invitations
        if (match.invitations.length === 0) continue;

        // Check if ALL invitations are declined
        const allDeclined = match.invitations.every(
          inv => inv.status === InvitationStatus.DECLINED
        );

        if (allDeclined) {
          // Move to DRAFT
          await prisma.match.update({
            where: { id: match.id },
            data: { status: MatchStatus.DRAFT }
          });

          // Notify creator
          if (match.createdById) {
            await this.notificationService.createNotification({
              type: 'MATCH_ALL_DECLINED',
              title: 'Match Invitations Declined',
              message: 'All players have declined your match invitation. You can edit and resend it from your drafts.',
              category: 'MATCH',
              matchId: match.id,
              userIds: [match.createdById]
            });
          }

          matchesMovedToDraft++;
        }
      }

      logger.info(`Fully declined matches check complete: ${matchesMovedToDraft} matches moved to DRAFT`);

      return { matchesMovedToDraft };
    } catch (error) {
      logger.error('Error handling fully declined matches', {}, error as Error);
      throw error;
    }
  }

  /**
   * Edit a match (only allowed for DRAFT status matches)
   */
  async editMatch(matchId: string, userId: string, updates: Partial<CreateMatchInput>) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: true,
        invitations: true,
        timeSlots: true
      }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.createdById !== userId) {
      throw new Error('Only the match creator can edit this match');
    }

    if (match.status !== MatchStatus.DRAFT) {
      throw new Error('Only matches in DRAFT status can be edited');
    }

    const {
      matchType,
      format,
      opponentId,
      partnerId,
      opponentPartnerId,
      proposedTimes,
      location,
      venue,
      notes,
      message,
      expiresInHours = 48
    } = updates;

    // Calculate new expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    await prisma.$transaction(async (tx) => {
      // Update match basic info
      const updateData: any = {};
      if (matchType) updateData.matchType = matchType;
      if (format) updateData.format = format;
      if (location !== undefined) updateData.location = location;
      if (venue !== undefined) updateData.venue = venue;
      if (notes !== undefined) updateData.notes = notes;
      updateData.status = MatchStatus.SCHEDULED; // Move back to SCHEDULED

      await tx.match.update({
        where: { id: matchId },
        data: updateData
      });

      // Delete old participants (except creator)
      await tx.matchParticipant.deleteMany({
        where: {
          matchId,
          userId: { not: userId }
        }
      });

      // Delete old invitations
      await tx.matchInvitation.deleteMany({
        where: { matchId }
      });

      // Delete old time slots
      await tx.matchTimeSlot.deleteMany({
        where: { matchId }
      });

      // Add new participants and invitations (similar to createMatch logic)

      // For doubles, add partner
      if (matchType === MatchType.DOUBLES && partnerId) {
        await tx.matchParticipant.create({
          data: {
            matchId,
            userId: partnerId,
            role: ParticipantRole.PARTNER,
            invitationStatus: InvitationStatus.PENDING,
            team: 'team1'
          }
        });

        await tx.matchInvitation.create({
          data: {
            matchId,
            inviterId: userId,
            inviteeId: partnerId,
            status: InvitationStatus.PENDING,
            message: message || 'You have been invited to join a doubles match as partner',
            expiresAt
          }
        });
      }

      // Add opponent
      if (opponentId) {
        await tx.matchParticipant.create({
          data: {
            matchId,
            userId: opponentId,
            role: ParticipantRole.OPPONENT,
            invitationStatus: InvitationStatus.PENDING,
            team: matchType === MatchType.DOUBLES ? 'team2' : null
          }
        });

        await tx.matchInvitation.create({
          data: {
            matchId,
            inviterId: userId,
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
              matchId,
              userId: opponentPartnerId,
              role: ParticipantRole.PARTNER,
              invitationStatus: InvitationStatus.PENDING,
              team: 'team2'
            }
          });

          await tx.matchInvitation.create({
            data: {
              matchId,
              inviterId: userId,
              inviteeId: opponentPartnerId,
              status: InvitationStatus.PENDING,
              message: message || 'You have been invited to join a doubles match',
              expiresAt
            }
          });
        }
      }

      // Create new time slots
      if (proposedTimes && proposedTimes.length > 0) {
        for (const time of proposedTimes) {
          const timeSlotData: any = {
            matchId,
            proposedById: userId,
            proposedTime: time,
            status: TimeSlotStatus.PROPOSED,
            votes: [userId],
            voteCount: 1
          };
          if (location) timeSlotData.location = location;
          await tx.matchTimeSlot.create({ data: timeSlotData });
        }
      }
    });

    // Send new invitations
    await this.sendMatchInvitationNotifications(matchId);

    logger.info(`Match ${matchId} edited and resent by user ${userId}`);

    return this.getMatchById(matchId);
  }

  /**
   * Send notification when someone joins a match
   */
  private async sendMatchJoinedNotification(matchId: string, joinedUserId: string) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          createdBy: { select: { id: true, name: true } },
          participants: {
            select: { userId: true },
            where: { userId: { not: joinedUserId } }
          },
          division: { select: { name: true } }
        }
      });

      if (!match) return;

      const joiner = await prisma.user.findUnique({
        where: { id: joinedUserId },
        select: { name: true }
      });

      // Notify match creator and other participants
      const notifyUserIds = match.participants.map(p => p.userId);
      if (match.createdById && !notifyUserIds.includes(match.createdById)) {
        notifyUserIds.push(match.createdById);
      }

      if (notifyUserIds.length > 0) {
        await this.notificationService.createNotification({
          type: 'FRIENDLY_MATCH_PLAYER_JOINED',
          title: 'Player Joined Match',
          message: `${joiner?.name} has joined your match${match.division ? ` in ${match.division.name}` : ''}`,
          category: 'MATCH',
          matchId,
          userIds: notifyUserIds
        });
      }
    } catch (error) {
      logger.error('Error sending match joined notification', {}, error as Error);
    }
  }

  /**
   * Get players in a division who have not played with the current user
   * Used for "Create Match" feature to filter eligible opponents
   */
  async getPlayersNotPlayedWith(userId: string, divisionId: string) {
    try {
      // 1. Get all users in the division (via SeasonMembership which has status field)
      const divisionMembers = await prisma.seasonMembership.findMany({
        where: {
          divisionId,
          status: MembershipStatus.ACTIVE
        },
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
      });

      // 2. Get all matches where current user participated in this division
      const userMatches = await prisma.match.findMany({
        where: {
          divisionId,
          status: {
            in: [MatchStatus.COMPLETED, MatchStatus.ONGOING, MatchStatus.SCHEDULED]
          },
          participants: {
            some: { userId }
          }
        },
        include: {
          participants: true
        }
      });

      // 3. Extract opponent IDs
      const opponentIds = new Set<string>();
      userMatches.forEach(match => {
        match.participants.forEach(participant => {
          if (participant.userId !== userId) {
            opponentIds.add(participant.userId);
          }
        });
      });

      // 4. Filter out current user and players already played with
      const eligiblePlayers = divisionMembers
        .filter(member =>
          member.userId !== userId &&
          !opponentIds.has(member.userId)
        )
        .map(member => member.user);

      logger.info(`Found ${eligiblePlayers.length} eligible players for user ${userId} in division ${divisionId}`);

      return {
        eligiblePlayers,
        totalInDivision: divisionMembers.length - 1, // Exclude current user
        alreadyPlayedWith: opponentIds.size
      };
    } catch (error) {
      logger.error('Error getting players not played with', { userId, divisionId }, error as Error);
      throw error;
    }
  }

  /**
   * Get all join requests for a match
   */
  async getMatchJoinRequests(matchId: string, status?: JoinRequestStatus) {
    try {
      const where: any = { matchId };
      if (status) where.status = status;

      return await prisma.matchJoinRequest.findMany({
        where,
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true
            }
          },
          responder: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { requestedAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error getting match join requests', { matchId }, error as Error);
      throw error;
    }
  }

  /**
   * Check if user has time conflict with proposed match time
   */
  async checkTimeConflict(userId: string, proposedTime: Date, excludeMatchId?: string) {
    try {
      // Look for accepted matches with confirmed time slots within ±3 hours window
      const timeWindow = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
      const startWindow = new Date(proposedTime.getTime() - timeWindow);
      const endWindow = new Date(proposedTime.getTime() + timeWindow);

      // Build where clause dynamically to avoid undefined values
      const whereClause: any = {
        participants: {
          some: {
            userId,
            invitationStatus: InvitationStatus.ACCEPTED
          }
        },
        status: {
          in: [MatchStatus.SCHEDULED, MatchStatus.ONGOING]
        },
        OR: [
          {
            scheduledTime: {
              gte: startWindow,
              lte: endWindow
            }
          },
          {
            timeSlots: {
              some: {
                status: TimeSlotStatus.CONFIRMED,
                proposedTime: {
                  gte: startWindow,
                  lte: endWindow
                }
              }
            }
          }
        ]
      };

      if (excludeMatchId) {
        whereClause.id = { not: excludeMatchId };
      }

      const conflictingMatches = await prisma.match.findMany({
        where: whereClause,
        include: {
          division: { select: { name: true } },
          timeSlots: {
            where: { status: TimeSlotStatus.CONFIRMED },
            select: { proposedTime: true }
          }
        }
      });

      if (conflictingMatches.length > 0) {
        const conflict = conflictingMatches[0];
        if (conflict) {
          const conflictTime = conflict.scheduledTime || conflict.timeSlots?.[0]?.proposedTime;

          return {
            hasConflict: true,
            conflictingMatch: {
              id: conflict.id,
              division: conflict.division?.name,
              scheduledTime: conflictTime
            }
          };
        }
      }

      return { hasConflict: false };
    } catch (error) {
      logger.error('Error checking time conflict', { userId }, error as Error);
      throw error;
    }
  }

  /**
   * Get invitation by ID with full details
   */
  async getInvitationById(invitationId: string, userId?: string) {
    try {
      const invitation = await prisma.matchInvitation.findUnique({
        where: { id: invitationId },
        include: {
          match: {
            include: {
              division: { select: { id: true, name: true } },
              participants: {
                include: {
                  user: {
                    select: { id: true, name: true, username: true, image: true }
                  }
                }
              },
              timeSlots: {
                orderBy: { voteCount: 'desc' }
              },
              createdBy: {
                select: { id: true, name: true, username: true }
              }
            }
          },
          inviter: {
            select: { id: true, name: true, username: true, image: true }
          },
          invitee: {
            select: { id: true, name: true, username: true, image: true }
          }
        }
      });

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      // Verify authorization if userId provided
      if (userId && invitation.inviteeId !== userId && invitation.inviterId !== userId) {
        throw new Error('You are not authorized to view this invitation');
      }

      // Add partner confirmation status for doubles
      let partnerStatus = null;
      if (invitation.match.matchType === MatchType.DOUBLES) {
        partnerStatus = this.getPartnerConfirmationStatus(invitation.match);
      }

      return {
        ...invitation,
        partnerStatus
      };
    } catch (error) {
      logger.error('Error getting invitation by ID', { invitationId }, error as Error);
      throw error;
    }
  }

  /**
   * Get pending invitations for user
   */
  async getPendingInvitations(userId: string) {
    try {
      const invitations = await prisma.matchInvitation.findMany({
        where: {
          inviteeId: userId,
          status: InvitationStatus.PENDING,
          expiresAt: { gte: new Date() }
        },
        include: {
          match: {
            include: {
              division: { select: { id: true, name: true } },
              participants: {
                include: {
                  user: {
                    select: { id: true, name: true, username: true, image: true }
                  }
                }
              },
              timeSlots: {
                orderBy: { voteCount: 'desc' },
                take: 3
              }
            }
          },
          inviter: {
            select: { id: true, name: true, username: true, image: true }
          }
        },
        orderBy: { sentAt: 'desc' }
      });

      // Add partner status for doubles matches
      const invitationsWithStatus = invitations.map(inv => {
        let partnerStatus = null;
        if (inv.match.matchType === MatchType.DOUBLES) {
          partnerStatus = this.getPartnerConfirmationStatus(inv.match);
        }
        return {
          ...inv,
          partnerStatus
        };
      });

      return invitationsWithStatus;
    } catch (error) {
      logger.error('Error getting pending invitations', { userId }, error as Error);
      throw error;
    }
  }

  /**
   * Helper: Get partner confirmation status for doubles match
   */
  private getPartnerConfirmationStatus(match: any) {
    const participants = match.participants || [];

    const team1Participants = participants.filter((p: any) => p.team === 'team1');
    const team2Participants = participants.filter((p: any) => p.team === 'team2');

    return {
      team1: team1Participants.map((p: any) => ({
        userId: p.userId,
        name: p.user?.name,
        role: p.role,
        confirmed: p.invitationStatus === InvitationStatus.ACCEPTED,
        status: p.invitationStatus
      })),
      team2: team2Participants.map((p: any) => ({
        userId: p.userId,
        name: p.user?.name,
        role: p.role,
        confirmed: p.invitationStatus === InvitationStatus.ACCEPTED,
        status: p.invitationStatus
      }))
    };
  }

  /**
   * Check for scheduling conflicts for users at a specific time
   */
  private async checkSchedulingConflicts(
    creatorId: string,
    partnerId: string | undefined,
    matchTime: Date,
    currentDivisionId: string
  ): Promise<{ hasConflict: boolean; message?: string; conflictingUsers?: string[] }> {
    try {
      // Define time window (2 hours before and after)
      const timeWindow = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
      const startTime = new Date(matchTime.getTime() - timeWindow);
      const endTime = new Date(matchTime.getTime() + timeWindow);

      const usersToCheck = [creatorId];
      if (partnerId) {
        usersToCheck.push(partnerId);
      }

      // Check for existing matches in the time window
      for (const userId of usersToCheck) {
        const conflictingMatches = await prisma.match.findMany({
          where: {
            participants: {
              some: {
                userId: userId,
                invitationStatus: InvitationStatus.ACCEPTED
              }
            },
            status: {
              in: [MatchStatus.SCHEDULED, MatchStatus.ONGOING]
            },
            scheduledTime: {
              gte: startTime,
              lte: endTime
            }
          },
          select: {
            id: true,
            scheduledTime: true
          },
          take: 1
        });

        if (conflictingMatches.length > 0) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true }
          });
          
          return {
            hasConflict: true,
            message: `${user?.name || 'User'} already has a match scheduled around this time`,
            conflictingUsers: [userId]
          };
        }
      }

      return { hasConflict: false };
    } catch (error) {
      logger.error('Error checking scheduling conflicts', { creatorId, partnerId, matchTime }, error as Error);
      // Don't block match creation on conflict check error
      return { hasConflict: false };
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
