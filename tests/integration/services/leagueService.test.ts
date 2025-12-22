/**
 * League Service Tests
 *
 * Tests for league CRUD operations and related functionality
 * Uses Dependency Injection to inject prismaTest for full integration testing.
 */

import * as leagueService from '../../../src/services/leagueService';
import { LeagueService } from '../../../src/services/leagueService';
import {
  createTestUser,
  createTestDivision,
  prismaTest,
} from '../../helpers/serviceHelpers';
import { GameType, SportType, Statuses } from '@prisma/client';

describe('LeagueService', () => {
  // Create a service instance with prismaTest injected for DI tests
  let service: LeagueService;

  beforeEach(() => {
    // Inject prismaTest for full integration testing
    service = new LeagueService(prismaTest as any);
  });

  // Generate unique suffix for this test run to avoid conflicts with previous test data
  const testSuffix = Date.now().toString();
  describe('getAllLeagues', () => {
    it('should return all leagues ordered by createdAt desc', async () => {
      // Arrange - Create multiple leagues
      await prismaTest.league.create({
        data: {
          name: 'League Alpha',
          location: 'City A',
          status: Statuses.ACTIVE,
          sportType: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
        },
      });

      await prismaTest.league.create({
        data: {
          name: 'League Beta',
          location: 'City B',
          status: Statuses.ACTIVE,
          sportType: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
        },
      });

      // Act
      const result = await leagueService.getAllLeagues();

      // Assert
      expect(result.leagues.length).toBeGreaterThanOrEqual(2);
      expect(result.totalMembers).toBeDefined();
    });

    it('should include seasons count', async () => {
      // Arrange
      const league = await prismaTest.league.create({
        data: {
          name: 'League With Season',
          location: 'City X',
          status: Statuses.ACTIVE,
          sportType: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
        },
      });

      await prismaTest.season.create({
        data: {
          name: 'Season 1',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 50,
          status: 'ACTIVE',
          isActive: true,
          leagues: { connect: { id: league.id } },
        },
      });

      // Act
      const result = await leagueService.getAllLeagues();
      const foundLeague = result.leagues.find((l: any) => l.id === league.id);

      // Assert
      expect(foundLeague).toBeDefined();
      expect(foundLeague._count.seasons).toBe(1);
    });

    it('should calculate total season memberships', async () => {
      // Arrange
      const league = await prismaTest.league.create({
        data: {
          name: 'League With Members',
          location: 'City M',
          status: Statuses.ACTIVE,
          sportType: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
        },
      });

      const season = await prismaTest.season.create({
        data: {
          name: 'Season With Members',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 50,
          status: 'ACTIVE',
          isActive: true,
          leagues: { connect: { id: league.id } },
        },
      });

      const user1 = await createTestUser({ name: 'Member 1' });
      const user2 = await createTestUser({ name: 'Member 2' });

      await prismaTest.seasonMembership.createMany({
        data: [
          { userId: user1.id, seasonId: season.id, status: 'ACTIVE' },
          { userId: user2.id, seasonId: season.id, status: 'ACTIVE' },
        ],
      });

      // Act
      const result = await leagueService.getAllLeagues();
      const foundLeague = result.leagues.find((l: any) => l.id === league.id);

      // Assert
      expect(foundLeague).toBeDefined();
      expect(foundLeague.totalSeasonMemberships).toBe(2);
    });
  });

  describe('getLeagueById', () => {
    it('should return league with all related data', async () => {
      // Arrange - Use service to create so the service can see it
      const league = await leagueService.createLeague({
        name: `Detail League ${testSuffix}`,
        location: `Detail City ${testSuffix}`,
        description: 'A detailed description',
        status: Statuses.ACTIVE,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      // Act
      const result = await leagueService.getLeagueById(league.id);

      // Assert
      expect(result.id).toBe(league.id);
      expect(result.name).toBe(`Detail League ${testSuffix}`);
      expect(result.description).toBe('A detailed description');
      expect(result.seasons).toBeDefined();
      expect(result.totalSeasonMemberships).toBe(0);
    });

    it('should throw error for non-existent league', async () => {
      // Act & Assert
      await expect(
        leagueService.getLeagueById('non-existent-id')
      ).rejects.toThrow('League with ID non-existent-id not found');
    });

    it('should include sponsorships when present', async () => {
      // Arrange
      const league = await prismaTest.league.create({
        data: {
          name: 'Sponsored League',
          location: 'Sponsor City',
          status: Statuses.ACTIVE,
          sportType: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
          sponsorships: {
            create: {
              packageTier: 'GOLD',
              contractAmount: 5000,
              sponsoredName: 'Test Sponsor',
            },
          },
        },
      });

      // Act
      const result = await leagueService.getLeagueById(league.id);

      // Assert
      expect(result.sponsorships).toBeDefined();
      expect(result.sponsorships.length).toBe(1);
      expect(result.sponsorships[0].packageTier).toBe('GOLD');
    });

    it('should include seasons with divisions', async () => {
      // Arrange
      const division = await createTestDivision();

      // Act
      const result = await leagueService.getLeagueById(division.leagueId!);

      // Assert
      expect(result.seasons).toBeDefined();
      expect(result.seasons.length).toBeGreaterThan(0);
      expect(result.seasons[0].divisions).toBeDefined();
    });
  });

  describe('createLeague', () => {
    it('should create a league with all required fields', async () => {
      // Act
      const league = await leagueService.createLeague({
        name: `New Test League ${testSuffix}`,
        location: `Test Location ${testSuffix}`,
        description: 'A new test league',
        status: Statuses.ACTIVE,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      // Assert
      expect(league).toBeDefined();
      expect(league.id).toBeDefined();
      expect(league.name).toBe(`New Test League ${testSuffix}`);
      expect(league.location).toBe(`Test Location ${testSuffix}`);
      expect(league.sportType).toBe(SportType.PICKLEBALL);
      expect(league.gameType).toBe(GameType.SINGLES);
    });

    it('should create a league with default status', async () => {
      // Act
      const league = await leagueService.createLeague({
        name: `Default Status League ${testSuffix}`,
        location: `Default Location ${testSuffix}`,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      // Assert
      expect(league.status).toBe(Statuses.UPCOMING);
    });

    it('should throw error when name is missing', async () => {
      // Act & Assert
      await expect(
        leagueService.createLeague({
          name: '', // Empty name
          sportType: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
        })
      ).rejects.toThrow('League name is required');
    });

    it('should throw error when sportType is missing', async () => {
      // Act & Assert
      await expect(
        leagueService.createLeague({
          name: `No Sport League ${testSuffix}`,
          gameType: GameType.SINGLES,
        } as any)
      ).rejects.toThrow('Sport type is required');
    });

    it('should throw error when gameType is missing', async () => {
      // Act & Assert
      await expect(
        leagueService.createLeague({
          name: `No Game Type League ${testSuffix}`,
          sportType: SportType.PICKLEBALL,
        } as any)
      ).rejects.toThrow('Game type is required');
    });

    it('should throw error for duplicate name and location', async () => {
      // Arrange - Create first league with unique name
      const uniqueName = `Duplicate League ${testSuffix}`;
      const uniqueLocation = `Same City ${testSuffix}`;

      await leagueService.createLeague({
        name: uniqueName,
        location: uniqueLocation,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      // Act & Assert - Try to create duplicate
      await expect(
        leagueService.createLeague({
          name: uniqueName,
          location: uniqueLocation,
          sportType: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
        })
      ).rejects.toThrow(`A league with name "${uniqueName}" already exists`);
    });

    it('should allow same name in different locations', async () => {
      // Arrange - Create first league
      const uniqueName = `Same Name League ${testSuffix}`;
      await leagueService.createLeague({
        name: uniqueName,
        location: `City A ${testSuffix}`,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      // Act - Create league with same name in different location
      const league = await leagueService.createLeague({
        name: uniqueName,
        location: `City B ${testSuffix}`,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      // Assert
      expect(league).toBeDefined();
      expect(league.location).toBe(`City B ${testSuffix}`);
    });

    it('should handle case-insensitive name duplicate check', async () => {
      // Arrange
      const uniqueLocation = `Case Test City ${testSuffix}`;
      await leagueService.createLeague({
        name: `Case Sensitive League ${testSuffix}`,
        location: uniqueLocation,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      // Act & Assert
      await expect(
        leagueService.createLeague({
          name: `CASE SENSITIVE LEAGUE ${testSuffix}`,
          location: uniqueLocation,
          sportType: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
        })
      ).rejects.toThrow(`A league with name "CASE SENSITIVE LEAGUE ${testSuffix}" already exists`);
    });

    it('should create league with sponsorships', async () => {
      // Act
      const league = await leagueService.createLeague({
        name: `League With Sponsors ${testSuffix}`,
        location: `Sponsor City ${testSuffix}`,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
        sponsorships: [
          {
            companyId: 'test-company',
            packageTier: 'GOLD' as any,
            contractAmount: 10000,
            sponsoredName: 'Gold Sponsor',
            startDate: new Date(),
          },
        ],
      });

      // Assert
      expect(league.sponsorships).toBeDefined();
      expect(league.sponsorships.length).toBe(1);
      expect(league.sponsorships[0].packageTier).toBe('GOLD');
    });
  });

  describe('updateLeague', () => {
    it('should update league name', async () => {
      // Arrange - Use service to create so the service can see it
      const league = await leagueService.createLeague({
        name: `Original League ${testSuffix}`,
        location: `Update City ${testSuffix}`,
        status: Statuses.ACTIVE,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      // Act
      const updated = await leagueService.updateLeague(league.id, {
        name: `Updated League ${testSuffix}`,
      });

      // Assert
      expect(updated.name).toBe(`Updated League ${testSuffix}`);
    });

    it('should update league location', async () => {
      // Arrange
      const league = await leagueService.createLeague({
        name: `Location Update League ${testSuffix}`,
        location: `Old City ${testSuffix}`,
        status: Statuses.ACTIVE,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      // Act
      const updated = await leagueService.updateLeague(league.id, {
        location: `New City ${testSuffix}`,
      });

      // Assert
      expect(updated.location).toBe(`New City ${testSuffix}`);
    });

    it('should update league description', async () => {
      // Arrange
      const league = await leagueService.createLeague({
        name: `Description Update League ${testSuffix}`,
        location: `Desc City ${testSuffix}`,
        description: 'Old description',
        status: Statuses.ACTIVE,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      // Act
      const updated = await leagueService.updateLeague(league.id, {
        description: 'New description',
      });

      // Assert
      expect(updated.description).toBe('New description');
    });

    it('should update league status', async () => {
      // Arrange
      const league = await leagueService.createLeague({
        name: `Status Update League ${testSuffix}`,
        location: `Status City ${testSuffix}`,
        status: Statuses.UPCOMING,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      // Act
      const updated = await leagueService.updateLeague(league.id, {
        status: Statuses.ACTIVE,
      });

      // Assert
      expect(updated.status).toBe(Statuses.ACTIVE);
    });

    it('should throw error for non-existent league', async () => {
      // Act & Assert
      await expect(
        leagueService.updateLeague('non-existent-id', { name: 'New Name' })
      ).rejects.toThrow('League with ID non-existent-id not found');
    });

    it('should throw error when updating to duplicate name and location', async () => {
      // Arrange - Use service to create leagues
      const uniqueLocation = `Same Location ${testSuffix}`;
      await leagueService.createLeague({
        name: `Existing League ${testSuffix}`,
        location: uniqueLocation,
        status: Statuses.ACTIVE,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      const leagueToUpdate = await leagueService.createLeague({
        name: `League to Update ${testSuffix}`,
        location: uniqueLocation,
        status: Statuses.ACTIVE,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      // Act & Assert
      await expect(
        leagueService.updateLeague(leagueToUpdate.id, {
          name: `Existing League ${testSuffix}`,
        })
      ).rejects.toThrow('A league with this name and location already exists');
    });

    it('should update multiple fields at once', async () => {
      // Arrange
      const league = await leagueService.createLeague({
        name: `Multi Update League ${testSuffix}`,
        location: `Old Multi City ${testSuffix}`,
        description: 'Old description',
        status: Statuses.UPCOMING,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      // Act
      const updated = await leagueService.updateLeague(league.id, {
        name: `Multi Updated League ${testSuffix}`,
        location: `New Multi City ${testSuffix}`,
        description: 'New description',
        status: Statuses.ACTIVE,
      });

      // Assert
      expect(updated.name).toBe(`Multi Updated League ${testSuffix}`);
      expect(updated.location).toBe(`New Multi City ${testSuffix}`);
      expect(updated.description).toBe('New description');
      expect(updated.status).toBe(Statuses.ACTIVE);
    });
  });

  describe('deleteLeague', () => {
    it('should delete a league with no seasons', async () => {
      // Arrange - Use service to create
      const league = await leagueService.createLeague({
        name: `Delete Me League ${testSuffix}`,
        location: `Delete City ${testSuffix}`,
        status: Statuses.UPCOMING,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      });

      // Act
      const deleted = await leagueService.deleteLeague(league.id);

      // Assert
      expect(deleted.id).toBe(league.id);
    });

    it('should throw error for non-existent league', async () => {
      // Act & Assert
      await expect(
        leagueService.deleteLeague('non-existent-id')
      ).rejects.toThrow('League with ID non-existent-id not found');
    });

    // Tests for league deletion with seasons using DI
    it('should throw error when league has seasons', async () => {
      // Arrange - Create league with a season using prismaTest
      const league = await prismaTest.league.create({
        data: {
          name: `League With Seasons ${testSuffix}`,
          location: `Seasons City ${testSuffix}`,
          status: Statuses.ACTIVE,
          sportType: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
        },
      });

      // Create a season linked to this league
      await prismaTest.season.create({
        data: {
          name: `Season for League ${testSuffix}`,
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 50,
          status: 'UPCOMING',
          isActive: false,
          leagues: { connect: { id: league.id } },
        },
      });

      // Act & Assert - Use DI service to try to delete league with seasons
      await expect(
        service.deleteLeague(league.id)
      ).rejects.toThrow(`Cannot delete league "${league.name}". It has 1 season(s). Please delete all seasons first.`);
    });

    it('should allow deletion after all seasons are removed', async () => {
      // Arrange - Create league with a season
      const league = await prismaTest.league.create({
        data: {
          name: `Temp League ${testSuffix}`,
          location: `Temp City ${testSuffix}`,
          status: Statuses.ACTIVE,
          sportType: SportType.PICKLEBALL,
          gameType: GameType.SINGLES,
        },
      });

      const season = await prismaTest.season.create({
        data: {
          name: `Temp Season ${testSuffix}`,
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 50,
          status: 'UPCOMING',
          isActive: false,
          leagues: { connect: { id: league.id } },
        },
      });

      // Remove the season
      await prismaTest.season.delete({ where: { id: season.id } });

      // Act - Now delete should work
      const deleted = await service.deleteLeague(league.id);

      // Assert
      expect(deleted.id).toBe(league.id);
    });

    it('should delete league with sponsorships (cascade)', async () => {
      // Arrange - Use service to create
      const league = await leagueService.createLeague({
        name: `League With Sponsor Delete ${testSuffix}`,
        location: `Sponsor Delete City ${testSuffix}`,
        status: Statuses.UPCOMING,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
        sponsorships: [
          {
            companyId: 'test-company',
            packageTier: 'SILVER' as any,
            contractAmount: 2500,
            startDate: new Date(),
          },
        ],
      });

      // Act
      const deleted = await leagueService.deleteLeague(league.id);

      // Assert
      expect(deleted.id).toBe(league.id);
    });
  });
});
