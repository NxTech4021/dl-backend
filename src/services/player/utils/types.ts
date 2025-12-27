/**
 * Shared TypeScript interfaces for Player services
 */

export interface SkillRating {
  singles: number | null;
  doubles: number | null;
  rating: number;
  confidence: string;
  rd: number;
  lastUpdated?: Date;
}

export interface PlayerBasic {
  id: string;
  name: string;
  username: string;
  displayUsername: string | null;
  email?: string;
  emailVerified?: boolean;
  image: string | null;
  bio: string | null;
  area: string | null;
  gender: string | null;
  dateOfBirth: Date | null;
  status: string;
  completedOnboarding?: boolean;
  createdAt?: Date;
  lastLogin?: Date | null;
}

export interface PlayerWithSkills extends PlayerBasic {
  sports: string[];
  skillRatings: Record<string, SkillRating> | null;
  registeredDate?: Date;
  lastLoginDate?: Date | null;
}

export interface QuestionnaireStatus {
  isCompleted: boolean;
  startedAt: Date;
  completedAt: Date | null;
}

export interface DetailedProfile extends PlayerWithSkills {
  questionnaireStatus: Record<string, QuestionnaireStatus>;
  recentMatches: any[];
  totalMatches?: number;
}

export interface PublicProfile extends PlayerWithSkills {
  isFriend: boolean;
  mutualFriendsCount?: number;
  recentMatches?: any[];
}

export interface PlayerStats {
  // Frontend-friendly fields
  total: number;
  active: number;
  inactive: number;
  verified: number;
  // Legacy fields for backward compatibility
  totalPlayers: number;
  activePlayers: number;
  inactivePlayers: number;
  suspendedPlayers: number;
  totalAdmins: number;
  totalStaff: number;
}

export interface UpdateProfileData {
  name?: string;
  username?: string;
  displayUsername?: string;
  email?: string;
  bio?: string;
  dateOfBirth?: Date;
  gender?: string;
  area?: string;
  phoneNumber?: string;
}

export interface AvailablePlayersResult {
  players: PlayerWithSkills[];
  usedFallback: boolean;
  totalCount: number;
  friendsCount: number;
}

export interface LeagueHistory {
  league: {
    id: string;
    name: string;
    location: string;
    sportType: string;
  };
  seasons: any[];
  totalSeasons: number;
}

export interface SeasonHistory {
  season: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
  };
  division: {
    id: string;
    name: string;
    tier: number;
  } | null;
  registrationDate: Date;
  status: string;
}

export interface DivisionHistory {
  division: {
    id: string;
    name: string;
    tier: number;
  };
  season: {
    id: string;
    name: string;
  };
  registrationDate: Date;
  status: string;
}
