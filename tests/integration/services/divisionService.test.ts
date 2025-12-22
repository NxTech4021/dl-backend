/**
 * Division Service Tests
 *
 * Tests for division creation, update, and deletion functionality
 * Uses Dependency Injection to inject prismaTest for full integration testing.
 */

import * as divisionService from '../../../src/services/divisionService';
import { DivisionService } from '../../../src/services/divisionService';
import {
  createTestUser,
  createTestDivision,
  prismaTest,
} from '../../helpers/serviceHelpers';
import { GameType, DivisionLevel, GenderType } from '@prisma/client';

describe('DivisionService', () => {
  // Create a service instance with prismaTest injected for DI tests
  let service: DivisionService;

  beforeEach(() => {
    // Inject prismaTest for full integration testing
    service = new DivisionService(prismaTest as any);
  });

  describe('createDivision', () => {
    it('should create a division with all required fields', async () => {
      // Arrange - Create a season with league
      const league = await prismaTest.league.create({
        data: {
          name: 'Test League for Division',
          location: 'Test City',
          status: 'ACTIVE',
          sportType: 'PICKLEBALL',
          gameType: GameType.SINGLES,
        },
      });

      const season = await prismaTest.season.create({
        data: {
          name: 'Test Season',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          entryFee: 50,
          status: 'ACTIVE',
          isActive: true,
          leagues: {
            connect: { id: league.id },
          },
        },
      });

      // Act
      const division = await divisionService.createDivision({
        name: 'Division A',
        description: 'Test division description',
        seasonId: season.id,
        gameType: GameType.SINGLES,
        level: DivisionLevel.BEGINNER,
        genderCategory: GenderType.MIXED,
        maxSinglesPlayers: 16,
      });

      // Assert
      expect(division).toBeDefined();
      expect(division.id).toBeDefined();
      expect(division.name).toBe('Division A');
      expect(division.description).toBe('Test division description');
      expect(division.seasonId).toBe(season.id);
      expect(division.leagueId).toBe(league.id);
      expect(division.gameType).toBe(GameType.SINGLES);
      expect(division.level).toBe(DivisionLevel.BEGINNER);
      expect(division.genderCategory).toBe(GenderType.MIXED);
      expect(division.maxSinglesPlayers).toBe(16);
    });

    it('should create a division with minimal required fields', async () => {
      // Arrange
      const league = await prismaTest.league.create({
        data: {
          name: 'Minimal League',
          location: 'Test City',
          status: 'ACTIVE',
          sportType: 'PICKLEBALL',
          gameType: GameType.SINGLES,
        },
      });

      const season = await prismaTest.season.create({
        data: {
          name: 'Minimal Season',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 0,
          status: 'ACTIVE',
          isActive: true,
          leagues: {
            connect: { id: league.id },
          },
        },
      });

      // Act
      const division = await divisionService.createDivision({
        name: 'Minimal Division',
        seasonId: season.id,
        gameType: GameType.SINGLES,
      });

      // Assert
      expect(division).toBeDefined();
      expect(division.name).toBe('Minimal Division');
      expect(division.description).toBeNull();
      expect(division.level).toBeNull();
      expect(division.genderCategory).toBeNull();
      expect(division.pointsThreshold).toBeNull();
    });

    it('should throw error if season does not exist', async () => {
      // Act & Assert
      await expect(
        divisionService.createDivision({
          name: 'Division X',
          seasonId: 'non-existent-season-id',
          gameType: GameType.SINGLES,
        })
      ).rejects.toThrow('Season with ID non-existent-season-id not found');
    });

    // Test using DI - now we can see the orphan season
    it('should throw error if season is not linked to any league', async () => {
      // Arrange - Create a season WITHOUT any league connection
      const orphanSeason = await prismaTest.season.create({
        data: {
          name: 'Orphan Season',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 50,
          status: 'ACTIVE',
          isActive: true,
          // No leagues connection
        },
      });

      // Act & Assert - Use DI service to test
      await expect(
        service.createDivision({
          name: 'Division X',
          seasonId: orphanSeason.id,
          gameType: GameType.SINGLES,
        })
      ).rejects.toThrow('Season is not linked to any league.');
    });

    it('should throw error if division name already exists in the same season', async () => {
      // Arrange
      const division = await createTestDivision({ name: 'Duplicate Division' });

      // Act & Assert
      await expect(
        divisionService.createDivision({
          name: 'Duplicate Division',
          seasonId: division.seasonId!,
          gameType: GameType.SINGLES,
        })
      ).rejects.toThrow('A division with name "Duplicate Division" already exists in this season');
    });

    it('should allow same division name in different seasons', async () => {
      // Arrange - Create two leagues with seasons
      const league1 = await prismaTest.league.create({
        data: {
          name: 'League 1',
          location: 'City 1',
          status: 'ACTIVE',
          sportType: 'PICKLEBALL',
          gameType: GameType.SINGLES,
        },
      });

      const league2 = await prismaTest.league.create({
        data: {
          name: 'League 2',
          location: 'City 2',
          status: 'ACTIVE',
          sportType: 'PICKLEBALL',
          gameType: GameType.SINGLES,
        },
      });

      const season1 = await prismaTest.season.create({
        data: {
          name: 'Season 1',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 0,
          status: 'ACTIVE',
          isActive: true,
          leagues: { connect: { id: league1.id } },
        },
      });

      const season2 = await prismaTest.season.create({
        data: {
          name: 'Season 2',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 0,
          status: 'ACTIVE',
          isActive: true,
          leagues: { connect: { id: league2.id } },
        },
      });

      // Act - Create divisions with same name in different seasons
      const division1 = await divisionService.createDivision({
        name: 'Division A',
        seasonId: season1.id,
        gameType: GameType.SINGLES,
      });

      const division2 = await divisionService.createDivision({
        name: 'Division A',
        seasonId: season2.id,
        gameType: GameType.SINGLES,
      });

      // Assert
      expect(division1.name).toBe('Division A');
      expect(division2.name).toBe('Division A');
      expect(division1.seasonId).not.toBe(division2.seasonId);
    });

    it('should handle case-insensitive name uniqueness check', async () => {
      // Arrange
      const division = await createTestDivision({ name: 'Test Division' });

      // Act & Assert - Try creating with different case
      await expect(
        divisionService.createDivision({
          name: 'TEST DIVISION',
          seasonId: division.seasonId!,
          gameType: GameType.SINGLES,
        })
      ).rejects.toThrow('A division with name "TEST DIVISION" already exists in this season');
    });

    it('should create doubles division with maxDoublesTeams', async () => {
      // Arrange
      const league = await prismaTest.league.create({
        data: {
          name: 'Doubles League',
          location: 'Test City',
          status: 'ACTIVE',
          sportType: 'PICKLEBALL',
          gameType: GameType.DOUBLES,
        },
      });

      const season = await prismaTest.season.create({
        data: {
          name: 'Doubles Season',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 0,
          status: 'ACTIVE',
          isActive: true,
          leagues: { connect: { id: league.id } },
        },
      });

      // Act
      const division = await divisionService.createDivision({
        name: 'Doubles Division A',
        seasonId: season.id,
        gameType: GameType.DOUBLES,
        maxDoublesTeams: 8,
      });

      // Assert
      expect(division.gameType).toBe(GameType.DOUBLES);
      expect(division.maxDoublesTeams).toBe(8);
    });
  });

  describe('updateDivision', () => {
    it('should update division name', async () => {
      // Arrange
      const division = await createTestDivision({ name: 'Original Name' });

      // Act
      const updated = await divisionService.updateDivision(division.id, {
        name: 'Updated Name',
      });

      // Assert
      expect(updated.name).toBe('Updated Name');
    });

    it('should update division description', async () => {
      // Arrange
      const division = await createTestDivision({ description: 'Original description' });

      // Act
      const updated = await divisionService.updateDivision(division.id, {
        description: 'Updated description',
      });

      // Assert
      expect(updated.description).toBe('Updated description');
    });

    it('should update points threshold', async () => {
      // Arrange
      const division = await createTestDivision();

      // Act
      const updated = await divisionService.updateDivision(division.id, {
        pointsThreshold: 1000,
      });

      // Assert
      expect(updated.pointsThreshold).toBe(1000);
    });

    it('should update maxSinglesPlayers for singles division', async () => {
      // Arrange
      const division = await createTestDivision({
        gameType: GameType.SINGLES,
        maxSinglesPlayers: 16,
      });

      // Act
      const updated = await divisionService.updateDivision(division.id, {
        maxSinglesPlayers: 24,
      });

      // Assert
      expect(updated.maxSinglesPlayers).toBe(24);
    });

    it('should update maxDoublesTeams for doubles division', async () => {
      // Arrange
      const league = await prismaTest.league.create({
        data: {
          name: 'Update Doubles League',
          location: 'Test City',
          status: 'ACTIVE',
          sportType: 'PICKLEBALL',
          gameType: GameType.DOUBLES,
        },
      });

      const season = await prismaTest.season.create({
        data: {
          name: 'Update Doubles Season',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 0,
          status: 'ACTIVE',
          isActive: true,
          leagues: { connect: { id: league.id } },
        },
      });

      const division = await prismaTest.division.create({
        data: {
          name: 'Doubles Division',
          seasonId: season.id,
          leagueId: league.id,
          gameType: GameType.DOUBLES,
          maxDoublesTeams: 8,
        },
      });

      // Act
      const updated = await divisionService.updateDivision(division.id, {
        maxDoublesTeams: 12,
      });

      // Assert
      expect(updated.maxDoublesTeams).toBe(12);
    });

    it('should throw error if division does not exist', async () => {
      // Act & Assert
      await expect(
        divisionService.updateDivision('non-existent-id', { name: 'New Name' })
      ).rejects.toThrow('Division with ID non-existent-id not found');
    });

    it('should throw error if updating name to duplicate in same season', async () => {
      // Arrange
      const league = await prismaTest.league.create({
        data: {
          name: 'Duplicate Check League',
          location: 'Test City',
          status: 'ACTIVE',
          sportType: 'PICKLEBALL',
          gameType: GameType.SINGLES,
        },
      });

      const season = await prismaTest.season.create({
        data: {
          name: 'Duplicate Check Season',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 0,
          status: 'ACTIVE',
          isActive: true,
          leagues: { connect: { id: league.id } },
        },
      });

      const division1 = await prismaTest.division.create({
        data: {
          name: 'Division A',
          seasonId: season.id,
          leagueId: league.id,
          gameType: GameType.SINGLES,
        },
      });

      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: season.id,
          leagueId: league.id,
          gameType: GameType.SINGLES,
        },
      });

      // Act & Assert
      await expect(
        divisionService.updateDivision(division2.id, { name: 'Division A' })
      ).rejects.toThrow('A division with name "Division A" already exists in this season');
    });

    it('should allow updating to same name (no change)', async () => {
      // Arrange
      const division = await createTestDivision({ name: 'Keep This Name' });

      // Act
      const updated = await divisionService.updateDivision(division.id, {
        name: 'Keep This Name',
      });

      // Assert
      expect(updated.name).toBe('Keep This Name');
    });

    it('should throw error when reducing capacity below current count', async () => {
      // Arrange - Create division with members
      const division = await createTestDivision({
        gameType: GameType.SINGLES,
        maxSinglesPlayers: 16,
      });

      // Add some members to increase currentSinglesCount
      const user1 = await createTestUser({ name: 'Member 1' });
      const user2 = await createTestUser({ name: 'Member 2' });
      const user3 = await createTestUser({ name: 'Member 3' });

      await prismaTest.seasonMembership.createMany({
        data: [
          { userId: user1.id, seasonId: division.seasonId!, divisionId: division.id, status: 'ACTIVE' },
          { userId: user2.id, seasonId: division.seasonId!, divisionId: division.id, status: 'ACTIVE' },
          { userId: user3.id, seasonId: division.seasonId!, divisionId: division.id, status: 'ACTIVE' },
        ],
      });

      // Update the currentSinglesCount
      await prismaTest.division.update({
        where: { id: division.id },
        data: { currentSinglesCount: 3 },
      });

      // Act & Assert
      await expect(
        divisionService.updateDivision(division.id, { maxSinglesPlayers: 2 })
      ).rejects.toThrow('Cannot reduce capacity below current assignment count (3)');
    });

    it('should update multiple fields at once', async () => {
      // Arrange
      const division = await createTestDivision({
        name: 'Original',
        description: 'Original description',
      });

      // Act
      const updated = await divisionService.updateDivision(division.id, {
        name: 'Updated',
        description: 'Updated description',
        pointsThreshold: 500,
      });

      // Assert
      expect(updated.name).toBe('Updated');
      expect(updated.description).toBe('Updated description');
      expect(updated.pointsThreshold).toBe(500);
    });

    it('should handle case-insensitive name uniqueness check on update', async () => {
      // Arrange
      const league = await prismaTest.league.create({
        data: {
          name: 'Case Check League',
          location: 'Test City',
          status: 'ACTIVE',
          sportType: 'PICKLEBALL',
          gameType: GameType.SINGLES,
        },
      });

      const season = await prismaTest.season.create({
        data: {
          name: 'Case Check Season',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 0,
          status: 'ACTIVE',
          isActive: true,
          leagues: { connect: { id: league.id } },
        },
      });

      await prismaTest.division.create({
        data: {
          name: 'Division Alpha',
          seasonId: season.id,
          leagueId: league.id,
          gameType: GameType.SINGLES,
        },
      });

      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division Beta',
          seasonId: season.id,
          leagueId: league.id,
          gameType: GameType.SINGLES,
        },
      });

      // Act & Assert
      await expect(
        divisionService.updateDivision(division2.id, { name: 'DIVISION ALPHA' })
      ).rejects.toThrow('A division with name "DIVISION ALPHA" already exists in this season');
    });
  });

  describe('deleteDivision', () => {
    it('should delete a division with no members', async () => {
      // Arrange
      const division = await createTestDivision();

      // Act
      const deleted = await divisionService.deleteDivision(division.id);

      // Assert
      expect(deleted.id).toBe(division.id);

      // Verify it's actually deleted
      const found = await prismaTest.division.findUnique({
        where: { id: division.id },
      });
      expect(found).toBeNull();
    });

    it('should throw error when trying to delete division with members', async () => {
      // Arrange
      const division = await createTestDivision();
      const user = await createTestUser();

      await prismaTest.seasonMembership.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          status: 'ACTIVE',
        },
      });

      // Act & Assert
      await expect(divisionService.deleteDivision(division.id)).rejects.toThrow(
        'Cannot delete division: 1 member(s) are assigned to this division'
      );
    });

    it('should throw error when trying to delete division with multiple members', async () => {
      // Arrange
      const division = await createTestDivision();
      const user1 = await createTestUser({ name: 'Member 1' });
      const user2 = await createTestUser({ name: 'Member 2' });
      const user3 = await createTestUser({ name: 'Member 3' });

      await prismaTest.seasonMembership.createMany({
        data: [
          { userId: user1.id, seasonId: division.seasonId!, divisionId: division.id, status: 'ACTIVE' },
          { userId: user2.id, seasonId: division.seasonId!, divisionId: division.id, status: 'ACTIVE' },
          { userId: user3.id, seasonId: division.seasonId!, divisionId: division.id, status: 'ACTIVE' },
        ],
      });

      // Act & Assert
      await expect(divisionService.deleteDivision(division.id)).rejects.toThrow(
        'Cannot delete division: 3 member(s) are assigned to this division'
      );
    });

    it('should allow deletion after all members are removed', async () => {
      // Arrange
      const division = await createTestDivision();
      const user = await createTestUser();

      const membership = await prismaTest.seasonMembership.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          divisionId: division.id,
          status: 'ACTIVE',
        },
      });

      // Remove the membership
      await prismaTest.seasonMembership.delete({
        where: { id: membership.id },
      });

      // Act
      const deleted = await divisionService.deleteDivision(division.id);

      // Assert
      expect(deleted.id).toBe(division.id);
    });
  });
});
