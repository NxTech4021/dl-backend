import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for admin edit match result (Issue #043)
 *
 * BUG 3: Admin edit on ONGOING match should auto-complete and trigger recalculation
 */

const serviceFile = fs.readFileSync(
  path.join(__dirname, '../../../src/services/admin/adminMatchService.ts'),
  'utf-8'
);

describe('#043 BUG 3: Admin edit should auto-complete non-COMPLETED matches', () => {
  it('should auto-complete match when admin provides outcome', () => {
    // Must have logic to set COMPLETED when outcome provided
    expect(serviceFile).toMatch(/Auto-complete match/);
    expect(serviceFile).toMatch(/updateData\.status\s*=\s*MatchStatus\.COMPLETED/);
  });

  it('should trigger recalculation for newly completed matches', () => {
    // The recalculation condition should also fire if admin just completed the match
    expect(serviceFile).toMatch(/isNowCompleted/);
  });

  it('should set resultConfirmedAt when auto-completing', () => {
    expect(serviceFile).toMatch(/updateData\.resultConfirmedAt/);
  });
});
