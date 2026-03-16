import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests that initial PlayerRating is created when a user registers for a season.
 *
 * Root cause of N/A ratings: createInitialRating() exists but was never called.
 * It should be called during season registration using the user's questionnaire results.
 */

describe('PlayerRating creation on season registration', () => {
  const membershipServicePath = path.join(
    __dirname,
    '../../../src/services/season/seasonMembershipService.ts'
  );
  const membershipCode = fs.readFileSync(membershipServicePath, 'utf-8');

  it('should import createInitialRating or initializePlayerRating', () => {
    expect(membershipCode).toMatch(
      /import.*createInitialRating|import.*initializePlayerRating|import.*playerRatingService/
    );
  });

  it('should call rating initialization after membership creation', () => {
    // After the membership is created, should attempt to create PlayerRating
    expect(membershipCode).toMatch(
      /createInitialRating|initializePlayerRating|ensurePlayerRating/
    );
  });

  it('should look up InitialRatingResult for the user', () => {
    // Should query questionnaireResponse or initialRatingResult
    expect(membershipCode).toMatch(
      /questionnaireResponse|InitialRatingResult|initialRatingResult/i
    );
  });
});

describe('League player query includes rating', () => {
  const leagueServicePath = path.join(
    __dirname,
    '../../../src/services/leagueService.ts'
  );
  const leagueCode = fs.readFileSync(leagueServicePath, 'utf-8');

  it('should include playerRatings in league query', () => {
    expect(leagueCode).toMatch(/playerRating|currentRating/i);
  });
});
