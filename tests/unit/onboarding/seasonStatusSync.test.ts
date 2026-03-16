import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for season status field synchronization.
 *
 * BUG 6: isActive and status can get out of sync
 * BUG 8: updateSeason doesn't infer status from isActive
 * BUG 16: Duplicate isActive assignment line
 */

const seasonServicePath = path.join(
  __dirname,
  '../../../src/services/seasonService.ts'
);
const seasonServiceCode = fs.readFileSync(seasonServicePath, 'utf-8');

// Extract only the updateSeason method (between "async updateSeason" and next "async " method)
const updateSeasonStart = seasonServiceCode.indexOf('async updateSeason(');
const updateSeasonEnd = seasonServiceCode.indexOf(
  'async deleteSeason',
  updateSeasonStart
);
const updateSeasonMethod = seasonServiceCode.slice(
  updateSeasonStart,
  updateSeasonEnd
);

describe('BUG 16: No duplicate isActive assignment', () => {
  it('should NOT have duplicate isActive lines in updateSeason', () => {
    const isActiveAssignments = updateSeasonMethod.match(
      /if\s*\(data\.isActive\s*!==\s*undefined\)\s*updateData\.isActive\s*=\s*data\.isActive;/g
    );
    // Should have exactly 1 occurrence, not 2
    expect(isActiveAssignments?.length ?? 0).toBe(1);
  });
});

describe('BUG 8: updateSeason must infer status from isActive', () => {
  it('should infer finalStatus from isActive when status not provided', () => {
    // updateSeason must compute a finalStatus like updateSeasonStatus does
    // Pattern: finalStatus = status ?? (isActive ? "ACTIVE" : undefined)
    // OR equivalent logic that infers status from isActive
    expect(updateSeasonMethod).toMatch(
      /finalStatus|data\.status\s*\?\?|isActive\s*\?\s*["']ACTIVE["']/
    );
  });

  it('should sync isActive when status is explicitly set', () => {
    // When status is set, isActive should be derived from it
    // Pattern: isActive = (finalStatus === "ACTIVE") or equivalent
    expect(updateSeasonMethod).toMatch(
      /isActive\s*=.*===\s*["']ACTIVE["']|isActive.*finalStatus/
    );
  });
});

describe('BUG 6: isActive and status always in sync', () => {
  it('should set both status and isActive in the update data', () => {
    // The updateSeason method should set updateData.status AND updateData.isActive
    // when either field changes, not independently
    expect(updateSeasonMethod).toMatch(/updateData\.status\s*=.*finalStatus/);
    expect(updateSeasonMethod).toMatch(/updateData\.isActive\s*=/);
  });
});
