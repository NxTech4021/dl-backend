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
  // const { amount, status = 'PENDING' } = data; // Commented out: payment model doesn't exist

  // Business Rule: Amount must be positive
  // if (amount <= 0) { // Commented out: payment model doesn't exist
  //   throw new Error('Payment amount must be greater than zero.');
  // }

  // Business Logic: Create payment with auto-set paid date if status is PAID
  // return prisma.payment.create({ // Commented out: payment model doesn't exist
  //   data: {
  //     amount: data.amount,
  //     paymentMethod: data.paymentMethod,
  //     status: status,
  //     notes: data.notes,
  //     paidAt: status === 'PAID' ? new Date() : undefined, // Commented out: 'PAID' doesn't exist in PaymentStatus enum
  //   },
  // });
  throw new Error('Payment model does not exist in the database schema');
};

// Business Logic: Payment update with validation
export const updatePayment = async (id: string, data: PaymentUpdateData) => {
  // Business Rule: Verify payment exists
  // const payment = await prisma.payment.findUnique({ // Commented out: payment model doesn't exist
  //   where: { id },
  // });
  
  // if (!payment) {
  //   throw new Error(`Payment with ID ${id} not found.`);
  // }

  // Business Rule: Amount must be positive if being updated
  // if (data.amount !== undefined && data.amount <= 0) { // Commented out: payment model doesn't exist
  //   throw new Error('Payment amount must be greater than zero.');
  // }

  // Business Rule: Cannot modify paid payments (except to refund)
  // if (payment.status === 'PAID' && data.status && data.status !== 'REFUNDED') { // Commented out: 'PAID' and 'REFUNDED' don't exist in PaymentStatus enum
  //   throw new Error('Cannot modify paid payments except to refund.');
  // }

  // Business Rule: Cannot refund unpaid payments
  // if (payment.status !== 'PAID' && data.status === 'REFUNDED') { // Commented out: 'PAID' and 'REFUNDED' don't exist in PaymentStatus enum
  //   throw new Error('Cannot refund unpaid payments.');
  // }

  // Business Logic: Auto-set paidAt when status changes to PAID
  // const updateData = { ...data };
  // if (data.status === 'PAID' && payment.status !== 'PAID') { // Commented out: 'PAID' doesn't exist in PaymentStatus enum
  //   updateData.paidAt = new Date();
  // }

  // Business Logic: Clear paidAt when status changes from PAID
  // if (data.status && data.status !== 'PAID' && payment.status === 'PAID') { // Commented out: 'PAID' doesn't exist in PaymentStatus enum
  //   updateData.paidAt = null;
  // }

  // return prisma.payment.update({ // Commented out: payment model doesn't exist
  //   where: { id },
  //   data: updateData,
  // });
  throw new Error('Payment model does not exist in the database schema');
};

// Business Logic: Mark payment as paid with validation
export const markPaymentAsPaid = async (id: string) => {
  // Business Rule: Verify payment exists
  // const payment = await prisma.payment.findUnique({ // Commented out: payment model doesn't exist
  //   where: { id },
  // });
  
  // if (!payment) {
  //   throw new Error(`Payment with ID ${id} not found.`);
  // }

  // if (payment.status === 'PAID') { // Commented out: 'PAID' doesn't exist in PaymentStatus enum
  //   throw new Error('Payment is already marked as paid.');
  // }

  // if (payment.status === 'REFUNDED') { // Commented out: 'REFUNDED' doesn't exist in PaymentStatus enum
  //   throw new Error('Cannot mark refunded payment as paid.');
  // }

  // Business Logic: Mark as paid with timestamp
  // return prisma.payment.update({ // Commented out: payment model doesn't exist
  //   where: { id },
  //   data: {
  //     status: 'PAID', // Commented out: 'PAID' doesn't exist in PaymentStatus enum (should be 'COMPLETED')
  //     paidAt: new Date(),
  //   },
  // });
  throw new Error('Payment model does not exist in the database schema');
};

// Business Logic: Payment deletion with constraint checking
export const deletePayment = async (id: string) => {
  // Business Rule: Check if payment is linked to season memberships
  // Note: SeasonMembership doesn't have paymentId field - uses paymentStatus instead
  // If you need payment tracking, consider adding a Payment relation to SeasonMembership
  // For now, we'll skip this check as the model doesn't support it

  // TODO: Add Payment relation to SeasonMembership if payment tracking is needed

  // Business Rule: Cannot delete paid payments (for audit trail)
  // const payment = await prisma.payment.findUnique({ // Commented out: payment model doesn't exist
  //   where: { id },
  // });

  // if (!payment) {
  //   throw new Error(`Payment with ID ${id} not found.`);
  // }

  // if (payment.status === 'PAID') { // Commented out: 'PAID' doesn't exist in PaymentStatus enum
  //   throw new Error('Cannot delete paid payments. Consider refunding instead.');
  // }

  // Business Logic: Delete payment
  // return prisma.payment.delete({ // Commented out: payment model doesn't exist
  //   where: { id },
  // });
  throw new Error('Payment model does not exist in the database schema');
};

// Business Logic: Advanced payment operations
export const refundPayment = async (id: string, reason?: string) => {
  // const payment = await prisma.payment.findUnique({ // Commented out: payment model doesn't exist
  //   where: { id },
  // });

  // if (!payment) {
  //   throw new Error(`Payment with ID ${id} not found.`);
  // }

  // if (payment.status !== 'PAID') { // Commented out: 'PAID' doesn't exist in PaymentStatus enum
  //   throw new Error('Can only refund paid payments.');
  // }

  // return prisma.payment.update({ // Commented out: payment model doesn't exist
  //   where: { id },
  //   data: {
  //     status: 'REFUNDED', // Commented out: 'REFUNDED' doesn't exist in PaymentStatus enum
  //     notes: reason ? `${payment.notes || ''}\nRefunded: ${reason}` : payment.notes,
  //   },
  // });
  throw new Error('Payment model does not exist in the database schema');
};