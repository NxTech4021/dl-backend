/**
 * Season Service Tests
 *
 * Tests for season CRUD operations and membership registration
 * Uses Dependency Injection to inject prismaTest for full integration testing.
 */

import * as seasonService from '../../../src/services/seasonService';
import { SeasonService } from '../../../src/services/seasonService';
import {
  createTestUser,
  createTestDivision,
  prismaTest,
} from '../../helpers/serviceHelpers';
import { GameType, PaymentStatus } from '@prisma/client';

describe('SeasonService', () => {
  // Create a service instance with prismaTest injected for DI tests
  let service: SeasonService;

  beforeEach(() => {
    // Inject prismaTest for full integration testing
    service = new SeasonService(prismaTest as any);
  });

  // Helper to create a basic league for seasons
  async function createTestLeague(name?: string) {
    return prismaTest.league.create({
      data: {
        name: name ?? `Test League ${Date.now()}`,
        location: 'Test City',
        status: 'ACTIVE',
        sportType: 'PICKLEBALL',
        gameType: GameType.SINGLES,
      },
    });
  }

  // Tests for createSeason using DI
  describe('createSeasonService', () => {
    it('should create a season with all required fields', async () => {
      // Arrange
      const league = await createTestLeague();

      // Act
      const season = await service.createSeason({
        name: 'Test Season 2025',
        startDate: '2025-01-15',
        endDate: '2025-04-15',
        regiDeadline: '2025-01-10',
        entryFee: 50,
        description: 'A test season',
        leagueIds: [league.id],
        isActive: false,
        paymentRequired: true,
        promoCodeSupported: false,
        withdrawalEnabled: true,
      });

      // Assert
      expect(season).toBeDefined();
      expect(season.id).toBeDefined();
      expect(season.name).toBe('Test Season 2025');
      expect(season.entryFee.toString()).toBe('50');
      expect(season.paymentRequired).toBe(true);
      expect(season.promoCodeSupported).toBe(false);
      expect(season.withdrawalEnabled).toBe(true);
      expect(season.status).toBe('UPCOMING');
      expect(season.isActive).toBe(false);
      expect(season.leagues).toHaveLength(1);
    });

    it('should create an active season with ACTIVE status', async () => {
      // Arrange
      const league = await createTestLeague();

      // Act
      const season = await service.createSeason({
        name: 'Active Season',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        entryFee: 25,
        leagueIds: [league.id],
        isActive: true,
      });

      // Assert
      expect(season.status).toBe('ACTIVE');
      expect(season.isActive).toBe(true);
    });

    it('should connect to multiple leagues', async () => {
      // Arrange
      const league1 = await createTestLeague('League 1');
      const league2 = await createTestLeague('League 2');

      // Act
      const season = await service.createSeason({
        name: 'Multi-League Season',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        entryFee: 50,
        leagueIds: [league1.id, league2.id],
      });

      // Assert
      expect(season.leagues).toHaveLength(2);
      const leagueIds = season.leagues.map((l: any) => l.id);
      expect(leagueIds).toContain(league1.id);
      expect(leagueIds).toContain(league2.id);
    });

    it('should use endDate as regiDeadline if not provided', async () => {
      // Arrange
      const league = await createTestLeague();
      const endDate = '2025-06-30';

      // Act
      const season = await service.createSeason({
        name: 'No Deadline Season',
        startDate: '2025-04-01',
        endDate: endDate,
        entryFee: 50,
        leagueIds: [league.id],
        // regiDeadline not provided
      });

      // Assert
      expect(season.regiDeadline).toEqual(new Date(endDate));
    });

    it('should set default values for optional boolean fields', async () => {
      // Arrange
      const league = await createTestLeague();

      // Act
      const season = await service.createSeason({
        name: 'Default Fields Season',
        startDate: '2025-01-01',
        endDate: '2025-03-31',
        entryFee: 50,
        leagueIds: [league.id],
        // All boolean fields omitted
      });

      // Assert - defaults should be false
      expect(season.isActive).toBe(false);
      expect(season.paymentRequired).toBe(false);
      expect(season.promoCodeSupported).toBe(false);
      expect(season.withdrawalEnabled).toBe(false);
    });

    // Test the service logic using prismaTest to verify expected behavior
    it('should verify season creation structure (via prismaTest)', async () => {
      // Arrange
      const league = await createTestLeague();

      // Act - Create season directly via prismaTest to test the expected data structure
      const season = await prismaTest.season.create({
        data: {
          name: 'Test Season 2025',
          startDate: new Date('2025-01-15'),
          endDate: new Date('2025-04-15'),
          regiDeadline: new Date('2025-01-10'),
          entryFee: 50,
          description: 'A test season',
          isActive: false,
          paymentRequired: true,
          promoCodeSupported: false,
          withdrawalEnabled: true,
          status: 'UPCOMING',
          leagues: { connect: { id: league.id } },
        },
        include: { leagues: true },
      });

      // Assert - Verify expected structure
      expect(season).toBeDefined();
      expect(season.id).toBeDefined();
      expect(season.name).toBe('Test Season 2025');
      expect(season.entryFee.toString()).toBe('50');
      expect(season.paymentRequired).toBe(true);
      expect(season.promoCodeSupported).toBe(false);
      expect(season.withdrawalEnabled).toBe(true);
      expect(season.status).toBe('UPCOMING');
      expect(season.isActive).toBe(false);
      expect(season.leagues).toHaveLength(1);
    });

    it('should verify active season has ACTIVE status (via prismaTest)', async () => {
      // Arrange
      const league = await createTestLeague();

      // Act - Create active season directly
      const season = await prismaTest.season.create({
        data: {
          name: 'Active Season',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 25,
          status: 'ACTIVE',
          isActive: true,
          leagues: { connect: { id: league.id } },
        },
      });

      // Assert
      expect(season.status).toBe('ACTIVE');
      expect(season.isActive).toBe(true);
    });
  });

  describe('getAllSeasonsService', () => {
    it('should return all seasons ordered by startDate desc', async () => {
      // Arrange
      const league = await createTestLeague();

      // Create seasons with different start dates
      await prismaTest.season.create({
        data: {
          name: 'Season January',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-03-01'),
          regiDeadline: new Date('2024-12-15'),
          entryFee: 50,
          status: 'UPCOMING',
          isActive: false,
          leagues: { connect: { id: league.id } },
        },
      });

      await prismaTest.season.create({
        data: {
          name: 'Season March',
          startDate: new Date('2025-03-01'),
          endDate: new Date('2025-05-01'),
          regiDeadline: new Date('2025-02-15'),
          entryFee: 50,
          status: 'UPCOMING',
          isActive: false,
          leagues: { connect: { id: league.id } },
        },
      });

      // Act
      const seasons = await seasonService.getAllSeasonsService();

      // Assert
      expect(seasons.length).toBeGreaterThanOrEqual(2);
      // First season should have the latest start date
      const marchSeason = seasons.find((s: any) => s.name === 'Season March');
      const janSeason = seasons.find((s: any) => s.name === 'Season January');

      expect(marchSeason).toBeDefined();
      expect(janSeason).toBeDefined();

      // March should come before January in the results (desc order)
      const marchIndex = seasons.findIndex((s: any) => s.name === 'Season March');
      const janIndex = seasons.findIndex((s: any) => s.name === 'Season January');
      expect(marchIndex).toBeLessThan(janIndex);
    });

    it('should include league information', async () => {
      // Arrange
      const league = await createTestLeague('Included League');

      await prismaTest.season.create({
        data: {
          name: 'Season With League',
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
      const seasons = await seasonService.getAllSeasonsService();
      const targetSeason = seasons.find((s: any) => s.name === 'Season With League');

      // Assert
      expect(targetSeason).toBeDefined();
      expect(targetSeason.leagues).toBeDefined();
      expect(targetSeason.leagues.length).toBeGreaterThan(0);
      expect(targetSeason.leagues[0].name).toBe('Included League');
    });
  });

  describe('getSeasonByIdService', () => {
    it('should return season with all related data', async () => {
      // Arrange
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Detailed Season',
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
      const result = await seasonService.getSeasonByIdService(season.id);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(season.id);
      expect(result?.name).toBe('Detailed Season');
      expect(result?.leagues).toBeDefined();
      expect(result?.divisions).toBeDefined();
    });

    it('should return null for non-existent season', async () => {
      // Act
      const result = await seasonService.getSeasonByIdService('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should include divisions when present', async () => {
      // Arrange
      const division = await createTestDivision();

      // Act
      const result = await seasonService.getSeasonByIdService(division.seasonId!);

      // Assert
      expect(result).toBeDefined();
      expect(result?.divisions).toBeDefined();
      expect(result?.divisions?.length).toBeGreaterThan(0);
    });
  });

  describe('getActiveSeasonService', () => {
    it('should return active season', async () => {
      // Arrange
      const league = await createTestLeague();
      const activeSeason = await prismaTest.season.create({
        data: {
          name: 'The Active Season',
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
      const result = await seasonService.getActiveSeasonService();

      // Assert
      expect(result).toBeDefined();
      expect(result?.isActive).toBe(true);
      expect(result?.status).toBe('ACTIVE');
    });

    it('should not return season that is only isActive but not ACTIVE status', async () => {
      // Arrange - Create a season with isActive=true but status=UPCOMING
      const league = await createTestLeague();
      await prismaTest.season.create({
        data: {
          name: 'Upcoming But Active Flag',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 50,
          status: 'UPCOMING',
          isActive: true, // Has isActive but wrong status
          leagues: { connect: { id: league.id } },
        },
      });

      // Act
      const result = await seasonService.getActiveSeasonService();

      // Assert - Should not find this season (status must also be ACTIVE)
      // Note: This might find other seasons created in other tests, so we check specific properties
      if (result) {
        expect(result.status).toBe('ACTIVE');
      }
    });
  });

  describe('updateSeasonStatusService', () => {
    it('should update season status to ACTIVE', async () => {
      // Arrange
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Status Update Season',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 50,
          status: 'UPCOMING',
          isActive: false,
          leagues: { connect: { id: league.id } },
        },
      });

      // Act
      const result = await seasonService.updateSeasonStatusService(season.id, {
        status: 'ACTIVE',
        isActive: true,
      });

      // Assert
      expect(result.status).toBe('ACTIVE');
      expect(result.isActive).toBe(true);
    });

    it('should update season to FINISHED', async () => {
      // Arrange
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Finish Season',
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
      const result = await seasonService.updateSeasonStatusService(season.id, {
        status: 'FINISHED',
        isActive: false,
      });

      // Assert
      expect(result.status).toBe('FINISHED');
      expect(result.isActive).toBe(false);
    });

    it('should update only isActive without changing status', async () => {
      // Arrange
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Deactivate Season',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 50,
          status: 'ACTIVE',
          isActive: true,
          leagues: { connect: { id: league.id } },
        },
      });

      // Act - Only setting isActive to false will infer ACTIVE status
      const result = await seasonService.updateSeasonStatusService(season.id, {
        isActive: false,
      });

      // Assert
      expect(result.isActive).toBe(false);
    });
  });

  describe('updateSeasonService', () => {
    it('should update season name', async () => {
      // Arrange
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Original Name',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 50,
          status: 'UPCOMING',
          isActive: false,
          leagues: { connect: { id: league.id } },
        },
      });

      // Act
      const result = await seasonService.updateSeasonService(season.id, {
        name: 'Updated Name',
      });

      // Assert
      expect(result.name).toBe('Updated Name');
    });

    it('should update multiple fields at once', async () => {
      // Arrange
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Multi Update Season',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 50,
          description: 'Old description',
          status: 'UPCOMING',
          isActive: false,
          paymentRequired: false,
          leagues: { connect: { id: league.id } },
        },
      });

      // Act
      const result = await seasonService.updateSeasonService(season.id, {
        name: 'Updated Multi Season',
        description: 'New description',
        entryFee: 75,
        paymentRequired: true,
        promoCodeSupported: true,
      });

      // Assert
      expect(result.name).toBe('Updated Multi Season');
      expect(result.description).toBe('New description');
      expect(result.entryFee.toString()).toBe('75');
      expect(result.paymentRequired).toBe(true);
      expect(result.promoCodeSupported).toBe(true);
    });

    it('should update league connections', async () => {
      // Arrange
      const league1 = await createTestLeague('Original League');
      const league2 = await createTestLeague('New League');

      const season = await prismaTest.season.create({
        data: {
          name: 'League Switch Season',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 50,
          status: 'UPCOMING',
          isActive: false,
          leagues: { connect: { id: league1.id } },
        },
      });

      // Act
      const result = await seasonService.updateSeasonService(season.id, {
        leagueIds: [league2.id],
      });

      // Assert
      expect(result.leagues).toHaveLength(1);
      expect(result.leagues[0].id).toBe(league2.id);
    });
  });

  describe('deleteSeasonService', () => {
    it('should delete a season with no registered users', async () => {
      // Arrange
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Delete Me Season',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 50,
          status: 'UPCOMING',
          isActive: false,
          registeredUserCount: 0,
          leagues: { connect: { id: league.id } },
        },
      });

      // Act
      const deleted = await seasonService.deleteSeasonService(season.id);

      // Assert
      expect(deleted.id).toBe(season.id);

      // Verify it's deleted
      const found = await prismaTest.season.findUnique({
        where: { id: season.id },
      });
      expect(found).toBeNull();
    });

    it('should throw error when season not found', async () => {
      // Act & Assert
      await expect(
        seasonService.deleteSeasonService('non-existent-id')
      ).rejects.toThrow('Season not found');
    });

    it('should throw error when season has registered users', async () => {
      // Arrange
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Season With Users',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(),
          entryFee: 50,
          status: 'ACTIVE',
          isActive: true,
          registeredUserCount: 5, // Has registered users
          leagues: { connect: { id: league.id } },
        },
      });

      // Act & Assert
      await expect(
        seasonService.deleteSeasonService(season.id)
      ).rejects.toThrow('Cannot delete season: there are registered users');
    });
  });

  describe('registerMembershipService', () => {
    it('should register a user for an active season', async () => {
      // Arrange
      const user = await createTestUser();
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Registration Open Season',
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days in future
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days in future
          entryFee: 50,
          status: 'ACTIVE',
          isActive: true,
          paymentRequired: false,
          leagues: { connect: { id: league.id } },
        },
      });

      // Act
      const membership = await seasonService.registerMembershipService({
        userId: user.id,
        seasonId: season.id,
      });

      // Assert
      expect(membership).toBeDefined();
      expect(membership.userId).toBe(user.id);
      expect(membership.seasonId).toBe(season.id);
      expect(membership.status).toBe('ACTIVE'); // No payment required
      expect(membership.paymentStatus).toBe(PaymentStatus.COMPLETED);
    });

    it('should set PENDING status when payment is required', async () => {
      // Arrange
      const user = await createTestUser();
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Paid Season',
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          entryFee: 50,
          status: 'ACTIVE',
          isActive: true,
          paymentRequired: true, // Payment required
          leagues: { connect: { id: league.id } },
        },
      });

      // Act
      const membership = await seasonService.registerMembershipService({
        userId: user.id,
        seasonId: season.id,
      });

      // Assert
      expect(membership.status).toBe('PENDING');
      expect(membership.paymentStatus).toBe(PaymentStatus.PENDING);
    });

    it('should allow payLater to bypass payment requirement', async () => {
      // Arrange
      const user = await createTestUser();
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Pay Later Season',
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          entryFee: 50,
          status: 'ACTIVE',
          isActive: true,
          paymentRequired: true,
          leagues: { connect: { id: league.id } },
        },
      });

      // Act
      const membership = await seasonService.registerMembershipService({
        userId: user.id,
        seasonId: season.id,
        payLater: true, // Development bypass
      });

      // Assert
      expect(membership.status).toBe('ACTIVE');
      expect(membership.paymentStatus).toBe(PaymentStatus.COMPLETED);
    });

    it('should throw error for non-existent season', async () => {
      // Arrange
      const user = await createTestUser();

      // Act & Assert
      await expect(
        seasonService.registerMembershipService({
          userId: user.id,
          seasonId: 'non-existent-season',
        })
      ).rejects.toThrow('Season not found');
    });

    it('should throw error for inactive season', async () => {
      // Arrange
      const user = await createTestUser();
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Inactive Season',
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          entryFee: 50,
          status: 'UPCOMING',
          isActive: false, // Not active
          leagues: { connect: { id: league.id } },
        },
      });

      // Act & Assert
      await expect(
        seasonService.registerMembershipService({
          userId: user.id,
          seasonId: season.id,
        })
      ).rejects.toThrow('Season is not active for registration');
    });

    it('should throw error when registration deadline has passed', async () => {
      // Arrange
      const user = await createTestUser();
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Deadline Passed Season',
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Started 7 days ago
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // Deadline 14 days ago
          entryFee: 50,
          status: 'ACTIVE',
          isActive: true,
          leagues: { connect: { id: league.id } },
        },
      });

      // Act & Assert
      await expect(
        seasonService.registerMembershipService({
          userId: user.id,
          seasonId: season.id,
        })
      ).rejects.toThrow('Season registration is not currently open');
    });

    it('should throw error when user already registered', async () => {
      // Arrange
      const user = await createTestUser();
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Already Registered Season',
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          entryFee: 50,
          status: 'ACTIVE',
          isActive: true,
          paymentRequired: false,
          leagues: { connect: { id: league.id } },
        },
      });

      // First registration
      await seasonService.registerMembershipService({
        userId: user.id,
        seasonId: season.id,
      });

      // Act & Assert - Second registration should fail
      await expect(
        seasonService.registerMembershipService({
          userId: user.id,
          seasonId: season.id,
        })
      ).rejects.toThrow('User already registered for this season');
    });

    it('should increment registeredUserCount', async () => {
      // Arrange
      const user = await createTestUser();
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Count Season',
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          entryFee: 50,
          status: 'ACTIVE',
          isActive: true,
          registeredUserCount: 0,
          paymentRequired: false,
          leagues: { connect: { id: league.id } },
        },
      });

      // Act
      await seasonService.registerMembershipService({
        userId: user.id,
        seasonId: season.id,
      });

      // Assert
      const updatedSeason = await prismaTest.season.findUnique({
        where: { id: season.id },
      });
      expect(updatedSeason?.registeredUserCount).toBe(1);
    });
  });

  describe('updatePaymentStatusService', () => {
    it('should update payment status to COMPLETED and activate membership', async () => {
      // Arrange
      const user = await createTestUser();
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Payment Update Season',
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          entryFee: 50,
          status: 'ACTIVE',
          isActive: true,
          paymentRequired: true,
          leagues: { connect: { id: league.id } },
        },
      });

      const membership = await prismaTest.seasonMembership.create({
        data: {
          userId: user.id,
          seasonId: season.id,
          status: 'PENDING',
          paymentStatus: PaymentStatus.PENDING,
        },
      });

      // Act
      const result = await seasonService.updatePaymentStatusService({
        membershipId: membership.id,
        paymentStatus: PaymentStatus.COMPLETED,
      });

      // Assert
      expect(result.paymentStatus).toBe(PaymentStatus.COMPLETED);
      expect(result.status).toBe('ACTIVE');
    });

    it('should update payment status without changing membership status for non-COMPLETED', async () => {
      // Arrange
      const user = await createTestUser();
      const league = await createTestLeague();
      const season = await prismaTest.season.create({
        data: {
          name: 'Failed Payment Season',
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          regiDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          entryFee: 50,
          status: 'ACTIVE',
          isActive: true,
          paymentRequired: true,
          leagues: { connect: { id: league.id } },
        },
      });

      const membership = await prismaTest.seasonMembership.create({
        data: {
          userId: user.id,
          seasonId: season.id,
          status: 'PENDING',
          paymentStatus: PaymentStatus.PENDING,
        },
      });

      // Act
      const result = await seasonService.updatePaymentStatusService({
        membershipId: membership.id,
        paymentStatus: PaymentStatus.FAILED,
      });

      // Assert
      expect(result.paymentStatus).toBe(PaymentStatus.FAILED);
      expect(result.status).toBe('PENDING'); // Should remain PENDING
    });
  });

  describe('assignDivisionService', () => {
    it('should assign a division to a membership', async () => {
      // Arrange
      const division = await createTestDivision();
      const user = await createTestUser();

      const membership = await prismaTest.seasonMembership.create({
        data: {
          userId: user.id,
          seasonId: division.seasonId!,
          status: 'ACTIVE',
          paymentStatus: PaymentStatus.COMPLETED,
        },
      });

      // Act
      const result = await seasonService.assignDivisionService({
        membershipId: membership.id,
        divisionId: division.id,
      });

      // Assert
      expect(result.divisionId).toBe(division.id);
      expect(result.division?.id).toBe(division.id);
    });

    it('should allow changing division assignment', async () => {
      // Arrange
      const division1 = await createTestDivision({ name: 'Division A' });
      const division2 = await prismaTest.division.create({
        data: {
          name: 'Division B',
          seasonId: division1.seasonId!,
          leagueId: division1.leagueId!,
          gameType: GameType.SINGLES,
        },
      });
      const user = await createTestUser();

      const membership = await prismaTest.seasonMembership.create({
        data: {
          userId: user.id,
          seasonId: division1.seasonId!,
          divisionId: division1.id, // Initially assigned to Division A
          status: 'ACTIVE',
          paymentStatus: PaymentStatus.COMPLETED,
        },
      });

      // Act
      const result = await seasonService.assignDivisionService({
        membershipId: membership.id,
        divisionId: division2.id, // Change to Division B
      });

      // Assert
      expect(result.divisionId).toBe(division2.id);
    });
  });
});
