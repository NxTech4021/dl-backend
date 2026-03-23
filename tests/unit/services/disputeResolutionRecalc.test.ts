/**
 * Tests for BUG 3 (P0): resolveDispute must trigger standings/ratings/Best6 recalculation.
 *
 * The resolveDispute() function updates match scores but never called
 * recalculateDivisionStandings(), recalculateMatchRatings(), or Best6.
 * Meanwhile editMatchResult() in the SAME file does all three.
 *
 * This structural test verifies the recalculation block exists in resolveDispute().
 */

import * as fs from 'fs';
import * as path from 'path';

const serviceFile = fs.readFileSync(
  path.join(__dirname, '../../../src/services/admin/adminMatchService.ts'),
  'utf-8'
);

describe('BUG 3: resolveDispute must recalculate standings after resolution', () => {
  // Find the resolveDispute method body
  const resolveDisputeStart = serviceFile.indexOf('async resolveDispute(');
  const resolveDisputeEnd = serviceFile.indexOf('async editMatchResult(');
  const resolveDisputeBody = serviceFile.slice(resolveDisputeStart, resolveDisputeEnd);

  it('should call recalculateDivisionStandings', () => {
    expect(resolveDisputeBody).toContain('recalculateDivisionStandings');
  });

  it('should call recalculateMatchRatings for DMR', () => {
    expect(resolveDisputeBody).toContain('recalculateMatchRatings');
  });

  it('should call Best6AlgorithmService', () => {
    expect(resolveDisputeBody).toContain('Best6AlgorithmService');
  });

  it('should only recalculate for actions that change match state', () => {
    // Should NOT recalculate for REJECT or REQUEST_MORE_INFO
    expect(resolveDisputeBody).toMatch(/REJECT|REQUEST_MORE_INFO/);
    // Should have a guard to skip recalculation for non-modifying actions
    expect(resolveDisputeBody).toMatch(/actionsRequiringRecalc|shouldRecalculate/);
  });

  it('should wrap recalculation in try-catch (non-blocking)', () => {
    // Recalculation failure should not break the dispute resolution
    const recalcSection = resolveDisputeBody.slice(
      resolveDisputeBody.indexOf('recalculateDivisionStandings') - 200
    );
    expect(recalcSection).toContain('try');
    expect(recalcSection).toContain('catch');
  });
});
