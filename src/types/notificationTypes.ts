export enum NotificationType {
  // Division notifications
  DIVISION_ASSIGNED = 'DIVISION_ASSIGNED',
  DIVISION_TRANSFERRED = 'DIVISION_TRANSFERRED',
  DIVISION_REMOVED = 'DIVISION_REMOVED',
  
  // Chat notifications
  GROUP_CHAT_ADDED = 'GROUP_CHAT_ADDED',
  NEW_MESSAGE = 'NEW_MESSAGE',
  
  // Match notifications
  MATCH_SCHEDULED = 'MATCH_SCHEDULED',
  MATCH_REMINDER = 'MATCH_REMINDER',
  MATCH_RESULT = 'MATCH_RESULT',
  MATCH_CANCELLED = 'MATCH_CANCELLED',
  
  // Season notifications
  SEASON_REGISTRATION_CONFIRMED = 'SEASON_REGISTRATION_CONFIRMED',
  SEASON_STARTING_SOON = 'SEASON_STARTING_SOON',
  SEASON_ENDED = 'SEASON_ENDED',
  SEASON_CANCELLED = 'SEASON_CANCELLED',
  
  // Pairing notifications
  PAIR_REQUEST_RECEIVED = 'PAIR_REQUEST_RECEIVED',
  PAIR_REQUEST_ACCEPTED = 'PAIR_REQUEST_ACCEPTED',
  PAIR_REQUEST_REJECTED = 'PAIR_REQUEST_REJECTED',
  PARTNERSHIP_DISSOLVED = 'PARTNERSHIP_DISSOLVED',
  
  // Payment notifications
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_REMINDER = 'PAYMENT_REMINDER',
  
  // Achievement notifications
  ACHIEVEMENT_UNLOCKED = 'ACHIEVEMENT_UNLOCKED',
  LEVEL_UP = 'LEVEL_UP',
  RANKING_UPDATE = 'RANKING_UPDATE',
  
  // Withdrawal notifications
  WITHDRAWAL_REQUEST_RECEIVED = 'WITHDRAWAL_REQUEST_RECEIVED',
  WITHDRAWAL_REQUEST_APPROVED = 'WITHDRAWAL_REQUEST_APPROVED',
  WITHDRAWAL_REQUEST_REJECTED = 'WITHDRAWAL_REQUEST_REJECTED',
  
  // Admin notifications
  ADMIN_MESSAGE = 'ADMIN_MESSAGE',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  NEW_FEATURE = 'NEW_FEATURE',
  
  // General reminders
  MATCH_UPCOMING = 'MATCH_UPCOMING',
  REGISTRATION_DEADLINE = 'REGISTRATION_DEADLINE',
  PAYMENT_DUE = 'PAYMENT_DUE',
  
  // Tournament notifications
  TOURNAMENT_INVITATION = 'TOURNAMENT_INVITATION',
  TOURNAMENT_RESULT = 'TOURNAMENT_RESULT',
}

export interface NotificationPayload {
  type: NotificationType;
  title?: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface CreateNotificationData extends NotificationPayload {
  userIds: string | string[];
  seasonId?: string;
  divisionId?: string;
  matchId?: string;
  partnershipId?: string;
  threadId?: string;
  pairRequestId?: string;
  achievementId?: string;
  withdrawalRequestId?: string;
}

export interface NotificationFilter {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  archived?: boolean;
  type?: NotificationType;
  types?: NotificationType[];
}

export interface NotificationResult {
  id: string;
  title?: string;
  message: string;
  type: NotificationType;
  read: boolean;
  archive: boolean;
  createdAt: Date;
  readAt?: Date;
  metadata?: Record<string, any>;
}

export interface PaginatedNotifications {
  notifications: NotificationResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface NotificationStats {
  total: number;
  unread: number;
  archived: number;
  byType: Record<NotificationType, number>;
}