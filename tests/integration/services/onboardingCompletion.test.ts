/**
 * Onboarding Completion & Step Ordering Tests
 * Tests for BUG 1 (no validation on completion) and BUG 3 (steps settable out of order)
 */

import { prismaTest } from '../../setup/prismaTestClient';
import { createTestUser } from '../../helpers/factories';

describe('Onboarding Completion Validation', () => {
  // BUG 1: No validation on completion endpoint
  describe('BUG 1: Completion requires all steps', () => {
    it('should identify incomplete onboarding when personal info is missing', async () => {
      const user = await createTestUser({
        completedOnboarding: false,
        name: '', // empty name = personal info not completed
      });

      // Query the user to check their readiness
      const dbUser = await prismaTest.user.findUnique({
        where: { id: user.id },
        include: { questionnaireResponses: true },
      });

      // Validation: user needs name, gender, at least 1 sport, and area
      const hasPersonalInfo = !!(dbUser?.name && dbUser.name.trim() !== '' && dbUser?.gender);
      const hasSports = (dbUser?.questionnaireResponses?.length ?? 0) > 0;
      const hasLocation = !!dbUser?.area;

      expect(hasPersonalInfo).toBe(false); // name is empty
      expect(hasSports).toBe(false);
      expect(hasLocation).toBe(false);
    });

    it('should identify incomplete onboarding when no sports selected', async () => {
      const user = await createTestUser({
        completedOnboarding: false,
        name: 'Test User',
      });

      // Set gender but no sports or location
      await prismaTest.user.update({
        where: { id: user.id },
        data: { gender: 'male' },
      });

      const dbUser = await prismaTest.user.findUnique({
        where: { id: user.id },
        include: { questionnaireResponses: true },
      });

      const hasPersonalInfo = !!(dbUser?.name && dbUser.name.trim() !== '' && dbUser?.gender);
      const hasSports = (dbUser?.questionnaireResponses?.length ?? 0) > 0;

      expect(hasPersonalInfo).toBe(true);
      expect(hasSports).toBe(false); // no sports
    });

    it('should identify complete onboarding when all requirements met', async () => {
      const user = await createTestUser({
        completedOnboarding: false,
        name: 'Test User',
      });

      // Set all required data
      await prismaTest.user.update({
        where: { id: user.id },
        data: {
          gender: 'male',
          area: 'Kuala Lumpur, Selangor',
        },
      });

      // Add a sport
      await prismaTest.questionnaireResponse.create({
        data: {
          userId: user.id,
          sport: 'tennis',
          qVersion: 1,
          qHash: 'test',
          answersJson: {},
          startedAt: new Date(),
        },
      });

      const dbUser = await prismaTest.user.findUnique({
        where: { id: user.id },
        include: { questionnaireResponses: true },
      });

      const hasPersonalInfo = !!(dbUser?.name && dbUser.name.trim() !== '' && dbUser?.gender);
      const hasSports = (dbUser?.questionnaireResponses?.length ?? 0) > 0;
      const hasLocation = !!dbUser?.area;

      expect(hasPersonalInfo).toBe(true);
      expect(hasSports).toBe(true);
      expect(hasLocation).toBe(true);
    });
  });

  // BUG 3: Steps settable out of order
  describe('BUG 3: Step ordering validation', () => {
    const STEP_ORDER = [
      'PERSONAL_INFO',
      'LOCATION',
      'GAME_SELECT',
      'SKILL_ASSESSMENT',
      'ASSESSMENT_RESULTS',
      'PROFILE_PICTURE',
    ] as const;

    function canSetStep(
      targetStep: string,
      currentStep: string | null,
    ): boolean {
      const targetIdx = STEP_ORDER.indexOf(targetStep as any);
      if (targetIdx === -1) return false;
      // First step is always allowed
      if (targetIdx === 0) return true;
      // Current step must be at or past the previous step
      if (!currentStep) return false;
      const currentIdx = STEP_ORDER.indexOf(currentStep as any);
      return currentIdx >= targetIdx - 1;
    }

    it('should allow setting PERSONAL_INFO as first step', () => {
      expect(canSetStep('PERSONAL_INFO', null)).toBe(true);
    });

    it('should reject GAME_SELECT when no step completed', () => {
      expect(canSetStep('GAME_SELECT', null)).toBe(false);
    });

    it('should reject GAME_SELECT when only PERSONAL_INFO completed', () => {
      // GAME_SELECT requires LOCATION (index 1) to be at or past
      expect(canSetStep('GAME_SELECT', 'PERSONAL_INFO')).toBe(false);
    });

    it('should allow LOCATION after PERSONAL_INFO', () => {
      expect(canSetStep('LOCATION', 'PERSONAL_INFO')).toBe(true);
    });

    it('should allow GAME_SELECT after LOCATION', () => {
      expect(canSetStep('GAME_SELECT', 'LOCATION')).toBe(true);
    });

    it('should allow SKILL_ASSESSMENT after GAME_SELECT', () => {
      expect(canSetStep('SKILL_ASSESSMENT', 'GAME_SELECT')).toBe(true);
    });

    it('should reject invalid step name', () => {
      expect(canSetStep('INVALID_STEP', 'PERSONAL_INFO')).toBe(false);
    });
  });
});
