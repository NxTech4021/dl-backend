import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for socket event emission on waitlist promotion.
 *
 * BUG 24: No real-time updates for waitlist promotion
 */

const controllerPath = path.join(
  __dirname,
  '../../../src/controllers/seasonController.ts'
);
const controllerCode = fs.readFileSync(controllerPath, 'utf-8');

// Extract the goLiveSeason handler
const goLiveStart = controllerCode.indexOf('export const goLiveSeason');
const goLiveEnd = controllerCode.indexOf(
  'export const updateSeasonStatus',
  goLiveStart
);
const goLiveHandler = controllerCode.slice(goLiveStart, goLiveEnd);

describe('BUG 24: goLiveSeason must emit socket events for promoted users', () => {
  it('should emit waitlist_promotion socket event', () => {
    expect(goLiveHandler).toContain('waitlist_promotion');
  });

  it('should use req.io.to(userId).emit pattern', () => {
    expect(goLiveHandler).toMatch(/req\.io.*emit/);
  });

  it('should guard with req.io check', () => {
    expect(goLiveHandler).toMatch(/if\s*\(\s*req\.io/);
  });
});

// Check the manual promote route also has socket events
const waitlistRoutesPath = path.join(
  __dirname,
  '../../../src/routes/waitlistRoutes.ts'
);
const waitlistRoutesCode = fs.readFileSync(waitlistRoutesPath, 'utf-8');

describe('BUG 24: Manual promote route should emit socket events', () => {
  it('should emit waitlist_promotion socket event on manual promote', () => {
    // Find the promote route handler
    const promoteStart = waitlistRoutesCode.indexOf("'/:seasonId/promote'");
    const promoteEnd = waitlistRoutesCode.indexOf(
      'RequestHandler)',
      promoteStart
    );
    const promoteHandler = waitlistRoutesCode.slice(promoteStart, promoteEnd);
    expect(promoteHandler).toContain('waitlist_promotion');
  });
});
