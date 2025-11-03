/**
 * Player Statistics Service
 * Handles player stats aggregation and individual player queries
 */

import { prisma } from '../../lib/prisma';
import { Role, UserStatus } from "@prisma/client";
import { extractSports, buildSkillRatings, fetchPlayerQuestionnaires } from './utils/playerTransformer';
import { PlayerStats } from './utils/types';

/**
 * Get aggregated player statistics
 * Original: playerController.ts lines 138-181
 */
export async function getPlayerStats(): Promise<PlayerStats> {
  const totalPlayers = prisma.user.count({
    where: { role: Role.USER },
  });

  const activePlayers = prisma.user.count({
    where: { role: Role.USER, status: UserStatus.ACTIVE },
  });

  const inactivePlayers = prisma.user.count({
    where: { role: Role.USER, status: UserStatus.INACTIVE },
  });

  const suspendedPlayers = prisma.user.count({
    where: { role: Role.USER, status: UserStatus.SUSPENDED },
  });

  const totalAdmins = prisma.user.count({
    where: { role: Role.ADMIN },
  });

  const [total, active, inactive, suspended, admins] = await prisma.$transaction([
    totalPlayers,
    activePlayers,
    inactivePlayers,
    suspendedPlayers,
    totalAdmins,
  ]);

  return {
    totalPlayers: total,
    activePlayers: active,
    inactivePlayers: inactive,
    suspendedPlayers: suspended,
    totalAdmins: admins,
    totalStaff: 0, // Not available in current Role enum
  };
}

/**
 * Get individual player by ID with skills
 * Original: playerController.ts lines 183-268
 */
export async function getPlayerById(playerId: string) {
  const player = await prisma.user.findUnique({
    where: {
      id: playerId,
      role: Role.USER,
    },
    select: {
      id: true,
      name: true,
      username: true,
      displayUsername: true,
      email: true,
      emailVerified: true,
      phoneNumber: true,
      image: true,
      role: true,
      status: true,
      gender: true,
      dateOfBirth: true,
      area: true,
      bio: true,
      createdAt: true,
      updatedAt: true,
      lastLogin: true,
      lastActivityCheck: true,
      completedOnboarding: true,
      accounts: {
        select: {
          providerId: true,
          createdAt: true,
        },
      },
      sessions: {
        select: {
          ipAddress: true,
          userAgent: true,
          expiresAt: true,
        },
      },
    },
  });

  if (!player) {
    return null;
  }

  const responses = await fetchPlayerQuestionnaires(playerId);

  const profileData = {
    ...player,
    registeredDate: player.createdAt,
    lastLoginDate: player.lastLogin,
    sports: extractSports(responses),
    skillRatings: Object.keys(buildSkillRatings(responses)).length > 0
      ? buildSkillRatings(responses)
      : null,
    questionnaires: responses,
  };

  return profileData;
}
