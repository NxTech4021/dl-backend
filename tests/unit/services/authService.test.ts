// tests/unit/services/authService.test.ts
import { isAdminBlockedOnMobile } from '../../../src/services/authService';

describe('isAdminBlockedOnMobile', () => {
  it('should return true for ADMIN role on mobile client', () => {
    expect(isAdminBlockedOnMobile('ADMIN', 'mobile')).toBe(true);
  });

  it('should return true for SUPERADMIN role on mobile client', () => {
    expect(isAdminBlockedOnMobile('SUPERADMIN', 'mobile')).toBe(true);
  });

  it('should return false for USER role on mobile client', () => {
    expect(isAdminBlockedOnMobile('USER', 'mobile')).toBe(false);
  });

  it('should return false for ADMIN role on non-mobile client', () => {
    expect(isAdminBlockedOnMobile('ADMIN', 'web')).toBe(false);
    expect(isAdminBlockedOnMobile('ADMIN', undefined)).toBe(false);
  });

  it('should return false for SUPERADMIN role on non-mobile client', () => {
    expect(isAdminBlockedOnMobile('SUPERADMIN', 'web')).toBe(false);
    expect(isAdminBlockedOnMobile('SUPERADMIN', undefined)).toBe(false);
  });
});
