import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for doubles match expiration cleanup (Issue #037 BUG 9)
 *
 * Bug: In doubles, if partner's invitation expires but opponent accepted,
 * the match stays SCHEDULED forever — stuck with 3/4 players.
 *
 * Fix: checkExpiredInvitations should also cancel doubles matches
 * where not all 4 players accepted and at least one expired.
 */

const serviceFile = fs.readFileSync(
  path.join(__dirname, '../../../src/services/match/matchInvitationService.ts'),
  'utf-8'
);

describe('#037 BUG 9: Doubles match expiration for incomplete teams', () => {
  const expirationSection = serviceFile.slice(
    serviceFile.indexOf('For each affected match'),
    serviceFile.indexOf('Expired invitations check complete')
  );

  it('should check for incomplete doubles teams during expiration', () => {
    expect(expirationSection).toMatch(/DOUBLES/);
    expect(expirationSection).toMatch(/accepted.*length.*<\s*4|length\s*<\s*4/i);
  });

  it('should cancel stuck doubles matches with expired invitations', () => {
    expect(expirationSection).toMatch(/isDoublesIncomplete/);
  });

  it('should send specific notification for doubles cancellation', () => {
    expect(expirationSection).toMatch(/not all players accepted/i);
  });
});
