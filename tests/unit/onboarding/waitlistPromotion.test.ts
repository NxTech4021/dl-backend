import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for waitlist promotion improvements.
 *
 * BUG 4: promoteAllUsers doesn't increment registeredUserCount
 * BUG 11: Promotion error handling too loose (count needs to happen after loop)
 * BUG 17: Promotion errors swallowed silently (no failed user tracking)
 */

const waitlistServicePath = path.join(
  __dirname,
  '../../../src/services/waitlistService.ts'
);
const waitlistServiceCode = fs.readFileSync(waitlistServicePath, 'utf-8');

// Extract promoteAllUsers method
const promoteStart = waitlistServiceCode.indexOf('async promoteAllUsers');
const promoteEnd = waitlistServiceCode.indexOf(
  '\n  /**',
  promoteStart + 100
);
const promoteMethod = waitlistServiceCode.slice(promoteStart, promoteEnd);

describe('BUG 4: promoteAllUsers must increment registeredUserCount', () => {
  it('should contain registeredUserCount increment after promotion loop', () => {
    expect(promoteMethod).toMatch(/registeredUserCount.*increment/);
  });

  it('should only increment when promoted > 0', () => {
    // Should have a guard: if (promoted > 0) before incrementing
    expect(promoteMethod).toMatch(/if\s*\(\s*promoted\s*>\s*0\s*\)/);
  });
});

describe('BUG 17: promoteAllUsers must track failed promotions', () => {
  it('should return promotedUserIds array', () => {
    expect(promoteMethod).toMatch(/promotedUserIds/);
  });

  it('should return failedUserIds array', () => {
    expect(promoteMethod).toMatch(/failedUserIds/);
  });

  it('should include both in return statement', () => {
    // Return should have promoted, promotedUserIds, failedUserIds
    const returnMatch = promoteMethod.match(/return\s*\{[^}]+\}/s);
    expect(returnMatch).not.toBeNull();
    const returnBlock = returnMatch![0];
    expect(returnBlock).toMatch(/promoted/);
    expect(returnBlock).toMatch(/promotedUserIds/);
    expect(returnBlock).toMatch(/failedUserIds/);
  });
});

describe('BUG 11: promoteAllUsers must fetch season name for notifications', () => {
  it('should include season name in the query', () => {
    // The season query should select/include the name field
    // Either via include or by accessing season.name
    expect(promoteMethod).toMatch(/season\.name|name:\s*true|select.*name/);
  });
});

describe('Edge case: free vs paid season payment status', () => {
  it('should check paymentRequired to determine payment status', () => {
    expect(promoteMethod).toMatch(/paymentRequired/);
  });

  it('should set COMPLETED for free seasons and PENDING for paid', () => {
    // Pattern: paymentRequired ? "PENDING" : "COMPLETED"
    expect(promoteMethod).toMatch(/paymentRequired\s*\?\s*["']PENDING["']\s*:\s*["']COMPLETED["']/);
  });

  it('should select paymentRequired in the season query', () => {
    expect(promoteMethod).toMatch(/paymentRequired:\s*true/);
  });
});
