/**
 * Match Participant Validation Service
 * Handles all validation logic for editing match participants
 */

import { prisma } from '../../lib/prisma';
import { MatchStatus, MatchType, ParticipantRole } from '@prisma/client';
import { logger } from '../../utils/logger';

// Types
export interface ParticipantInput {
  userId: string;
  team: 'team1' | 'team2' | null;
  role: ParticipantRole;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MatchStatusValidation {
  canEdit: boolean;
  requiresRecalc: boolean;
  blockedReason?: string;
}

/**
 * Validate match status allows participant editing
 */
export async function validateMatchStatus(matchId: string): Promise<MatchStatusValidation> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { status: true, seasonId: true }
  });

  if (!match) {
    return {
      canEdit: false,
      requiresRecalc: false,
      blockedReason: 'Match not found'
    };
  }

  // Check status-based rules
  switch (match.status) {
    case MatchStatus.DRAFT:
    case MatchStatus.SCHEDULED:
      return { canEdit: true, requiresRecalc: false };

    case MatchStatus.COMPLETED:
      // Check if season is locked
      if (match.seasonId) {
        const lock = await prisma.seasonLock.findFirst({
          where: { seasonId: match.seasonId, isLocked: true }
        });
        if (lock) {
          return {
            canEdit: false,
            requiresRecalc: false,
            blockedReason: 'Season is locked. Cannot edit completed matches.'
          };
        }
      }
      return { canEdit: true, requiresRecalc: true };

    case MatchStatus.ONGOING:
      return {
        canEdit: false,
        requiresRecalc: false,
        blockedReason: 'Cannot edit participants while match is in progress'
      };

    case MatchStatus.CANCELLED:
    case MatchStatus.VOID:
      return {
        canEdit: false,
        requiresRecalc: false,
        blockedReason: 'Cannot edit participants for cancelled or voided matches'
      };

    case MatchStatus.UNFINISHED:
      return {
        canEdit: false,
        requiresRecalc: false,
        blockedReason: 'Cannot edit participants for unfinished matches'
      };

    default:
      return {
        canEdit: false,
        requiresRecalc: false,
        blockedReason: 'Unknown match status'
      };
  }
}

/**
 * Validate user is a member of the division
 */
export async function validateDivisionMembership(
  userId: string,
  divisionId: string
): Promise<{ isMember: boolean; membershipStatus?: string }> {
  const membership = await prisma.seasonMembership.findFirst({
    where: {
      userId,
      divisionId,
      status: 'ACTIVE'
    },
    select: { status: true }
  });

  if (membership) {
    return {
      isMember: true,
      membershipStatus: membership.status,
    };
  }

  return {
    isMember: false,
  };
}

/**
 * Check if user has a scheduling conflict
 */
export async function validateNoSchedulingConflict(
  userId: string,
  matchDate: Date,
  excludeMatchId: string
): Promise<{ hasConflict: boolean; conflictingMatchId: string | undefined }> {
  // Check for matches on the same day within 2 hours
  const startOfWindow = new Date(matchDate);
  startOfWindow.setHours(startOfWindow.getHours() - 2);

  const endOfWindow = new Date(matchDate);
  endOfWindow.setHours(endOfWindow.getHours() + 2);

  const conflictingMatch = await prisma.match.findFirst({
    where: {
      id: { not: excludeMatchId },
      matchDate: {
        gte: startOfWindow,
        lte: endOfWindow
      },
      status: { in: [MatchStatus.SCHEDULED, MatchStatus.ONGOING] },
      participants: {
        some: { userId }
      }
    },
    select: { id: true }
  });

  return {
    hasConflict: !!conflictingMatch,
    conflictingMatchId: conflictingMatch?.id
  };
}

/**
 * Validate team balance for doubles matches
 */
export function validateTeamBalance(
  participants: ParticipantInput[],
  matchType: MatchType
): { isBalanced: boolean; team1Count: number; team2Count: number; error?: string } {
  if (matchType === MatchType.SINGLES) {
    // Singles: should have exactly 2 participants, no team assignment needed
    const count = participants.length;
    if (count !== 2) {
      return {
        isBalanced: false,
        team1Count: 0,
        team2Count: 0,
        error: `Singles match requires exactly 2 participants, got ${count}`
      };
    }
    return { isBalanced: true, team1Count: 1, team2Count: 1 };
  }

  // Doubles: need exactly 2 players per team
  const team1Count = participants.filter(p => p.team === 'team1').length;
  const team2Count = participants.filter(p => p.team === 'team2').length;

  if (team1Count !== 2 || team2Count !== 2) {
    return {
      isBalanced: false,
      team1Count,
      team2Count,
      error: `Doubles match requires 2 players per team. Team1: ${team1Count}, Team2: ${team2Count}`
    };
  }

  return { isBalanced: true, team1Count, team2Count };
}

/**
 * Validate participant roles
 */
export function validateRoles(
  participants: ParticipantInput[],
  matchType: MatchType
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for duplicate roles that shouldn't be duplicated
  const creatorCount = participants.filter(p => p.role === ParticipantRole.CREATOR).length;
  if (creatorCount > 1) {
    errors.push('Only one participant can have the CREATOR role');
  }
  if (creatorCount === 0) {
    errors.push('At least one participant must have the CREATOR role');
  }

  if (matchType === MatchType.SINGLES) {
    // Singles should have 1 CREATOR and 1 OPPONENT
    const opponentCount = participants.filter(p => p.role === ParticipantRole.OPPONENT).length;
    if (opponentCount !== 1) {
      errors.push('Singles match should have exactly one OPPONENT');
    }
    const partnerCount = participants.filter(p => p.role === ParticipantRole.PARTNER).length;
    if (partnerCount > 0) {
      errors.push('Singles match should not have PARTNER roles');
    }
  } else {
    // Doubles: each team should have appropriate roles
    // Team with CREATOR should have 1 CREATOR + 1 PARTNER
    // Other team should have 2 OPPONENTs or 1 OPPONENT + 1 PARTNER (invited partner)
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Check for duplicate participants
 */
export function validateNoDuplicates(
  participants: ParticipantInput[]
): { hasDuplicates: boolean; duplicateUserIds: string[] } {
  const userIds = participants.map(p => p.userId);
  const uniqueIds = new Set(userIds);

  if (uniqueIds.size === userIds.length) {
    return { hasDuplicates: false, duplicateUserIds: [] };
  }

  // Find duplicates
  const counts: Record<string, number> = {};
  const duplicates: string[] = [];

  for (const id of userIds) {
    counts[id] = (counts[id] || 0) + 1;
    if (counts[id] === 2) {
      duplicates.push(id);
    }
  }

  return { hasDuplicates: true, duplicateUserIds: duplicates };
}

/**
 * Validate all users exist
 */
export async function validateUsersExist(
  userIds: string[]
): Promise<{ allExist: boolean; missingIds: string[] }> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true }
  });

  const foundIds = new Set(users.map(u => u.id));
  const missingIds = userIds.filter(id => !foundIds.has(id));

  return {
    allExist: missingIds.length === 0,
    missingIds
  };
}

/**
 * Full validation orchestrator
 */
export async function validateParticipantEdit(
  matchId: string,
  newParticipants: ParticipantInput[]
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get match details
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      division: true,
      participants: true
    }
  });

  if (!match) {
    return { isValid: false, errors: ['Match not found'], warnings: [] };
  }

  // 1. Validate match status
  const statusValidation = await validateMatchStatus(matchId);
  if (!statusValidation.canEdit) {
    errors.push(statusValidation.blockedReason || 'Cannot edit this match');
    return { isValid: false, errors, warnings };
  }
  if (statusValidation.requiresRecalc) {
    warnings.push('This will trigger rating and standings recalculation');
  }

  // 2. Validate no duplicates
  const dupCheck = validateNoDuplicates(newParticipants);
  if (dupCheck.hasDuplicates) {
    errors.push(`Duplicate participants: ${dupCheck.duplicateUserIds.join(', ')}`);
  }

  // 3. Validate all users exist
  const userIds = newParticipants.map(p => p.userId);
  const userCheck = await validateUsersExist(userIds);
  if (!userCheck.allExist) {
    errors.push(`Users not found: ${userCheck.missingIds.join(', ')}`);
  }

  // 4. Validate division membership for all participants
  if (match.divisionId) {
    for (const participant of newParticipants) {
      const membershipCheck = await validateDivisionMembership(
        participant.userId,
        match.divisionId
      );
      if (!membershipCheck.isMember) {
        errors.push(`User ${participant.userId} is not a member of this division`);
      }
    }
  }

  // 5. Validate team balance
  const balanceCheck = validateTeamBalance(newParticipants, match.matchType);
  if (!balanceCheck.isBalanced) {
    errors.push(balanceCheck.error || 'Team balance invalid');
  }

  // 6. Validate roles
  const roleCheck = validateRoles(newParticipants, match.matchType);
  if (!roleCheck.isValid) {
    errors.push(...roleCheck.errors);
  }

  // 7. Check scheduling conflicts for new participants
  const currentUserIds = new Set(match.participants.map(p => p.userId));
  const newUserIds = newParticipants
    .map(p => p.userId)
    .filter(id => !currentUserIds.has(id));

  for (const userId of newUserIds) {
    const conflictCheck = await validateNoSchedulingConflict(
      userId,
      match.matchDate,
      matchId
    );
    if (conflictCheck.hasConflict) {
      errors.push(`User ${userId} has a scheduling conflict with match ${conflictCheck.conflictingMatchId}`);
    }
  }

  logger.debug(`Participant edit validation for match ${matchId}`, {
    errors: errors.length,
    warnings: warnings.length
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
