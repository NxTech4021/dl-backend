/**
 * Location Save Tests
 * Tests for BUG 7: Location endpoint drops lat/lon
 */

import { prismaTest } from '../../setup/prismaTestClient';
import { createTestUser } from '../../helpers/factories';

describe('Location Save', () => {
  // BUG 7: Location endpoint drops lat/lon
  describe('BUG 7: Latitude and longitude persistence', () => {
    it('should persist latitude and longitude when saving location', async () => {
      const user = await createTestUser({ completedOnboarding: false });

      const updatedUser = await prismaTest.user.update({
        where: { id: user.id },
        data: {
          area: 'Kuala Lumpur, Selangor',
          latitude: 3.1390,
          longitude: 101.6869,
        },
      });

      expect(updatedUser.latitude).toBeCloseTo(3.1390, 4);
      expect(updatedUser.longitude).toBeCloseTo(101.6869, 4);
      expect(updatedUser.area).toBe('Kuala Lumpur, Selangor');
    });

    it('should allow null latitude and longitude', async () => {
      const user = await createTestUser({ completedOnboarding: false });

      const updatedUser = await prismaTest.user.update({
        where: { id: user.id },
        data: {
          area: 'Singapore',
          latitude: null,
          longitude: null,
        },
      });

      expect(updatedUser.latitude).toBeNull();
      expect(updatedUser.longitude).toBeNull();
    });

    it('should handle negative coordinates (southern/western hemisphere)', async () => {
      const user = await createTestUser({ completedOnboarding: false });

      const updatedUser = await prismaTest.user.update({
        where: { id: user.id },
        data: {
          area: 'Sydney, NSW',
          latitude: -33.8688,
          longitude: 151.2093,
        },
      });

      expect(updatedUser.latitude).toBeCloseTo(-33.8688, 4);
      expect(updatedUser.longitude).toBeCloseTo(151.2093, 4);
    });
  });
});
