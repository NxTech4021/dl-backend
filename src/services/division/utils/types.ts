/**
 * Division Service Type Definitions
 * All TypeScript interfaces for division operations
 */

import { DivisionLevel, GameType, GenderType, Prisma } from "@prisma/client";

export interface DivisionCapacityResult {
  hasCapacity: boolean;
  currentCount: number;
  maxCapacity: number | null;
  division: {
    maxSinglesPlayers: number | null;
    maxDoublesTeams: number | null;
    currentSinglesCount: number | null;
    currentDoublesCount: number | null;
    gameType: GameType;
    name: string;
  };
}

export interface CreateDivisionData {
  seasonId: string;
  name: string;
  description?: string;
  threshold?: number | null;
  divisionLevel: string;
  gameType: string;
  genderCategory?: string;
  maxSinglesPlayers?: number | null;
  maxDoublesTeams?: number | null;
  autoAssignmentEnabled?: boolean;
  isActive?: boolean;
  prizePoolTotal?: number | null;
  sponsorName?: string | null;
}

export interface UpdateDivisionData {
  name?: string;
  description?: string;
  threshold?: number | null;
  divisionLevel?: string;
  gameType?: string;
  genderCategory?: string;
  maxSinglesPlayers?: number | null;
  maxDoublesTeams?: number | null;
  autoAssignmentEnabled?: boolean;
  isActive?: boolean;
  prizePoolTotal?: number | null;
  sponsorName?: string | null;
  seasonId?: string;
}

export interface AssignPlayerData {
  userId: string;
  divisionId: string;
  seasonId: string;
  adminId?: string | null;
  notes?: string | null;
  autoAssignment?: boolean;
}

export interface TransferPlayerData {
  userId: string;
  fromDivisionId: string;
  toDivisionId: string;
  transferredBy?: string | null;
  reason?: string | null;
}

export interface DivisionFilters {
  isActive?: boolean;
  gameType?: string;
  level?: string;
  genderCategory?: string;
  includeAssignments?: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PlayerRatingValidation {
  valid: boolean;
  reason?: string;
  rating?: number;
}

export interface FormattedSeason {
  id: string;
  name: string;
  sportType: string | null;
  seasonType: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  regiDeadline: string | null;
  status: string;
  current: boolean;
  createdAt: string;
  updatedAt: string;
  memberships: any[];
  withdrawalRequests: any[];
}

export interface FormattedDivision {
  id: string;
  seasonId: string;
  name: string;
  description: string | null;
  threshold: number | null;
  divisionLevel: string;
  gameType: string;
  genderCategory: string;
  maxSingles: number | null;
  maxDoublesTeams: number | null;
  currentSinglesCount: number | null;
  currentDoublesCount: number | null;
  autoAssignmentEnabled: boolean;
  isActive: boolean;
  prizePoolTotal: number | null;
  sponsoredDivisionName: string | null;
  season: FormattedSeason;
  createdAt: string;
  updatedAt: string;
}

export interface AutoAssignmentResult {
  assignmentsCreated: number;
  assignments: any[];
  errors?: Array<{
    userId: string;
    userName: string;
    reason: string;
  }>;
}

export interface DivisionWithThread {
  division: any;
  thread: any;
}
