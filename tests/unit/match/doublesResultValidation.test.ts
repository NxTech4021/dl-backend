import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for doubles result validation (Issue #037 Phase 2)
 *
 * BUG 5: Score submission allows incomplete doubles teams
 * BUG 6: Walkover — no check defaulting player is on opposing team
 * BUG 7: Both partners can independently confirm/dispute
 */

const serviceFile = fs.readFileSync(
  path.join(__dirname, '../../../src/services/match/matchResultService.ts'),
  'utf-8'
);

describe('#037 BUG 5: Score submission must require all participants accepted for doubles', () => {
  it('should check participant acceptance count for doubles', () => {
    const submitSection = serviceFile.slice(
      serviceFile.indexOf('async submitResult'),
      serviceFile.indexOf('Validate and calculate scores')
    );
    // Must check that doubles matches have all participants accepted
    expect(submitSection).toMatch(/DOUBLES[\s\S]*?acceptedCount|accepted.*length.*!==\s*4|participants.*filter.*ACCEPTED/);
  });

  it('should throw error when not all 4 players accepted', () => {
    expect(serviceFile).toMatch(/All.*players.*must.*accept|participants.*must.*accept/i);
  });
});

describe('#037 BUG 6: Walkover must validate defaulting player is on opposing team', () => {
  it('should check defaulting player is NOT on the same team as reporter', () => {
    // Must prevent reporting own team member as defaulting
    expect(serviceFile).toMatch(/Cannot report a walkover for your own team/i);
  });

  it('should determine winner from defaulting player team, not reporter', () => {
    const walkoverSection = serviceFile.slice(
      serviceFile.indexOf('Determine winner'),
      serviceFile.indexOf('Get sport-specific walkover')
    );
    // Winner should be the team OPPOSING the defaulting player
    expect(walkoverSection).toMatch(/defaultingParticipant.*team|defaulting.*team/);
  });

  it('should set scores based on defaulting team, not reporter team', () => {
    // The walkover section should use winningTeam for score assignment
    // Not reporterParticipant?.team
    expect(serviceFile).toMatch(/team1Score:\s*winningTeam\s*===\s*'team1'/);
    expect(serviceFile).toMatch(/team2Score:\s*winningTeam\s*===\s*'team2'/);
  });
});

describe('#037 BUG 7: Doubles confirmation — only one confirmation per team', () => {
  it('should track which team has already confirmed', () => {
    // For doubles, should check if a teammate already confirmed/disputed
    // Must reference resultConfirmedById to check previous responder
    expect(serviceFile).toMatch(/resultConfirmedById[\s\S]*?team.*already/i);
  });

  it('should block confirmation when teammate has active dispute', () => {
    // If teammate disputed, partner should not be able to confirm
    expect(serviceFile).toMatch(/teammate.*disputed.*result|disputed this result/i);
  });
});
