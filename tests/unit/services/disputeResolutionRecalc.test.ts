/**
 * Tests for resolveDispute recalculation pipeline.
 *
 * Updated for Issue #036: Now verifies V2 standings, MatchResult refresh,
 * and that REJECT is included in recalculation (since REJECT now sets COMPLETED).
 */

import * as fs from 'fs';
import * as path from 'path';

const serviceFile = fs.readFileSync(
  path.join(__dirname, '../../../src/services/admin/adminMatchService.ts'),
  'utf-8'
);

describe('resolveDispute must recalculate standings after resolution', () => {
  const resolveDisputeStart = serviceFile.indexOf('async resolveDispute(');
  const resolveDisputeEnd = serviceFile.indexOf('async editMatchResult(');
  const resolveDisputeBody = serviceFile.slice(resolveDisputeStart, resolveDisputeEnd);

  it('should call recalculateDivisionStandings (V2)', () => {
    expect(resolveDisputeBody).toContain('recalculateDivisionStandings');
    expect(resolveDisputeBody).toContain('StandingsV2Service');
  });

  it('should call recalculateMatchRatings for DMR', () => {
    expect(resolveDisputeBody).toContain('recalculateMatchRatings');
  });

  it('should call Best6AlgorithmService', () => {
    expect(resolveDisputeBody).toContain('Best6AlgorithmService');
  });

  it('should only skip recalculation for REQUEST_MORE_INFO', () => {
    // REJECT is now included (sets COMPLETED), only REQUEST_MORE_INFO is excluded
    expect(resolveDisputeBody).toContain('actionsRequiringRecalc');
    // REQUEST_MORE_INFO should NOT be in the recalc list
    const recalcList = resolveDisputeBody.slice(
      resolveDisputeBody.indexOf('actionsRequiringRecalc'),
      resolveDisputeBody.indexOf('if (actionsRequiringRecalc.includes')
    );
    expect(recalcList).not.toContain('REQUEST_MORE_INFO');
    // REJECT SHOULD be in the recalc list
    expect(recalcList).toContain('REJECT');
  });

  it('should wrap recalculation in try-catch (non-blocking)', () => {
    const recalcSection = resolveDisputeBody.slice(
      resolveDisputeBody.indexOf('Recalculate standings')
    );
    expect(recalcSection).toContain('try');
    expect(recalcSection).toContain('catch');
  });
});
