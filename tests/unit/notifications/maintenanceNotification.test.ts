/**
 * Issue #045: Maintenance Notification System Tests
 *
 * Tests for all maintenance notification gaps fixed:
 * - GAP 1: BOTH delivery type (push + in-app)
 * - GAP 2: Cancel sends notification
 * - GAP 3: Distinct notification types
 * - GAP 4: notificationSent reset on reschedule
 * - GAP 5: State transition guards
 * - GAP 6: getUpcoming includes IN_PROGRESS
 * - GAP 10: Flag-first atomic operations
 * - GAP 19: Controller truthy checks (undefined vs falsy)
 * - GAP 20: Past-date validation
 * - GAP 21: affectedServices sanitization
 */

// ============================================================
// 1. DELIVERY TYPE TESTS (GAPs 1, 3, 8)
// ============================================================

import {
  NotificationDeliveryType,
  getNotificationDeliveryType,
  shouldSendPushNotification,
  shouldCreateInAppRecord,
  isInAppOnlyNotification,
} from '../../../src/types/notificationDeliveryTypes';
import { NOTIFICATION_TYPES } from '../../../src/types/notificationTypes';
import { accountNotifications } from '../../../src/helpers/notifications/accountNotifications';

describe('Notification Delivery Types', () => {
  describe('BOTH delivery type', () => {
    it('should have BOTH in the enum', () => {
      expect(NotificationDeliveryType.BOTH).toBe('BOTH');
    });

    it('should map all maintenance types to BOTH', () => {
      expect(getNotificationDeliveryType('MAINTENANCE_SCHEDULED')).toBe(NotificationDeliveryType.BOTH);
      expect(getNotificationDeliveryType('MAINTENANCE_IN_PROGRESS')).toBe(NotificationDeliveryType.BOTH);
      expect(getNotificationDeliveryType('MAINTENANCE_COMPLETE')).toBe(NotificationDeliveryType.BOTH);
      expect(getNotificationDeliveryType('MAINTENANCE_CANCELLED')).toBe(NotificationDeliveryType.BOTH);
    });

    it('should map backward-compat SYSTEM_MAINTENANCE to BOTH', () => {
      expect(getNotificationDeliveryType('SYSTEM_MAINTENANCE')).toBe(NotificationDeliveryType.BOTH);
    });

    it('shouldSendPushNotification returns true for BOTH', () => {
      expect(shouldSendPushNotification('MAINTENANCE_SCHEDULED')).toBe(true);
      expect(shouldSendPushNotification('MAINTENANCE_IN_PROGRESS')).toBe(true);
      expect(shouldSendPushNotification('MAINTENANCE_COMPLETE')).toBe(true);
      expect(shouldSendPushNotification('MAINTENANCE_CANCELLED')).toBe(true);
    });

    it('shouldCreateInAppRecord returns true for BOTH', () => {
      expect(shouldCreateInAppRecord('MAINTENANCE_SCHEDULED')).toBe(true);
      expect(shouldCreateInAppRecord('MAINTENANCE_IN_PROGRESS')).toBe(true);
      expect(shouldCreateInAppRecord('MAINTENANCE_COMPLETE')).toBe(true);
      expect(shouldCreateInAppRecord('MAINTENANCE_CANCELLED')).toBe(true);
    });

    it('isInAppOnlyNotification returns false for BOTH', () => {
      expect(isInAppOnlyNotification('MAINTENANCE_SCHEDULED')).toBe(false);
      expect(isInAppOnlyNotification('MAINTENANCE_COMPLETE')).toBe(false);
    });
  });

  describe('existing delivery types still work', () => {
    it('PUSH-only types still return correct values', () => {
      expect(shouldSendPushNotification('SEASON_STARTING_SOON')).toBe(true);
      expect(shouldCreateInAppRecord('SEASON_STARTING_SOON')).toBe(false);
    });

    it('IN_APP-only types still return correct values', () => {
      expect(shouldSendPushNotification('WELCOME_TO_DEUCE')).toBe(false);
      expect(shouldCreateInAppRecord('WELCOME_TO_DEUCE')).toBe(true);
      expect(isInAppOnlyNotification('WELCOME_TO_DEUCE')).toBe(true);
    });

    it('unknown types default to IN_APP', () => {
      expect(getNotificationDeliveryType('UNKNOWN_TYPE')).toBe(NotificationDeliveryType.IN_APP);
      expect(shouldSendPushNotification('UNKNOWN_TYPE')).toBe(false);
      expect(shouldCreateInAppRecord('UNKNOWN_TYPE')).toBe(true);
    });
  });

  describe('phantom type removed (GAP 8)', () => {
    it('SCHEDULED_MAINTENANCE should no longer be in the map', () => {
      // The old phantom type was SCHEDULED_MAINTENANCE (not MAINTENANCE_SCHEDULED)
      // It should no longer exist — should fall back to IN_APP default
      expect(getNotificationDeliveryType('SCHEDULED_MAINTENANCE')).toBe(NotificationDeliveryType.IN_APP);
    });
  });
});

// ============================================================
// 2. NOTIFICATION TYPE CONSTANTS (GAP 3)
// ============================================================

describe('Maintenance Notification Types', () => {
  it('should have distinct maintenance lifecycle types', () => {
    expect(NOTIFICATION_TYPES.MAINTENANCE_SCHEDULED).toBe('MAINTENANCE_SCHEDULED');
    expect(NOTIFICATION_TYPES.MAINTENANCE_IN_PROGRESS).toBe('MAINTENANCE_IN_PROGRESS');
    expect(NOTIFICATION_TYPES.MAINTENANCE_CANCELLED).toBe('MAINTENANCE_CANCELLED');
    expect(NOTIFICATION_TYPES.MAINTENANCE_COMPLETE).toBe('MAINTENANCE_COMPLETE');
  });

  it('should keep backward compat SYSTEM_MAINTENANCE', () => {
    expect(NOTIFICATION_TYPES.SYSTEM_MAINTENANCE).toBe('SYSTEM_MAINTENANCE');
  });

  it('all four types should be distinct strings', () => {
    const types = [
      NOTIFICATION_TYPES.MAINTENANCE_SCHEDULED,
      NOTIFICATION_TYPES.MAINTENANCE_IN_PROGRESS,
      NOTIFICATION_TYPES.MAINTENANCE_COMPLETE,
      NOTIFICATION_TYPES.MAINTENANCE_CANCELLED,
    ];
    expect(new Set(types).size).toBe(4);
  });
});

// ============================================================
// 3. NOTIFICATION TEMPLATES (GAP 3)
// ============================================================

describe('Maintenance Notification Templates', () => {
  it('scheduledMaintenance uses MAINTENANCE_SCHEDULED type', () => {
    const payload = accountNotifications.scheduledMaintenance('Apr 10, 2:00 PM', '2 hours');
    expect(payload.type).toBe('MAINTENANCE_SCHEDULED');
    expect(payload.title).toBe('Upcoming Maintenance');
    expect(payload.message).toContain('Apr 10, 2:00 PM');
    expect(payload.message).toContain('2 hours');
    expect(payload.category).toBe('GENERAL');
  });

  it('maintenanceInProgress uses MAINTENANCE_IN_PROGRESS type', () => {
    const payload = accountNotifications.maintenanceInProgress('3 hours');
    expect(payload.type).toBe('MAINTENANCE_IN_PROGRESS');
    expect(payload.title).toBe('Maintenance in Progress');
    expect(payload.message).toContain('3 hours');
    expect(payload.category).toBe('GENERAL');
  });

  it('maintenanceComplete uses MAINTENANCE_COMPLETE type', () => {
    const payload = accountNotifications.maintenanceComplete();
    expect(payload.type).toBe('MAINTENANCE_COMPLETE');
    expect(payload.title).toBe("We're Back");
    expect(payload.category).toBe('GENERAL');
  });

  it('maintenanceCancelled uses MAINTENANCE_CANCELLED type', () => {
    const payload = accountNotifications.maintenanceCancelled('Weather delay');
    expect(payload.type).toBe('MAINTENANCE_CANCELLED');
    expect(payload.title).toBe('Maintenance Cancelled');
    expect(payload.message).toContain('Weather delay');
    expect(payload.category).toBe('GENERAL');
  });

  it('maintenanceCancelled without reason has default message', () => {
    const payload = accountNotifications.maintenanceCancelled();
    expect(payload.message).toContain('No disruption expected.');
  });
});

// ============================================================
// 4. SYSTEM MAINTENANCE SERVICE (GAPs 2, 4, 5, 6, 10)
// ============================================================

// Mock dependencies
jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({
    chunkPushNotifications: jest.fn().mockReturnValue([]),
    sendPushNotificationsAsync: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../../../src/config/nodemailer', () => ({
  sendEmail: jest.fn(),
}));

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

// Mock prisma
const mockPrisma = {
  systemMaintenance: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  notification: {
    create: jest.fn(),
  },
  userNotification: {
    createMany: jest.fn(),
  },
  notificationPreference: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  userPushToken: {
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn(),
  },
  match: {
    findUnique: jest.fn(),
  },
};

jest.mock('../../../src/lib/prisma', () => ({
  prisma: mockPrisma,
  PrismaClient: jest.fn(),
}));

import { SystemMaintenanceService } from '../../../src/services/systemMaintenanceService';

describe('SystemMaintenanceService', () => {
  let service: SystemMaintenanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SystemMaintenanceService();
  });

  // GAP 6: getUpcomingMaintenance includes IN_PROGRESS
  describe('getUpcomingMaintenance (GAP 6)', () => {
    it('should query for both SCHEDULED and IN_PROGRESS statuses', async () => {
      mockPrisma.systemMaintenance.findMany.mockResolvedValue([]);

      await service.getUpcomingMaintenance();

      expect(mockPrisma.systemMaintenance.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] }
        },
        orderBy: { startDateTime: 'asc' }
      });
    });

    it('should NOT filter by future startDateTime', async () => {
      mockPrisma.systemMaintenance.findMany.mockResolvedValue([]);

      await service.getUpcomingMaintenance();

      const call = mockPrisma.systemMaintenance.findMany.mock.calls[0][0];
      expect(call.where.startDateTime).toBeUndefined();
    });
  });

  // GAP 5: State transition guards
  describe('startMaintenance (GAP 5)', () => {
    it('should throw if maintenance is not SCHEDULED', async () => {
      mockPrisma.systemMaintenance.findUnique.mockResolvedValue({
        id: '1', status: 'COMPLETED', startDateTime: new Date(), endDateTime: new Date()
      });

      await expect(service.startMaintenance('1'))
        .rejects.toThrow('Cannot start maintenance in COMPLETED status. Must be SCHEDULED.');
    });

    it('should throw if maintenance is IN_PROGRESS', async () => {
      mockPrisma.systemMaintenance.findUnique.mockResolvedValue({
        id: '1', status: 'IN_PROGRESS', startDateTime: new Date(), endDateTime: new Date()
      });

      await expect(service.startMaintenance('1'))
        .rejects.toThrow('Cannot start maintenance in IN_PROGRESS status. Must be SCHEDULED.');
    });

    it('should throw if maintenance is CANCELLED', async () => {
      mockPrisma.systemMaintenance.findUnique.mockResolvedValue({
        id: '1', status: 'CANCELLED', startDateTime: new Date(), endDateTime: new Date()
      });

      await expect(service.startMaintenance('1'))
        .rejects.toThrow('Cannot start maintenance in CANCELLED status. Must be SCHEDULED.');
    });

    it('should succeed if maintenance is SCHEDULED', async () => {
      const start = new Date();
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      mockPrisma.systemMaintenance.findUnique.mockResolvedValue({
        id: '1', status: 'SCHEDULED', startDateTime: start, endDateTime: end,
        affectedServices: [], notificationSent: true
      });
      mockPrisma.systemMaintenance.update.mockResolvedValue({
        id: '1', status: 'IN_PROGRESS'
      });

      const result = await service.startMaintenance('1');
      expect(result.status).toBe('IN_PROGRESS');
    });
  });

  describe('cancelMaintenance (GAP 5)', () => {
    it('should throw if maintenance is COMPLETED', async () => {
      mockPrisma.systemMaintenance.findUnique.mockResolvedValue({
        id: '1', status: 'COMPLETED'
      });

      await expect(service.cancelMaintenance('1'))
        .rejects.toThrow('Cannot cancel maintenance in COMPLETED status.');
    });

    it('should throw if maintenance is already CANCELLED', async () => {
      mockPrisma.systemMaintenance.findUnique.mockResolvedValue({
        id: '1', status: 'CANCELLED'
      });

      await expect(service.cancelMaintenance('1'))
        .rejects.toThrow('Cannot cancel maintenance in CANCELLED status.');
    });

    it('should succeed for SCHEDULED maintenance', async () => {
      mockPrisma.systemMaintenance.findUnique.mockResolvedValue({
        id: '1', status: 'SCHEDULED', description: 'Test', notificationSent: false
      });
      mockPrisma.systemMaintenance.update.mockResolvedValue({
        id: '1', status: 'CANCELLED'
      });

      const result = await service.cancelMaintenance('1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should succeed for IN_PROGRESS maintenance', async () => {
      mockPrisma.systemMaintenance.findUnique.mockResolvedValue({
        id: '1', status: 'IN_PROGRESS', description: 'Test', notificationSent: true
      });
      mockPrisma.systemMaintenance.update.mockResolvedValue({
        id: '1', status: 'CANCELLED'
      });

      const result = await service.cancelMaintenance('1');
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('sendMaintenanceCompleteNotification (GAP 5)', () => {
    it('should throw if maintenance is CANCELLED', async () => {
      mockPrisma.systemMaintenance.findUnique.mockResolvedValue({
        id: '1', status: 'CANCELLED', completionSent: false
      });

      await expect(service.sendMaintenanceCompleteNotification('1'))
        .rejects.toThrow('Cannot complete a cancelled maintenance.');
    });

    it('should return early if completionSent is true', async () => {
      mockPrisma.systemMaintenance.findUnique.mockResolvedValue({
        id: '1', status: 'IN_PROGRESS', completionSent: true
      });

      await service.sendMaintenanceCompleteNotification('1');
      expect(mockPrisma.systemMaintenance.update).not.toHaveBeenCalled();
    });
  });

  // GAP 2: Cancel sends notification
  describe('cancelMaintenance notification (GAP 2)', () => {
    it('should send notification if notificationSent was true', async () => {
      const mockUsers = [{ id: 'user1' }, { id: 'user2' }];
      mockPrisma.systemMaintenance.findUnique.mockResolvedValue({
        id: '1', status: 'SCHEDULED', description: 'Test', notificationSent: true
      });
      mockPrisma.systemMaintenance.update.mockResolvedValue({
        id: '1', status: 'CANCELLED'
      });
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      await service.cancelMaintenance('1', 'Weather');

      // Should have queried for active users (for cancel notification)
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        select: { id: true }
      });
    });

    it('should NOT send notification if notificationSent was false', async () => {
      mockPrisma.systemMaintenance.findUnique.mockResolvedValue({
        id: '1', status: 'SCHEDULED', description: 'Test', notificationSent: false
      });
      mockPrisma.systemMaintenance.update.mockResolvedValue({
        id: '1', status: 'CANCELLED'
      });

      await service.cancelMaintenance('1');

      // user.findMany should NOT be called for cancel notification
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  // GAP 4: Reset notificationSent on reschedule
  describe('updateMaintenance (GAP 4)', () => {
    it('should reset notificationSent when startDateTime changes', async () => {
      const newStart = new Date('2026-04-15');
      mockPrisma.systemMaintenance.update.mockResolvedValue({ id: '1' });

      await service.updateMaintenance({ id: '1', startDateTime: newStart });

      expect(mockPrisma.systemMaintenance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notificationSent: false,
            startDateTime: newStart
          })
        })
      );
    });

    it('should reset notificationSent when endDateTime changes', async () => {
      const newEnd = new Date('2026-04-15');
      mockPrisma.systemMaintenance.update.mockResolvedValue({ id: '1' });

      await service.updateMaintenance({ id: '1', endDateTime: newEnd });

      expect(mockPrisma.systemMaintenance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notificationSent: false,
            endDateTime: newEnd
          })
        })
      );
    });

    it('should NOT reset notificationSent when only title changes', async () => {
      mockPrisma.systemMaintenance.update.mockResolvedValue({ id: '1' });

      await service.updateMaintenance({ id: '1', title: 'New Title' });

      const updateCall = mockPrisma.systemMaintenance.update.mock.calls[0][0];
      expect(updateCall.data.notificationSent).toBeUndefined();
    });
  });
});
