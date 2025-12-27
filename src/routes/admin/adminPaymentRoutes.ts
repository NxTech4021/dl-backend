/**
 * Admin Payment Routes
 * Routes for payment management operations
 */

import { Router } from 'express';
import {
  getPayments,
  getPaymentStats,
  updatePaymentStatus,
  bulkUpdatePaymentStatus,
  getSeasonsWithPayment
} from '../../controllers/admin/adminPaymentController';

const router = Router();

// Get payments with filters and pagination
// GET /api/admin/payments?search=john&seasonId=xxx&status=PENDING&page=1&limit=20
router.get('/', getPayments);

// Get payment statistics
// GET /api/admin/payments/stats?seasonId=xxx (optional)
router.get('/stats', getPaymentStats);

// Get seasons with payment required (for filter dropdown)
// GET /api/admin/payments/seasons
router.get('/seasons', getSeasonsWithPayment);

// Bulk update payment status
// PATCH /api/admin/payments/bulk-status
// Body: { membershipIds: string[], paymentStatus: PaymentStatus, notes?: string }
router.patch('/bulk-status', bulkUpdatePaymentStatus);

// Update payment status for a single membership
// PATCH /api/admin/payments/:membershipId/status
// Body: { paymentStatus: PaymentStatus, notes?: string }
router.patch('/:membershipId/status', updatePaymentStatus);

export default router;
