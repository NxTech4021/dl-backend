import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for controller-level season transition logic.
 *
 * BUG 1: Full update path (PUT /:id) doesn't trigger waitlist promotion
 * BUG 2: No notification when season goes ACTIVE
 * BUG 3: Waitlist promotion sends no notifications (notification type must exist)
 */

const controllerPath = path.join(
  __dirname,
  '../../../src/controllers/seasonController.ts'
);
const controllerCode = fs.readFileSync(controllerPath, 'utf-8');

// Extract the updateSeason handler (from "export const updateSeason" to the next export)
const updateSeasonStart = controllerCode.indexOf(
  'export const updateSeason = async'
);
const updateSeasonEnd = controllerCode.indexOf(
  'export const updateSeasonStatus',
  updateSeasonStart
);
const updateSeasonHandler = controllerCode.slice(
  updateSeasonStart,
  updateSeasonEnd
);

describe('BUG 1: updateSeason handler must trigger waitlist promotion on UPCOMING->ACTIVE', () => {
  it('should call promoteAllUsers or waitlistService for UPCOMING->ACTIVE transition', () => {
    // The handler must reference waitlist promotion
    expect(updateSeasonHandler).toMatch(
      /promoteAllUsers|waitlistService|waitlist.*promot/i
    );
  });

  it('should gate promotion on previousStatus === UPCOMING', () => {
    // Must check that the previous status was UPCOMING before promoting
    expect(updateSeasonHandler).toMatch(
      /UPCOMING.*ACTIVE|currentSeason.*status.*UPCOMING/
    );
  });
});

describe('BUG 2: updateSeason handler must send notification for ACTIVE transition', () => {
  it('should handle ACTIVE status in the notification block', () => {
    // The notification block should handle ACTIVE, not just FINISHED/CANCELLED
    // Check both patterns exist independently (they're on different lines)
    expect(updateSeasonHandler).toContain("=== 'ACTIVE'");
    expect(updateSeasonHandler).toContain('newSeasonAnnouncement');
  });
});

// Check notification types file for waitlist promotion type
const notifTypesPath = path.join(
  __dirname,
  '../../../src/types/notificationTypes.ts'
);
const notifTypesCode = fs.readFileSync(notifTypesPath, 'utf-8');

describe('BUG 3: WAITLIST_PROMOTED notification type must exist', () => {
  it('should have WAITLIST_PROMOTED in NOTIFICATION_TYPES', () => {
    expect(notifTypesCode).toMatch(/WAITLIST_PROMOTED/);
  });
});

// Check notification helpers for waitlist promotion helper
const notifHelpersPath = path.join(
  __dirname,
  '../../../src/helpers/notifications/leagueLifecycleNotifications.ts'
);
const notifHelpersCode = fs.readFileSync(notifHelpersPath, 'utf-8');

describe('BUG 3: Waitlist promotion notification helper must exist', () => {
  it('should have a waitlistPromoted notification helper', () => {
    expect(notifHelpersCode).toMatch(/waitlistPromoted/);
  });
});
