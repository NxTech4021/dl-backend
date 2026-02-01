/**
 * PaymentService Integration Tests
 *
 * Tests for payment lifecycle management: creation, updates, refunds.
 */

import { prismaTest } from '../../setup/prismaTestClient';
import { createTestUser } from '../../helpers/factories';
import { PaymentStatus } from '@prisma/client';

// Import the payment service functions
import * as paymentService from '../../../src/services/paymentService';

describe('PaymentService', () => {
  describe('createPayment', () => {
    it('should create payment with required fields', async () => {
      // Act
      const payment = await paymentService.createPayment({
        amount: 100,
      });

      // Assert
      expect(payment).toBeDefined();
      expect(Number(payment.amount)).toBe(100);
      expect(payment.status).toBe(PaymentStatus.PENDING);
      expect(payment.orderId).toMatch(/^ORD-\d+-[a-z0-9]+$/);
    });

    it('should create payment with all optional fields', async () => {
      // Act
      const payment = await paymentService.createPayment({
        amount: 250,
        paymentMethod: 'CREDIT_CARD',
        notes: 'Test payment notes',
      });

      // Assert
      expect(Number(payment.amount)).toBe(250);
      expect(payment.paymentMethod).toBe('CREDIT_CARD');
      expect(payment.notes).toBe('Test payment notes');
    });

    it('should set paidAt when created as COMPLETED', async () => {
      // Act
      const beforeCreate = new Date();
      const payment = await paymentService.createPayment({
        amount: 50,
        status: PaymentStatus.COMPLETED,
      });

      // Assert
      expect(payment.status).toBe(PaymentStatus.COMPLETED);
      expect(payment.paidAt).toBeDefined();
      expect(new Date(payment.paidAt!).getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    });

    it('should reject amount of zero', async () => {
      // Act & Assert
      await expect(
        paymentService.createPayment({
          amount: 0,
        })
      ).rejects.toThrow();
    });

    it('should reject negative amount', async () => {
      // Act & Assert
      await expect(
        paymentService.createPayment({
          amount: -50,
        })
      ).rejects.toThrow();
    });

    it('should generate unique order IDs', async () => {
      // Act
      const payment1 = await paymentService.createPayment({ amount: 100 });
      const payment2 = await paymentService.createPayment({ amount: 100 });

      // Assert
      expect(payment1.orderId).not.toBe(payment2.orderId);
    });
  });

  describe('updatePayment', () => {
    it('should update payment amount', async () => {
      // Arrange
      const payment = await paymentService.createPayment({ amount: 100 });

      // Act
      const updated = await paymentService.updatePayment(payment.id, {
        amount: 150,
      });

      // Assert
      expect(Number(updated.amount)).toBe(150);
    });

    it('should update payment method', async () => {
      // Arrange
      const payment = await paymentService.createPayment({ amount: 100 });

      // Act
      const updated = await paymentService.updatePayment(payment.id, {
        paymentMethod: 'BANK_TRANSFER',
      });

      // Assert
      expect(updated.paymentMethod).toBe('BANK_TRANSFER');
    });

    it('should set paidAt when status changes to COMPLETED', async () => {
      // Arrange
      const payment = await paymentService.createPayment({ amount: 100 });
      expect(payment.paidAt).toBeNull();

      // Act
      const updated = await paymentService.updatePayment(payment.id, {
        status: PaymentStatus.COMPLETED,
      });

      // Assert
      expect(updated.status).toBe(PaymentStatus.COMPLETED);
      expect(updated.paidAt).toBeDefined();
    });

    it('should clear paidAt when status changes from COMPLETED', async () => {
      // Arrange
      const payment = await paymentService.createPayment({
        amount: 100,
        status: PaymentStatus.COMPLETED,
      });
      expect(payment.paidAt).toBeDefined();

      // Act
      const updated = await paymentService.updatePayment(payment.id, {
        status: PaymentStatus.REFUNDED,
      });

      // Assert
      expect(updated.status).toBe(PaymentStatus.REFUNDED);
      expect(updated.paidAt).toBeNull();
    });

    it('should throw error for non-existent payment', async () => {
      // Act & Assert
      await expect(
        paymentService.updatePayment('non-existent-id', { amount: 100 })
      ).rejects.toThrow();
    });

    it('should reject zero amount on update', async () => {
      // Arrange
      const payment = await paymentService.createPayment({ amount: 100 });

      // Act & Assert
      await expect(
        paymentService.updatePayment(payment.id, { amount: 0 })
      ).rejects.toThrow();
    });

    it('should reject negative amount on update', async () => {
      // Arrange
      const payment = await paymentService.createPayment({ amount: 100 });

      // Act & Assert
      await expect(
        paymentService.updatePayment(payment.id, { amount: -50 })
      ).rejects.toThrow();
    });

    it('should prevent changing status of COMPLETED payments except for refund', async () => {
      // Arrange
      const payment = await paymentService.createPayment({
        amount: 100,
        status: PaymentStatus.COMPLETED,
      });

      // Act & Assert - Cannot change status to something other than REFUNDED
      await expect(
        paymentService.updatePayment(payment.id, { status: PaymentStatus.PENDING })
      ).rejects.toThrow();
    });

    it('should allow refunding COMPLETED payment', async () => {
      // Arrange
      const payment = await paymentService.createPayment({
        amount: 100,
        status: PaymentStatus.COMPLETED,
      });

      // Act
      const updated = await paymentService.updatePayment(payment.id, {
        status: PaymentStatus.REFUNDED,
      });

      // Assert
      expect(updated.status).toBe(PaymentStatus.REFUNDED);
    });

    it('should update notes field', async () => {
      // Arrange
      const payment = await paymentService.createPayment({ amount: 100 });

      // Act
      const updated = await paymentService.updatePayment(payment.id, {
        notes: 'Updated notes',
      });

      // Assert
      expect(updated.notes).toBe('Updated notes');
    });
  });

  describe('markPaymentAsPaid', () => {
    it('should mark pending payment as paid', async () => {
      // Arrange
      const payment = await paymentService.createPayment({ amount: 100 });

      // Act
      const paid = await paymentService.markPaymentAsPaid(payment.id);

      // Assert
      expect(paid.status).toBe(PaymentStatus.COMPLETED);
      expect(paid.paidAt).toBeDefined();
    });

    it('should throw error for non-existent payment', async () => {
      // Act & Assert
      await expect(
        paymentService.markPaymentAsPaid('non-existent-id')
      ).rejects.toThrow();
    });

    it('should throw error for already completed payment', async () => {
      // Arrange
      const payment = await paymentService.createPayment({
        amount: 100,
        status: PaymentStatus.COMPLETED,
      });

      // Act & Assert
      await expect(
        paymentService.markPaymentAsPaid(payment.id)
      ).rejects.toThrow();
    });

    it('should throw error for refunded payment', async () => {
      // Arrange
      const payment = await paymentService.createPayment({
        amount: 100,
        status: PaymentStatus.COMPLETED,
      });
      await paymentService.refundPayment(payment.id);

      // Act & Assert
      await expect(
        paymentService.markPaymentAsPaid(payment.id)
      ).rejects.toThrow();
    });
  });

  describe('deletePayment', () => {
    it('should delete pending payment', async () => {
      // Arrange
      const payment = await paymentService.createPayment({ amount: 100 });

      // Act
      await paymentService.deletePayment(payment.id);

      // Assert
      const deleted = await prismaTest.payment.findUnique({
        where: { id: payment.id },
      });
      expect(deleted).toBeNull();
    });

    it('should throw error for non-existent payment', async () => {
      // Act & Assert
      await expect(
        paymentService.deletePayment('non-existent-id')
      ).rejects.toThrow();
    });

    it('should prevent deleting COMPLETED payment', async () => {
      // Arrange
      const payment = await paymentService.createPayment({
        amount: 100,
        status: PaymentStatus.COMPLETED,
      });

      // Act & Assert
      await expect(
        paymentService.deletePayment(payment.id)
      ).rejects.toThrow();
    });
  });

  describe('refundPayment', () => {
    it('should refund completed payment', async () => {
      // Arrange
      const payment = await paymentService.createPayment({
        amount: 100,
        status: PaymentStatus.COMPLETED,
      });

      // Act
      const refunded = await paymentService.refundPayment(payment.id);

      // Assert
      expect(refunded.status).toBe(PaymentStatus.REFUNDED);
    });

    it('should append reason to notes', async () => {
      // Arrange
      const payment = await paymentService.createPayment({
        amount: 100,
        status: PaymentStatus.COMPLETED,
        notes: 'Original notes',
      });

      // Act
      const refunded = await paymentService.refundPayment(payment.id, 'Customer requested');

      // Assert
      expect(refunded.notes).toContain('Original notes');
      expect(refunded.notes).toContain('Customer requested');
    });

    it('should throw error for non-existent payment', async () => {
      // Act & Assert
      await expect(
        paymentService.refundPayment('non-existent-id')
      ).rejects.toThrow();
    });

    it('should throw error for pending payment', async () => {
      // Arrange
      const payment = await paymentService.createPayment({ amount: 100 });

      // Act & Assert
      await expect(
        paymentService.refundPayment(payment.id)
      ).rejects.toThrow();
    });

    it('should throw error for already refunded payment', async () => {
      // Arrange
      const payment = await paymentService.createPayment({
        amount: 100,
        status: PaymentStatus.COMPLETED,
      });
      await paymentService.refundPayment(payment.id);

      // Act & Assert - Cannot refund twice
      await expect(
        paymentService.refundPayment(payment.id)
      ).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle large payment amounts', async () => {
      // Act
      const payment = await paymentService.createPayment({
        amount: 999999.99,
      });

      // Assert
      expect(Number(payment.amount)).toBe(999999.99);
    });

    it('should handle decimal amounts correctly', async () => {
      // Act
      const payment = await paymentService.createPayment({
        amount: 49.99,
      });

      // Assert
      expect(Number(payment.amount)).toBe(49.99);
    });

    it('should handle multiple status transitions', async () => {
      // Arrange
      const payment = await paymentService.createPayment({ amount: 100 });

      // Act - Transition: PENDING -> COMPLETED -> REFUNDED
      await paymentService.markPaymentAsPaid(payment.id);
      const refunded = await paymentService.refundPayment(payment.id);

      // Assert
      expect(refunded.status).toBe(PaymentStatus.REFUNDED);
    });
  });
});
