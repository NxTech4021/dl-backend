/**
 * Common Query Builders for Player Services
 */

import { Role } from "@prisma/client";

/**
 * Build search where clause for player search
 */
export function buildSearchWhereClause(
  query?: string,
  sport?: string,
  excludeUserId?: string
) {
  const whereClause: any = {
    role: Role.USER,
    status: 'active',
  };

  // Exclude current user if specified
  if (excludeUserId) {
    whereClause.id = { not: excludeUserId };
  }

  // Add search filter if query provided (minimum 2 characters)
  if (query && typeof query === 'string' && query.trim().length >= 2) {
    const searchTerm = query.trim();
    whereClause.OR = [
      { name: { contains: searchTerm, mode: 'insensitive' } },
      { username: { contains: searchTerm, mode: 'insensitive' } },
      { displayUsername: { contains: searchTerm, mode: 'insensitive' } },
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
