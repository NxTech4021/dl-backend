/**
 * Match API Contract Tests
 *
 * Tests for match-related HTTP endpoints to ensure API contracts
 * are maintained and responses match expected formats.
 */

import {
  testApp,
  apiUrl,
  prismaTest,
  createTestUser,
  createTestDivision,
  expectSuccess,
  expect404,
} from './helpers/testApp';

describe('Match API Endpoints', () => {
  describe('GET /matches/:id', () => {
    it('should return 404 for non-existent match', async () => {
      const res = await testApp.get(apiUrl('/matches/non-existent-id'));
      expect404(res);
    });

    it('should return match details with correct structure', async () => {
      // Arrange - Create a test match
      const user = await createTestUser();
      const division = await createTestDivision();

      const match = await prismaTest.match.create({
        data: {
          createdById: user.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          matchDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'SCHEDULED',
          matchType: 'SINGLES',
          isFriendly: false,
          participants: {
            create: {
              userId: user.id,
              team: 1,
              role: 'CAPTAIN',
              invitationStatus: 'ACCEPTED',
            },
          },
        },
      });

      // Act
      const res = await testApp.get(apiUrl(`/matches/${match.id}`));

      // Assert - Verify response structure
      expectSuccess(res);
      expect(res.body).toHaveProperty('id', match.id);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('matchType');
      expect(res.body).toHaveProperty('matchDate');
    });
  });

  describe('GET /matches/user/:userId', () => {
    it('should return empty array for user with no matches', async () => {
      const user = await createTestUser();

      const res = await testApp.get(apiUrl(`/matches/user/${user.id}`));

      expectSuccess(res);
      expect(res.body).toHaveProperty('matches');
      expect(Array.isArray(res.body.matches)).toBe(true);
    });

    it('should return paginated results', async () => {
      const user = await createTestUser();

      const res = await testApp
        .get(apiUrl(`/matches/user/${user.id}`))
        .query({ page: 1, limit: 10 });

      expectSuccess(res);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toHaveProperty('page');
      expect(res.body.pagination).toHaveProperty('limit');
      expect(res.body.pagination).toHaveProperty('total');
    });
  });

  describe('GET /matches/upcoming', () => {
    it('should return upcoming matches with correct format', async () => {
      const res = await testApp.get(apiUrl('/matches/upcoming'));

      expectSuccess(res);
      expect(res.body).toHaveProperty('matches');
      expect(Array.isArray(res.body.matches)).toBe(true);
    });
  });
});

describe('Match API Response Contract', () => {
  it('should include all required fields in match response', async () => {
    // This test verifies the API contract - the exact fields that clients expect
    const user = await createTestUser();
    const division = await createTestDivision();

    const match = await prismaTest.match.create({
      data: {
        createdById: user.id,
        seasonId: division.seasonId!,
        divisionId: division.id,
        matchDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'SCHEDULED',
        matchType: 'SINGLES',
        isFriendly: false,
        participants: {
          create: {
            userId: user.id,
            team: 1,
            role: 'CAPTAIN',
            invitationStatus: 'ACCEPTED',
          },
        },
      },
    });

    const res = await testApp.get(apiUrl(`/matches/${match.id}`));

    // Contract assertions - these fields must exist
    const requiredFields = [
      'id',
      'status',
      'matchType',
      'matchDate',
      'createdById',
      'isFriendly',
    ];

    requiredFields.forEach((field) => {
      expect(res.body).toHaveProperty(field);
    });
  });

  it('should return proper error format for validation errors', async () => {
    // When creating a match with invalid data, error should be structured
    const res = await testApp
      .post(apiUrl('/matches'))
      .send({
        // Missing required fields
      });

    // Error responses should have a consistent format
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error');
  });
});
