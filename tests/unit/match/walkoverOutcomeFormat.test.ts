import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for walkover outcome format (Issue #038 BUG 1)
 *
 * Bug: outcome is set to "Walkover - NO_SHOW" instead of "team1"/"team2"
 * Match history service compares outcome === userTeam → walkover wins show as losses
 *
 * Fix: Use winningTeam as outcome value. Walkover reason is already
 * stored separately in walkoverReason field.
 */

const serviceFile = fs.readFileSync(
  path.join(__dirname, '../../../src/services/match/matchResultService.ts'),
  'utf-8'
);

describe('#038 BUG 1: Walkover outcome must use team format', () => {
  it('should NOT set outcome to "Walkover - reason" string', () => {
    // The walkover section should not have outcome: `Walkover - ${reason}`
    expect(serviceFile).not.toMatch(/outcome:\s*`Walkover\s*-\s*\$\{reason\}`/);
  });

  it('should set outcome to winningTeam', () => {
    // outcome should reference winningTeam variable (which is "team1" or "team2")
    // Find the walkover section specifically (not the first "Notify participants")
    const walkoverStart = serviceFile.indexOf('Update match to WALKOVER_PENDING');
    const walkoverEnd = serviceFile.indexOf('Notify participants', walkoverStart);
    const walkoverSection = serviceFile.slice(walkoverStart, walkoverEnd);
    expect(walkoverSection).toMatch(/outcome.*winningTeam/);
  });
});
