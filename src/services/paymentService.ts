import { prisma } from "../lib/prisma";
import { PrismaClient, PaymentStatus } from '@prisma/client';


interface PaymentCreationData {
  amount: number;
  paymentMethod?: string;
  status?: PaymentStatus;
  notes?: string;
}

interface PaymentUpdateData {
  amount?: number;
  paymentMethod?: string;
  status?: PaymentStatus;
  paidAt?: Date | null;
  notes?: string;
}

// BUSINESS LOGIC SERVICES 


// Business Logic: Payment creation with validation
export const createPayment = async (data: PaymentCreationData) => {
  const { amount, status = PaymentStatus.PENDING } = data;

  // Business Rule: Amount must be positive
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  // Business Logic: Create payment with auto-set paid date if status is PAID
  return prisma.payment.create({
    data: {
      amount: data.amount,
      orderId: `ORD-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      ...(data.paymentMethod && { paymentMethod: data.paymentMethod }),
      status: status,
      ...(data.notes && { notes: data.notes }),
      ...(status === PaymentStatus.COMPLETED && { paidAt: new Date() }),
    },
  });
};

// Business Logic: Payment update with validation
export const updatePayment = async (id: string, data: PaymentUpdateData) => {
  // Business Rule: Verify payment exists
  const payment = await prisma.payment.findUnique({
    where: { id },
  });
  
  if (!payment) {
    throw new Error(`Payment with ID ${id} not found.`);
  }

  // Business Rule: Amount must be positive if being updated
  if (data.amount !== undefined && data.amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  // Business Rule: Cannot modify paid payments (except to refund)
  if (payment.status === PaymentStatus.COMPLETED && data.status && data.status !== PaymentStatus.REFUNDED) {
    throw new Error('Cannot modify completed payments except to refund.');
  }

  // Business Rule: Cannot refund unpaid payments
  if (payment.status !== PaymentStatus.COMPLETED && data.status === PaymentStatus.REFUNDED) {
    throw new Error('Cannot refund incomplete payments.');
  }

  // Business Logic: Auto-set paidAt when status changes to PAID
  const updateData = { ...data };
  if (data.status === PaymentStatus.COMPLETED && payment.status !== PaymentStatus.COMPLETED) {
    updateData.paidAt = new Date();
  }

  // Business Logic: Clear paidAt when status changes from PAID
  if (data.status && data.status !== PaymentStatus.COMPLETED && payment.status === PaymentStatus.COMPLETED) {
    updateData.paidAt = null;
  }

  return prisma.payment.update({
    where: { id },
    data: updateData,
  });
};

// Business Logic: Mark payment as paid with validation
export const markPaymentAsPaid = async (id: string) => {
  // Business Rule: Verify payment exists
  const payment = await prisma.payment.findUnique({
    where: { id },
  });
  
  if (!payment) {
    throw new Error(`Payment with ID ${id} not found.`);
  }

  if (payment.status === PaymentStatus.COMPLETED) {
    throw new Error('Payment is already marked as completed.');
  }

  if (payment.status === PaymentStatus.REFUNDED) {
    throw new Error('Cannot mark refunded payment as completed.');
  }

  // Business Logic: Mark as paid with timestamp
  return prisma.payment.update({
    where: { id },
    data: {
      status: PaymentStatus.COMPLETED,
      paidAt: new Date(),
    },
  });
};

// Business Logic: Payment deletion with constraint checking
export const deletePayment = async (id: string) => {
  // Business Rule: Check if payment is linked to season memberships
  // Note: SeasonMembership doesn't have paymentId field - uses paymentStatus instead
  // If you need payment tracking, consider adding a Payment relation to SeasonMembership
  // For now, we'll skip this check as the model doesn't support it

  // TODO: Add Payment relation to SeasonMembership if payment tracking is needed

  // Business Rule: Cannot delete paid payments (for audit trail)
  const payment = await prisma.payment.findUnique({
    where: { id },
  });

  if (!payment) {
    throw new Error(`Payment with ID ${id} not found.`);
  }

  if (payment.status === PaymentStatus.COMPLETED) {
    throw new Error('Cannot delete completed payments. Consider refunding instead.');
  }

  // Business Logic: Delete payment
  return prisma.payment.delete({
    where: { id },
  });
};

// Business Logic: Advanced payment operations
export const refundPayment = async (id: string, reason?: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id },
  });

  if (!payment) {
    throw new Error(`Payment with ID ${id} not found.`);
  }

  if (payment.status !== PaymentStatus.COMPLETED) {
    throw new Error('Can only refund completed payments.');
  }

  return prisma.payment.update({
    where: { id },
    data: {
      status: PaymentStatus.REFUNDED,
      notes: reason ? `${payment.notes || ''}\nRefunded: ${reason}` : payment.notes,
    },
  });
};
