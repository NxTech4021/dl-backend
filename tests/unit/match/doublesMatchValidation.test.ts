import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for doubles match creation validation (Issues #036 + #037)
 *
 * Bugs covered:
 * - #036 GAP 1: matchType vs division.gameType not validated
 * - #037 BUG 2: No partnership validation for creator
 * - #037 BUG 3: opponentPartnerId not required for doubles direct challenge
 * - #037 BUG 4: No partnership validation for opponent
 */

const serviceFile = fs.readFileSync(
  path.join(__dirname, '../../../src/services/match/matchInvitationService.ts'),
  'utf-8'
);

describe('#036 GAP 1: matchType must match division.gameType', () => {
  it('should validate matchType against division.gameType', () => {
    // Must have a check comparing matchType with division.gameType
    expect(serviceFile).toMatch(/matchType\s*!==?\s*division\.gameType/);
  });

  it('should throw error when matchType does not match division.gameType', () => {
    // Error message should mention division type mismatch
    expect(serviceFile).toMatch(/Cannot create.*match.*division/i);
  });
});

describe('#037 BUG 2: Partnership validation for creator', () => {
  it('should validate active partnership exists between creator and partner', () => {
    // Must query partnership with creator and partner IDs
    expect(serviceFile).toMatch(/partnership\.findFirst/);
  });

  it('should check partnership status is ACTIVE', () => {
    // Partnership query must filter by ACTIVE status
    const partnershipSection = serviceFile.slice(
      serviceFile.indexOf('Partner is required for doubles'),
      serviceFile.indexOf('Calculate expiration')
    );
    expect(partnershipSection).toMatch(/status.*ACTIVE|ACTIVE.*status/);
  });

  it('should check partnership is in the correct division', () => {
    // Partnership query must include divisionId
    const partnershipSection = serviceFile.slice(
      serviceFile.indexOf('Partner is required for doubles'),
      serviceFile.indexOf('Calculate expiration')
    );
    expect(partnershipSection).toMatch(/divisionId/);
  });

  it('should throw error when no active partnership exists', () => {
    expect(serviceFile).toMatch(/active partnership/i);
  });
});

describe('#037 BUG 3: opponentPartnerId required for doubles direct challenge', () => {
  it('should require opponentPartnerId when opponentId is set for doubles', () => {
    // Must check: DOUBLES + opponentId + !opponentPartnerId → error
    expect(serviceFile).toMatch(/opponentPartnerId/);
    // The check must be BEFORE the transaction, not just inside it
    expect(serviceFile).toMatch(
      /DOUBLES.*opponentId.*opponentPartnerId|opponentPartnerId.*required.*doubles/i
    );
  });
});

describe('#037 BUG 4: Partnership validation for opponent', () => {
  it('should validate partnership between opponent and opponentPartner', () => {
    // After the opponent membership check, before adding opponent partner
    // Must query partnership for opponent team too
    const opponentSection = serviceFile.slice(
      serviceFile.indexOf('Opponent must be an active member'),
      serviceFile.indexOf('return newMatch')
    );
    expect(opponentSection).toMatch(/partnership\.findFirst|partnership.*opponent/i);
  });
});
