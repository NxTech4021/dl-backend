/**
 * BUG 13: Notification metadata must include isFriendly and matchType
 * when a matchId is provided.
 *
 * Without this, the frontend doesn't know which endpoint to use
 * when navigating from a notification to match-details.
 */

// Mock expo-server-sdk to prevent actual push notifications
jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({
    chunkPushNotifications: jest.fn().mockReturnValue([]),
    sendPushNotificationsAsync: jest.fn().mockResolvedValue([]),
  })),
}));

// Mock email sending
jest.mock('../../../src/config/nodemailer', () => ({
  sendEmail: jest.fn(),
}));

// Mock notification preference service
jest.mock('../../../src/services/notification/notificationPreferenceService', () => ({
  isPushEnabled: jest.fn().mockResolvedValue(false),
  isEmailEnabled: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { NotificationService } from '../../../src/services/notificationService';

// Create a mock Prisma client with the methods NotificationService needs
function createMockPrisma(matchData?: { isFriendly: boolean; matchType: string } | null) {
  return {
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: 'user-1' }]),
    },
    notification: {
      create: jest.fn().mockResolvedValue({
        id: 'notif-1',
        title: 'Test',
        message: 'Test message',
        category: 'MATCH',
        type: 'FRIENDLY_MATCH_POSTED',
        createdAt: new Date(),
      }),
    },
    userNotification: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    match: {
      findUnique: jest.fn().mockResolvedValue(matchData ?? null),
    },
    pushToken: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any;
}

describe('BUG 13: Notification metadata enrichment with match info', () => {
  it('should include isFriendly and matchType in metadata when matchId is provided', async () => {
    // Arrange: Prisma returns a friendly match for the matchId lookup
    const mockPrisma = createMockPrisma({ isFriendly: true, matchType: 'SINGLES' });
    const service = new NotificationService(mockPrisma);

    // Act: Create a notification with a matchId (FRIENDLY_MATCH_POSTED is IN_APP, so it returns results)
    const results = await service.createNotification({
      userIds: ['user-1'],
      type: 'FRIENDLY_MATCH_POSTED',
      category: 'MATCH' as any,
      message: 'Test friendly match notification',
      matchId: 'match-friendly-1',
      metadata: { date: '2026-04-01', time: '10:00' },
    });

    // Assert: The returned metadata must include isFriendly and matchType
    expect(results).toHaveLength(1);
    expect(results[0].metadata).toBeDefined();
    expect(results[0].metadata!.isFriendly).toBe('true');
    expect(results[0].metadata!.matchType).toBe('SINGLES');
    // Original metadata must still be present
    expect(results[0].metadata!.date).toBe('2026-04-01');
    expect(results[0].metadata!.matchId).toBe('match-friendly-1');
  });

  it('should include isFriendly=false for league match notifications', async () => {
    // Arrange: Prisma returns a league match
    const mockPrisma = createMockPrisma({ isFriendly: false, matchType: 'DOUBLES' });
    const service = new NotificationService(mockPrisma);

    // Act: Create notification (use FRIENDLY_MATCH_POSTED type for IN_APP delivery to get return value)
    const results = await service.createNotification({
      userIds: ['user-1'],
      type: 'FRIENDLY_MATCH_POSTED',
      category: 'MATCH' as any,
      message: 'Test league match notification',
      matchId: 'match-league-1',
      metadata: {},
    });

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].metadata!.isFriendly).toBe('false');
    expect(results[0].metadata!.matchType).toBe('DOUBLES');
  });

  it('should NOT fail when matchId is absent (no enrichment needed)', async () => {
    // Arrange: No match data
    const mockPrisma = createMockPrisma(null);
    const service = new NotificationService(mockPrisma);

    // Act: Create notification WITHOUT matchId
    const results = await service.createNotification({
      userIds: ['user-1'],
      type: 'FRIENDLY_MATCH_POSTED',
      category: 'MATCH' as any,
      message: 'Test notification without matchId',
      metadata: { someField: 'value' },
    });

    // Assert: Should succeed without isFriendly/matchType
    expect(results).toHaveLength(1);
    expect(results[0].metadata!.isFriendly).toBeUndefined();
    expect(results[0].metadata!.matchType).toBeUndefined();
    // match.findUnique should NOT have been called
    expect(mockPrisma.match.findUnique).not.toHaveBeenCalled();
  });
});
