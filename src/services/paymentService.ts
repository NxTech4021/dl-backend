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
  paidAt?: Date;
  notes?: string;
}

// BUSINESS LOGIC SERVICES 


// Business Logic: Payment creation with validation
export const createPayment = async (data: PaymentCreationData) => {
  const { amount, status = 'PENDING' } = data;

  // Business Rule: Amount must be positive
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  // Business Logic: Create payment with auto-set paid date if status is PAID
  return prisma.payment.create({
    data: {
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      status: status,
      notes: data.notes,
      paidAt: status === 'PAID' ? new Date() : undefined,
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
  if (payment.status === 'PAID' && data.status && data.status !== 'REFUNDED') {
    throw new Error('Cannot modify paid payments except to refund.');
  }

  // Business Rule: Cannot refund unpaid payments
  if (payment.status !== 'PAID' && data.status === 'REFUNDED') {
    throw new Error('Cannot refund unpaid payments.');
  }

  // Business Logic: Auto-set paidAt when status changes to PAID
  const updateData = { ...data };
  if (data.status === 'PAID' && payment.status !== 'PAID') {
    updateData.paidAt = new Date();
  }

  // Business Logic: Clear paidAt when status changes from PAID
  if (data.status && data.status !== 'PAID' && payment.status === 'PAID') {
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

  if (payment.status === 'PAID') {
    throw new Error('Payment is already marked as paid.');
  }

  if (payment.status === 'REFUNDED') {
    throw new Error('Cannot mark refunded payment as paid.');
  }

  // Business Logic: Mark as paid with timestamp
  return prisma.payment.update({
    where: { id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
    },
  });
};

// Business Logic: Payment deletion with constraint checking
export const deletePayment = async (id: string) => {
  // Business Rule: Check if payment is linked to registrations
  const registrationCount = await prisma.seasonRegistration.count({
    where: { paymentId: id },
  });

  if (registrationCount > 0) {
    throw new Error('Cannot delete a payment that is linked to registrations.');
  }

  // Business Rule: Cannot delete paid payments (for audit trail)
  const payment = await prisma.payment.findUnique({
    where: { id },
  });

  if (!payment) {
    throw new Error(`Payment with ID ${id} not found.`);
  }

  if (payment.status === 'PAID') {
    throw new Error('Cannot delete paid payments. Consider refunding instead.');
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

  if (payment.status !== 'PAID') {
    throw new Error('Can only refund paid payments.');
  }

  return prisma.payment.update({
    where: { id },
    data: {
      status: 'REFUNDED',
      notes: reason ? `${payment.notes || ''}\nRefunded: ${reason}` : payment.notes,
    },
  });
};