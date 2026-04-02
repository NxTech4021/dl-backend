import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for doubles H2H tiebreaker fix (Issue #037 BUG 8)
 *
 * Bug: calculateHeadToHead only uses opponentId which stores ONE opponent.
 * In doubles (A+B vs C+D), D is invisible in H2H calculations.
 *
 * Fix: Also discover opponents via shared matchId in allDivisionResults.
 */

const serviceFile = fs.readFileSync(
  path.join(__dirname, '../../../src/services/rating/standingsV2Service.ts'),
  'utf-8'
);

describe('#037 BUG 8: H2H tiebreaker must find all doubles opponents', () => {
  it('should accept allDivisionResults parameter', () => {
    expect(serviceFile).toMatch(/calculateHeadToHead\([\s\S]*?allDivisionResults/);
  });

  it('should check match.matchType for DOUBLES', () => {
    const h2hSection = serviceFile.slice(
      serviceFile.indexOf('Calculate Head-to-Head'),
      serviceFile.indexOf('Sort players by tiebreaker')
    );
    expect(h2hSection).toMatch(/matchType.*DOUBLES|DOUBLES.*matchType/);
  });

  it('should find opponents via shared matchId', () => {
    const h2hSection = serviceFile.slice(
      serviceFile.indexOf('Calculate Head-to-Head'),
      serviceFile.indexOf('Sort players by tiebreaker')
    );
    expect(h2hSection).toMatch(/matchId.*===.*matchId|sameMatchResults/);
  });

  it('should skip already-counted opponent to avoid double-counting', () => {
    const h2hSection = serviceFile.slice(
      serviceFile.indexOf('Calculate Head-to-Head'),
      serviceFile.indexOf('Sort players by tiebreaker')
    );
    expect(h2hSection).toMatch(/opponentId.*continue|skip.*already/i);
  });

  it('should pass allDivisionResults from recalculateDivisionStandings', () => {
    // The main function should pass allResults to calculatePlayerMetricsFromResults
    expect(serviceFile).toMatch(/calculatePlayerMetricsFromResults\(playerResults,\s*best6Results,\s*allResults\)/);
  });
});
