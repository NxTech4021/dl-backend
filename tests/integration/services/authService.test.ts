/**
 * AuthService Integration Tests
 *
 * Tests for OTP generation, verification, consumption, and rate limiting.
 */

import { prismaTest } from '../../setup/prismaTestClient';
import { createTestUser } from '../../helpers/factories';

// Mock the email sending function
jest.mock('../../../src/config/nodemailer', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

// Import after mocking
import { createAndSendOTP, verifyResetOTP, consumeOTP } from '../../../src/services/authService';
import { sendEmail } from '../../../src/config/nodemailer';

const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAndSendOTP', () => {
    it('should create OTP and send email successfully', async () => {
      // Arrange
      const email = `test-${Date.now()}@example.com`;

      // Act
      const result = await createAndSendOTP(email, 'forget-password');

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('sent successfully');
      expect(mockedSendEmail).toHaveBeenCalledWith(
        email.toLowerCase(),
        'Your Password Reset Code',
        expect.stringContaining('password reset code')
      );
    });

    it('should normalize email to lowercase', async () => {
      // Arrange
      const email = `TEST-${Date.now()}@EXAMPLE.COM`;

      // Act
      await createAndSendOTP(email, 'forget-password');

      // Assert
      expect(mockedSendEmail).toHaveBeenCalledWith(
        email.toLowerCase(),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should create OTP with email-verification type', async () => {
      // Arrange
      const email = `verify-${Date.now()}@example.com`;

      // Act
      const result = await createAndSendOTP(email, 'email-verification');

      // Assert
      expect(result.success).toBe(true);
      expect(mockedSendEmail).toHaveBeenCalledWith(
        email.toLowerCase(),
        'Verify Your Email Address',
        expect.stringContaining('email verification code')
      );
    });

    it('should create OTP with sign-in type', async () => {
      // Arrange
      const email = `signin-${Date.now()}@example.com`;

      // Act
      const result = await createAndSendOTP(email, 'sign-in');

      // Assert
      expect(result.success).toBe(true);
      expect(mockedSendEmail).toHaveBeenCalledWith(
        email.toLowerCase(),
        'Your Sign-In Code',
        expect.stringContaining('sign-in code')
      );
    });

    it('should invalidate previous pending OTPs before creating new one', async () => {
      // Arrange
      const email = `multi-${Date.now()}@example.com`;
      const normalizedEmail = email.toLowerCase();

      // Create first OTP
      await createAndSendOTP(email, 'forget-password');

      // Check first OTP is pending
      const firstOtps = await prismaTest.verification.findMany({
        where: { identifier: normalizedEmail, status: 'PENDING' },
      });
      expect(firstOtps).toHaveLength(1);

      // Act - Create second OTP
      await createAndSendOTP(email, 'forget-password');

      // Assert - First should be invalidated, second should be pending
      const allOtps = await prismaTest.verification.findMany({
        where: { identifier: normalizedEmail },
        orderBy: { createdAt: 'asc' },
      });

      expect(allOtps.length).toBeGreaterThanOrEqual(2);
      expect(allOtps[0].status).toBe('INVALIDATED');
      expect(allOtps[allOtps.length - 1].status).toBe('PENDING');
    });

    it('should create 6-digit OTP', async () => {
      // Arrange
      const email = `digits-${Date.now()}@example.com`;

      // Act
      await createAndSendOTP(email, 'forget-password');

      // Assert - Check the OTP in database is 6 digits
      const verification = await prismaTest.verification.findFirst({
        where: { identifier: email.toLowerCase(), status: 'PENDING' },
      });

      expect(verification).toBeDefined();
      expect(verification!.value).toMatch(/^\d{6}$/);
    });

    it('should set expiration to 15 minutes from now', async () => {
      // Arrange
      const email = `expiry-${Date.now()}@example.com`;
      const beforeCreate = new Date();

      // Act
      await createAndSendOTP(email, 'forget-password');

      // Assert
      const verification = await prismaTest.verification.findFirst({
        where: { identifier: email.toLowerCase(), status: 'PENDING' },
      });

      expect(verification).toBeDefined();
      const expiresAt = new Date(verification!.expiresAt);
      const expectedMinExpiry = new Date(beforeCreate.getTime() + 14 * 60 * 1000); // At least 14 min
      const expectedMaxExpiry = new Date(beforeCreate.getTime() + 16 * 60 * 1000); // At most 16 min

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry.getTime());
    });

    it('should return failure when email sending fails', async () => {
      // Arrange
      const email = `fail-${Date.now()}@example.com`;
      mockedSendEmail.mockRejectedValueOnce(new Error('SMTP error'));

      // Act
      const result = await createAndSendOTP(email, 'forget-password');

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to send');
    });
  });

  describe('verifyResetOTP', () => {
    it('should verify valid OTP successfully', async () => {
      // Arrange
      const email = `valid-${Date.now()}@example.com`;
      await createAndSendOTP(email, 'forget-password');

      // Get the OTP from database
      const verification = await prismaTest.verification.findFirst({
        where: { identifier: email.toLowerCase(), status: 'PENDING' },
      });
      const otp = verification!.value;

      // Act
      const result = await verifyResetOTP(email, otp);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('valid');
    });

    it('should reject invalid OTP', async () => {
      // Arrange
      const email = `invalid-${Date.now()}@example.com`;
      await createAndSendOTP(email, 'forget-password');

      // Act
      const result = await verifyResetOTP(email, '000000');

      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('OTP_INVALID');
    });

    // These tests use dependency injection to pass prismaTest to the service
    it('should reject expired OTP', async () => {
      // Arrange - Create an expired verification record
      const email = `expired-${Date.now()}@example.com`;
      const normalizedEmail = email.toLowerCase();
      const otp = '123456';
      const expiredDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      await prismaTest.verification.create({
        data: {
          identifier: normalizedEmail,
          value: otp,
          expiresAt: expiredDate,
          status: 'PENDING',
        },
      });

      // Act - Pass prismaTest as the client
      const result = await verifyResetOTP(email, otp, prismaTest as any);

      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('OTP_EXPIRED');
    });

    it('should reject already used OTP', async () => {
      // Arrange - Create a USED verification record
      const email = `used-${Date.now()}@example.com`;
      const normalizedEmail = email.toLowerCase();
      const otp = '654321';

      await prismaTest.verification.create({
        data: {
          identifier: normalizedEmail,
          value: otp,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min from now
          status: 'USED',
        },
      });

      // Act - Pass prismaTest as the client
      const result = await verifyResetOTP(email, otp, prismaTest as any);

      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('OTP_ALREADY_USED');
    });

    it('should handle better-auth format OTP (code:period)', async () => {
      // Arrange - Create verification with better-auth format "code:period"
      const email = `betterauth-${Date.now()}@example.com`;
      const normalizedEmail = email.toLowerCase();
      const otpCode = '789012';
      const betterAuthFormat = `${otpCode}:0`;

      await prismaTest.verification.create({
        data: {
          identifier: normalizedEmail,
          value: betterAuthFormat,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          status: 'PENDING',
        },
      });

      // Act - Pass prismaTest and verify using just the code part
      const result = await verifyResetOTP(email, otpCode, prismaTest as any);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should normalize email with spaces and uppercase', async () => {
      // Arrange
      const baseEmail = `normalize-${Date.now()}@example.com`;
      const normalizedEmail = baseEmail.toLowerCase();

      await createAndSendOTP(normalizedEmail, 'forget-password');
      const verification = await prismaTest.verification.findFirst({
        where: { identifier: normalizedEmail, status: 'PENDING' },
      });

      // Act - Use uppercase email with spaces
      const result = await verifyResetOTP(`  ${baseEmail.toUpperCase()}  `, verification!.value);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should not consume OTP on verification (keep it pending)', async () => {
      // Arrange
      const email = `persist-${Date.now()}@example.com`;
      await createAndSendOTP(email, 'forget-password');

      const verification = await prismaTest.verification.findFirst({
        where: { identifier: email.toLowerCase(), status: 'PENDING' },
      });

      // Act
      await verifyResetOTP(email, verification!.value);

      // Assert - OTP should still be pending
      const stillPending = await prismaTest.verification.findFirst({
        where: { id: verification!.id },
      });
      expect(stillPending!.status).toBe('PENDING');
    });
  });

  describe('consumeOTP', () => {
    it('should mark OTP as USED after consumption', async () => {
      // Arrange
      const email = `consume-${Date.now()}@example.com`;
      await createAndSendOTP(email, 'forget-password');

      const verification = await prismaTest.verification.findFirst({
        where: { identifier: email.toLowerCase(), status: 'PENDING' },
      });
      const otp = verification!.value;

      // Act
      const result = await consumeOTP(email, otp);

      // Assert
      expect(result.success).toBe(true);

      const consumed = await prismaTest.verification.findFirst({
        where: { id: verification!.id },
      });
      expect(consumed!.status).toBe('USED');
    });

    it('should reject invalid OTP on consumption', async () => {
      // Arrange
      const email = `invalid-consume-${Date.now()}@example.com`;
      await createAndSendOTP(email, 'forget-password');

      // Act
      const result = await consumeOTP(email, '000000');

      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('OTP_INVALID');
    });

    it('should prevent double consumption', async () => {
      // Arrange
      const email = `double-${Date.now()}@example.com`;
      await createAndSendOTP(email, 'forget-password');

      const verification = await prismaTest.verification.findFirst({
        where: { identifier: email.toLowerCase(), status: 'PENDING' },
      });
      const otp = verification!.value;

      // Consume once
      await consumeOTP(email, otp);

      // Act - Try to consume again
      const result = await consumeOTP(email, otp);

      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('OTP_INVALID');
    });

    it('should handle better-auth format OTP on consumption', async () => {
      // Arrange - Create verification with better-auth format "code:period"
      const email = `ba-consume-${Date.now()}@example.com`;
      const normalizedEmail = email.toLowerCase();
      const otpCode = '456789';
      const betterAuthFormat = `${otpCode}:0`;

      await prismaTest.verification.create({
        data: {
          identifier: normalizedEmail,
          value: betterAuthFormat,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          status: 'PENDING',
        },
      });

      // Act - Pass prismaTest and consume using just the code part
      const result = await consumeOTP(email, otpCode, prismaTest as any);

      // Assert
      expect(result.success).toBe(true);

      // Verify it was marked as USED
      const verification = await prismaTest.verification.findFirst({
        where: { identifier: normalizedEmail },
      });
      expect(verification!.status).toBe('USED');
    });
  });

  describe('Rate Limiting', () => {
    it('should track failed attempts', async () => {
      // Arrange
      const email = `ratelimit-${Date.now()}@example.com`;
      await createAndSendOTP(email, 'forget-password');

      // Act - Make multiple failed attempts
      for (let i = 0; i < 3; i++) {
        await verifyResetOTP(email, '000000');
      }

      // Assert - Should still allow attempts (under limit)
      const result = await verifyResetOTP(email, '000000');
      expect(result.success).toBe(false);
      expect(result.code).toBe('OTP_INVALID'); // Not locked yet
    });

    it('should lock out after max attempts', async () => {
      // Arrange
      const email = `lockout-${Date.now()}@example.com`;
      await createAndSendOTP(email, 'forget-password');

      // Act - Make 5 failed attempts (MAX_OTP_ATTEMPTS)
      for (let i = 0; i < 5; i++) {
        await verifyResetOTP(email, '000000');
      }

      // Assert - Next attempt should be locked out
      const result = await verifyResetOTP(email, '000000');
      expect(result.success).toBe(false);
      expect(result.code).toBe('TOO_MANY_ATTEMPTS');
      expect(result.message).toContain('Too many failed attempts');
    });

    it('should clear attempts after successful verification', async () => {
      // Arrange
      const email = `clear-${Date.now()}@example.com`;
      await createAndSendOTP(email, 'forget-password');

      const verification = await prismaTest.verification.findFirst({
        where: { identifier: email.toLowerCase(), status: 'PENDING' },
      });

      // Make some failed attempts
      for (let i = 0; i < 3; i++) {
        await verifyResetOTP(email, '000000');
      }

      // Successful verification
      await verifyResetOTP(email, verification!.value);

      // Create new OTP for fresh test
      await createAndSendOTP(email, 'forget-password');

      // Act - Should be able to make attempts again without lockout
      const result = await verifyResetOTP(email, '000000');

      // Assert - Should not be locked out
      expect(result.code).not.toBe('TOO_MANY_ATTEMPTS');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty email gracefully', async () => {
      // Act
      const result = await verifyResetOTP('', '123456');

      // Assert
      expect(result.success).toBe(false);
    });

    it('should handle empty OTP gracefully', async () => {
      // Arrange
      const email = `empty-otp-${Date.now()}@example.com`;
      await createAndSendOTP(email, 'forget-password');

      // Act
      const result = await verifyResetOTP(email, '');

      // Assert
      expect(result.success).toBe(false);
    });

    it('should handle whitespace-only OTP', async () => {
      // Arrange
      const email = `whitespace-${Date.now()}@example.com`;
      await createAndSendOTP(email, 'forget-password');

      // Act
      const result = await verifyResetOTP(email, '   ');

      // Assert
      expect(result.success).toBe(false);
    });

    it('should handle multiple emails with same domain', async () => {
      // Arrange
      const timestamp = Date.now();
      const email1 = `user1-${timestamp}@example.com`;
      const email2 = `user2-${timestamp}@example.com`;

      await createAndSendOTP(email1, 'forget-password');
      await createAndSendOTP(email2, 'forget-password');

      const verification1 = await prismaTest.verification.findFirst({
        where: { identifier: email1.toLowerCase(), status: 'PENDING' },
      });
      const verification2 = await prismaTest.verification.findFirst({
        where: { identifier: email2.toLowerCase(), status: 'PENDING' },
      });

      // Act - Cross verification should fail
      const wrongResult = await verifyResetOTP(email1, verification2!.value);
      const correctResult = await verifyResetOTP(email1, verification1!.value);

      // Assert
      expect(wrongResult.success).toBe(false);
      expect(correctResult.success).toBe(true);
    });
  });
});
