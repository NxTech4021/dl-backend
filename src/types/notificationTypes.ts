import { NotificationCategory } from '@prisma/client';


export type NotificationType = string;

// Common notification types as constants for consistency
export const NOTIFICATION_TYPES = {
  
  // Division notifications
  DIVISION_ASSIGNED: 'DIVISION_ASSIGNED',
  DIVISION_TRANSFERRED: 'DIVISION_TRANSFERRED',
  DIVISION_REMOVED: 'DIVISION_REMOVED',
  DIVISION_CREATED: 'DIVISION_CREATED',
  
  // Chat notifications
  GROUP_CHAT_ADDED: 'GROUP_CHAT_ADDED',
  NEW_MESSAGE: 'NEW_MESSAGE',
  
  // Match notifications
  MATCH_SCHEDULED: 'MATCH_SCHEDULED',
  MATCH_REMINDER: 'MATCH_REMINDER',
  MATCH_RESULT: 'MATCH_RESULT',
  MATCH_CANCELLED: 'MATCH_CANCELLED',
  
  // Season notifications
  SEASON_REGISTRATION_CONFIRMED: 'SEASON_REGISTRATION_CONFIRMED',
  SEASON_STARTING_SOON: 'SEASON_STARTING_SOON',
  SEASON_ENDED: 'SEASON_ENDED',
  SEASON_CANCELLED: 'SEASON_CANCELLED',
  
  // Pairing notifications
  PAIR_REQUEST_RECEIVED: 'PAIR_REQUEST_RECEIVED',
  PAIR_REQUEST_ACCEPTED: 'PAIR_REQUEST_ACCEPTED',
  PAIR_REQUEST_REJECTED: 'PAIR_REQUEST_REJECTED',
  PARTNERSHIP_DISSOLVED: 'PARTNERSHIP_DISSOLVED',
  
  // Payment notifications
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_REMINDER: 'PAYMENT_REMINDER',
  
  // Achievement notifications
  ACHIEVEMENT_UNLOCKED: 'ACHIEVEMENT_UNLOCKED',
  LEVEL_UP: 'LEVEL_UP',
  RANKING_UPDATE: 'RANKING_UPDATE',
  
  // Withdrawal notifications
  WITHDRAWAL_REQUEST_RECEIVED: 'WITHDRAWAL_REQUEST_RECEIVED',
  WITHDRAWAL_REQUEST_APPROVED: 'WITHDRAWAL_REQUEST_APPROVED',
  WITHDRAWAL_REQUEST_REJECTED: 'WITHDRAWAL_REQUEST_REJECTED',
  
  // Admin notifications
  ADMIN_MESSAGE: 'ADMIN_MESSAGE',
  SYSTEM_MAINTENANCE: 'SYSTEM_MAINTENANCE',
  NEW_FEATURE: 'NEW_FEATURE',
  
  // General reminders
  MATCH_UPCOMING: 'MATCH_UPCOMING',
  REGISTRATION_DEADLINE: 'REGISTRATION_DEADLINE',
  PAYMENT_DUE: 'PAYMENT_DUE',
  
  // Tournament notifications
  TOURNAMENT_INVITATION: 'TOURNAMENT_INVITATION',
  TOURNAMENT_RESULT: 'TOURNAMENT_RESULT',
} as const;

export interface NotificationPayload {
  type: NotificationType;
  category: NotificationCategory;
  title?: string | undefined;
  message: string;
  metadata?: Record<string, any> | undefined;
}


// FIX THIS LATER, CANNOT BE UNDEFINED 
export interface CreateNotificationData extends NotificationPayload {
  userIds: string | string[];
  seasonId?: string | undefined;
  divisionId?: string | undefined;
  matchId?: string | undefined;
  partnershipId?: string | undefined;
  threadId?: string | undefined;
  pairRequestId?: string | undefined;
  achievementId?: string | undefined; 
  withdrawalRequestId?: string | undefined;
}

export interface NotificationResult {
  id: string;
  title: string | undefined; 
  message: string;
  category: NotificationCategory;
  type: string | undefined;
  read: boolean;
  archive: boolean;
  createdAt: Date;
  readAt: Date | undefined;
  metadata?: Record<string, any>;
}

export interface NotificationFilter {
  page?: number | undefined;
  limit?: number | undefined;
  unreadOnly?: boolean | undefined;
  archived?: boolean | undefined;
  category?: NotificationCategory | undefined;
  categories?: NotificationCategory[] | undefined;
  type?: NotificationType | undefined;
  types?: string[] | undefined; 
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
  byCategory: Record<NotificationCategory, number>;
  byType: Record<NotificationType, number>;
}

// Helper function to get category from type
export function getCategoryForNotificationType(type: NotificationType): NotificationCategory {
  const categoryMap: Record<string, NotificationCategory> = {
    // Division types
    [NOTIFICATION_TYPES.DIVISION_ASSIGNED]: 'DIVISION',
    [NOTIFICATION_TYPES.DIVISION_TRANSFERRED]: 'DIVISION',
    [NOTIFICATION_TYPES.DIVISION_REMOVED]: 'DIVISION',
    [NOTIFICATION_TYPES.DIVISION_CREATED]: 'DIVISION',
    
    // Chat types
    [NOTIFICATION_TYPES.GROUP_CHAT_ADDED]: 'CHAT',
    [NOTIFICATION_TYPES.NEW_MESSAGE]: 'CHAT',
    
    // Match types
    [NOTIFICATION_TYPES.MATCH_SCHEDULED]: 'MATCH',
    [NOTIFICATION_TYPES.MATCH_REMINDER]: 'MATCH',
    [NOTIFICATION_TYPES.MATCH_RESULT]: 'MATCH',
    [NOTIFICATION_TYPES.MATCH_CANCELLED]: 'MATCH',
    [NOTIFICATION_TYPES.MATCH_UPCOMING]: 'MATCH',
    
    // Season types
    [NOTIFICATION_TYPES.SEASON_REGISTRATION_CONFIRMED]: 'SEASON',
    [NOTIFICATION_TYPES.SEASON_STARTING_SOON]: 'SEASON',
    [NOTIFICATION_TYPES.SEASON_ENDED]: 'SEASON',
    [NOTIFICATION_TYPES.SEASON_CANCELLED]: 'SEASON',
    [NOTIFICATION_TYPES.REGISTRATION_DEADLINE]: 'SEASON',
    
    // Payment types
    [NOTIFICATION_TYPES.PAYMENT_CONFIRMED]: 'PAYMENT',
    [NOTIFICATION_TYPES.PAYMENT_FAILED]: 'PAYMENT',
    [NOTIFICATION_TYPES.PAYMENT_REMINDER]: 'PAYMENT',
    [NOTIFICATION_TYPES.PAYMENT_DUE]: 'PAYMENT',
    
    // Admin types
    [NOTIFICATION_TYPES.ADMIN_MESSAGE]: 'ADMIN',
    [NOTIFICATION_TYPES.SYSTEM_MAINTENANCE]: 'ADMIN',
    [NOTIFICATION_TYPES.NEW_FEATURE]: 'ADMIN',
    
    // General types default to GENERAL
    [NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED]: 'GENERAL',
    [NOTIFICATION_TYPES.LEVEL_UP]: 'GENERAL',
    [NOTIFICATION_TYPES.RANKING_UPDATE]: 'GENERAL',
    [NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_RECEIVED]: 'GENERAL',
    [NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_APPROVED]: 'GENERAL',
    [NOTIFICATION_TYPES.WITHDRAWAL_REQUEST_REJECTED]: 'GENERAL',
    [NOTIFICATION_TYPES.PAIR_REQUEST_RECEIVED]: 'GENERAL',
    [NOTIFICATION_TYPES.PAIR_REQUEST_ACCEPTED]: 'GENERAL',
    [NOTIFICATION_TYPES.PAIR_REQUEST_REJECTED]: 'GENERAL',
    [NOTIFICATION_TYPES.PARTNERSHIP_DISSOLVED]: 'GENERAL',
    [NOTIFICATION_TYPES.TOURNAMENT_INVITATION]: 'GENERAL',
    [NOTIFICATION_TYPES.TOURNAMENT_RESULT]: 'GENERAL',
  };

  return categoryMap[type] || 'GENERAL';
}