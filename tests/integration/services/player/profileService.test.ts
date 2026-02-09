/**
 * Player Profile Service Integration Tests
 *
 * Tests for profile retrieval, updates, achievements, and rating history.
 *
 * Note: These tests are limited due to transaction isolation (prismaTest vs global prisma).
 * The service uses global prisma, so players created via prismaTest are not visible to the service.
 * Tests focus on: error handling, validation, non-existent user behavior, and edge cases.
 */

import { prismaTest } from '../../../setup/prismaTestClient';

// Mock the logger
jest.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock better-auth (profileService imports auth for password change)
jest.mock('../../../../src/lib/auth', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
      changePassword: jest.fn(),
    },
  },
}));

// Mock cloud storage (profileService imports upload/delete functions)
jest.mock('../../../../src/config/cloudStorage.config', () => ({
  uploadProfileImage: jest.fn(),
  deleteProfileImage: jest.fn(),
}));

// Import after mocking
import {
  getPlayerProfile,
  getPublicPlayerProfile,
  updatePlayerProfile,
  getPlayerRatingHistory,
  getPlayerAchievements,
} from '../../../../src/services/player/profileService';

describe('PlayerProfileService', () => {
  describe('getPlayerProfile', () => {
    it('should throw "Player not found" for non-existent user', async () => {
      // Act & Assert
      await expect(
        getPlayerProfile('non-existent-user-id')
      ).rejects.toThrow('Player not found');
    });

    it('should throw "Player not found" for empty string user ID', async () => {
      // Act & Assert
      await expect(
        getPlayerProfile('')
      ).rejects.toThrow('Player not found');
    });
  });

  describe('getPublicPlayerProfile', () => {
    it('should throw "Player not found" for non-existent user', async () => {
      // Act & Assert
      await expect(
        getPublicPlayerProfile('non-existent-user-id')
      ).rejects.toThrow('Player not found');
    });

    it('should throw "Player not found" for non-existent user with viewer ID', async () => {
      // Act & Assert
      await expect(
        getPublicPlayerProfile('non-existent-user-id', 'some-viewer-id')
      ).rejects.toThrow('Player not found');
    });

    it('should throw "Player not found" for empty string user ID', async () => {
      // Act & Assert
      await expect(
        getPublicPlayerProfile('')
      ).rejects.toThrow('Player not found');
    });
  });

  describe('updatePlayerProfile', () => {
    it('should throw error when updating non-existent user', async () => {
      // Act & Assert - Prisma throws when trying to update a non-existent record
      await expect(
        updatePlayerProfile('non-existent-user-id', { name: 'New Name' })
      ).rejects.toThrow();
    });

    it('should throw "Name cannot be empty" for empty name', async () => {
      // Act & Assert - Validation runs before DB query
      await expect(
        updatePlayerProfile('any-user-id', { name: '' })
      ).rejects.toThrow('Name cannot be empty');
    });

    it('should throw "Name cannot be empty" for whitespace-only name', async () => {
      // Act & Assert
      await expect(
        updatePlayerProfile('any-user-id', { name: '   ' })
      ).rejects.toThrow('Name cannot be empty');
    });

    it('should throw "Username cannot be empty" for empty username', async () => {
      // Act & Assert - Validation runs before DB query
      await expect(
        updatePlayerProfile('any-user-id', { username: '' })
      ).rejects.toThrow('Username cannot be empty');
    });

    it('should throw "Username cannot be empty" for whitespace-only username', async () => {
      // Act & Assert
      await expect(
        updatePlayerProfile('any-user-id', { username: '   ' })
      ).rejects.toThrow('Username cannot be empty');
    });

    it('should throw "Email cannot be empty" for empty email', async () => {
      // Act & Assert - Validation runs before DB query
      await expect(
        updatePlayerProfile('any-user-id', { email: '' })
      ).rejects.toThrow('Email cannot be empty');
    });

    it('should throw "Email cannot be empty" for whitespace-only email', async () => {
      // Act & Assert
      await expect(
        updatePlayerProfile('any-user-id', { email: '   ' })
      ).rejects.toThrow('Email cannot be empty');
    });
  });

  describe('getPlayerRatingHistory', () => {
    it('should return empty array for non-existent user', async () => {
      // Act
      const result = await getPlayerRatingHistory('non-existent-user-id');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty string user ID', async () => {
      // Act
      const result = await getPlayerRatingHistory('');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should accept optional sport parameter', async () => {
      // Act
      const result = await getPlayerRatingHistory('non-existent-user-id', 'tennis');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should accept optional gameType parameter', async () => {
      // Act
      const result = await getPlayerRatingHistory('non-existent-user-id', undefined, 'singles');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should accept optional limit parameter', async () => {
      // Act
      const result = await getPlayerRatingHistory('non-existent-user-id', undefined, undefined, 5);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should accept doubles gameType parameter', async () => {
      // Act
      const result = await getPlayerRatingHistory('non-existent-user-id', undefined, 'doubles');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('getPlayerAchievements', () => {
    it('should return empty achievements for non-existent user', async () => {
      // Act
      const result = await getPlayerAchievements('non-existent-user-id');

      // Assert
      expect(result).toBeDefined();
      expect(result.achievements).toBeDefined();
      expect(Array.isArray(result.achievements)).toBe(true);
      expect(result.achievements).toHaveLength(0);
      expect(result.totalPoints).toBe(0);
      expect(result.count).toBe(0);
    });

    it('should return empty achievements for empty string user ID', async () => {
      // Act
      const result = await getPlayerAchievements('');

      // Assert
      expect(result).toBeDefined();
      expect(result.achievements).toHaveLength(0);
      expect(result.totalPoints).toBe(0);
      expect(result.count).toBe(0);
    });

    it('should return consistent count and array length', async () => {
      // Act
      const result = await getPlayerAchievements('non-existent-user-id');

      // Assert
      expect(result.count).toBe(result.achievements.length);
    });
  });
});
