/**
 * Common Query Builders for Player Services
 */

import { Role, UserStatus } from "@prisma/client";

/**
 * Build where clause for player search queries
 */
export function buildSearchWhereClause(
  query?: string,
  sport?: string,
  excludeUserId?: string
) {
  const whereClause: any = {
    role: Role.USER,
    status: UserStatus.ACTIVE, // ✅ Fixed - use enum instead of 'active'
  };

  // Exclude specific user if provided
  if (excludeUserId) {
    whereClause.id = { not: excludeUserId };
  }

  // Add search query if provided
  if (query && query.trim().length > 0) {
    whereClause.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { username: { contains: query, mode: "insensitive" } },
      { displayUsername: { contains: query, mode: "insensitive" } },
    ];
  }

  return whereClause;
}

/**
 * Build player select object with optional private fields
 */
export function buildPlayerSelectObject(includePrivate: boolean = false) {
  const baseSelect = {
    id: true,
    name: true,
    username: true,
    displayUsername: true,
    image: true,
    bio: true,
    area: true,
    gender: true,
    dateOfBirth: true,
    status: true,
    createdAt: true,
    lastLogin: true,
  };

  if (includePrivate) {
    return {
      ...baseSelect,
      email: true,
      emailVerified: true,
      completedOnboarding: true,
    };
  }

  return baseSelect;
}
