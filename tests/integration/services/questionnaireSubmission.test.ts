/**
 * Questionnaire Submission Tests
 * Tests for BUG 2 (race condition/duplicates), BUG 4 (sports save duplicates), BUG 5 (unlimited resubmission)
 */

import { prismaTest } from '../../setup/prismaTestClient';
import { createTestUser } from '../../helpers/factories';

describe('Questionnaire Submission', () => {
  // BUG 2: Race condition — no @@unique + no transaction
  describe('BUG 2: Duplicate questionnaire response prevention', () => {
    it('should not create duplicate questionnaire responses for same user+sport', async () => {
      const user = await createTestUser({ completedOnboarding: false });

      // Create first response
      await prismaTest.questionnaireResponse.create({
        data: {
          userId: user.id,
          sport: 'tennis',
          qVersion: 1,
          qHash: 'hash1',
          answersJson: { experience: '1-2 years' },
          completedAt: new Date(),
        },
      });

      // Attempting to create a second response for same user+sport should fail
      // due to @@unique([userId, sport]) constraint
      await expect(
        prismaTest.questionnaireResponse.create({
          data: {
            userId: user.id,
            sport: 'tennis',
            qVersion: 1,
            qHash: 'hash2',
            answersJson: { experience: '2-4 years' },
          },
        })
      ).rejects.toThrow();
    });

    it('should allow different sports for the same user', async () => {
      const user = await createTestUser({ completedOnboarding: false });

      await prismaTest.questionnaireResponse.create({
        data: {
          userId: user.id,
          sport: 'tennis',
          qVersion: 1,
          qHash: 'hash1',
          answersJson: {},
        },
      });

      // Different sport should succeed
      const pickleballResponse = await prismaTest.questionnaireResponse.create({
        data: {
          userId: user.id,
          sport: 'pickleball',
          qVersion: 1,
          qHash: 'hash1',
          answersJson: {},
        },
      });

      expect(pickleballResponse.sport).toBe('pickleball');
    });

    it('should allow upsert pattern for same user+sport', async () => {
      const user = await createTestUser({ completedOnboarding: false });

      // First upsert creates
      const first = await prismaTest.questionnaireResponse.upsert({
        where: {
          userId_sport: {
            userId: user.id,
            sport: 'tennis',
          },
        },
        create: {
          userId: user.id,
          sport: 'tennis',
          qVersion: 1,
          qHash: 'hash1',
          answersJson: { experience: '1-2 years' },
        },
        update: {
          qVersion: 1,
          qHash: 'hash1',
          answersJson: { experience: '1-2 years' },
          completedAt: new Date(),
        },
      });

      // Second upsert updates (same record)
      const second = await prismaTest.questionnaireResponse.upsert({
        where: {
          userId_sport: {
            userId: user.id,
            sport: 'tennis',
          },
        },
        create: {
          userId: user.id,
          sport: 'tennis',
          qVersion: 1,
          qHash: 'hash2',
          answersJson: { experience: '2-4 years' },
        },
        update: {
          qHash: 'hash2',
          answersJson: { experience: '2-4 years' },
          completedAt: new Date(),
        },
      });

      expect(first.id).toBe(second.id);

      // Should only be 1 row total
      const count = await prismaTest.questionnaireResponse.count({
        where: { userId: user.id, sport: 'tennis' },
      });
      expect(count).toBe(1);
    });
  });

  // BUG 4: Sports save race condition
  describe('BUG 4: Sports save duplicate prevention', () => {
    it('should upsert sport placeholder without creating duplicates', async () => {
      const user = await createTestUser({ completedOnboarding: false });

      // First save (placeholder)
      await prismaTest.questionnaireResponse.upsert({
        where: {
          userId_sport: {
            userId: user.id,
            sport: 'padel',
          },
        },
        create: {
          userId: user.id,
          sport: 'padel',
          qVersion: 1,
          qHash: 'placeholder',
          answersJson: {},
          startedAt: new Date(),
          completedAt: null,
        },
        update: {}, // No-op if already exists
      });

      // Second save (same sport) should not create duplicate
      await prismaTest.questionnaireResponse.upsert({
        where: {
          userId_sport: {
            userId: user.id,
            sport: 'padel',
          },
        },
        create: {
          userId: user.id,
          sport: 'padel',
          qVersion: 1,
          qHash: 'placeholder',
          answersJson: {},
          startedAt: new Date(),
          completedAt: null,
        },
        update: {},
      });

      const count = await prismaTest.questionnaireResponse.count({
        where: { userId: user.id, sport: 'padel' },
      });
      expect(count).toBe(1);
    });
  });

  // BUG 5: Unlimited resubmission
  describe('BUG 5: Resubmission guard', () => {
    it('should detect already-completed questionnaire for resubmission check', async () => {
      const user = await createTestUser({ completedOnboarding: false });

      // Create a completed questionnaire response
      await prismaTest.questionnaireResponse.create({
        data: {
          userId: user.id,
          sport: 'tennis',
          qVersion: 1,
          qHash: 'hash1',
          answersJson: { experience: '1-2 years' },
          completedAt: new Date(), // Already completed
        },
      });

      // Check if questionnaire is already completed
      const existing = await prismaTest.questionnaireResponse.findUnique({
        where: {
          userId_sport: { userId: user.id, sport: 'tennis' },
        },
      });

      const isAlreadyCompleted = !!(existing?.completedAt);
      expect(isAlreadyCompleted).toBe(true);
    });

    it('should allow submission when questionnaire is not yet completed', async () => {
      const user = await createTestUser({ completedOnboarding: false });

      // Create a placeholder (not completed)
      await prismaTest.questionnaireResponse.create({
        data: {
          userId: user.id,
          sport: 'tennis',
          qVersion: 1,
          qHash: 'placeholder',
          answersJson: {},
          completedAt: null, // Not completed
        },
      });

      const existing = await prismaTest.questionnaireResponse.findUnique({
        where: {
          userId_sport: { userId: user.id, sport: 'tennis' },
        },
      });

      const isAlreadyCompleted = !!(existing?.completedAt);
      expect(isAlreadyCompleted).toBe(false);
    });
  });
});
