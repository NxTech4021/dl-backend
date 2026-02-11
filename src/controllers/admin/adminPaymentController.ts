/**
 * Admin Payment Controller
 * Handles HTTP requests for payment management operations
 */

import { Request, Response } from 'express';
import { PaymentStatus } from '@prisma/client';
import * as adminPaymentService from '../../services/admin/adminPaymentService';
import { logger } from '../../utils/logger';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response';

/**
 * Get payments with filters and pagination
 * GET /api/admin/payments
 * Query params: search, seasonId, status, startDate, endDate, page, limit, sortBy, sortOrder
 */
export const getPayments = async (req: Request, res: Response) => {
  try {
    const {
      search,
      seasonId,
      status,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortOrder
    } = req.query;

    // Validate status if provided
    const validStatus = status && Object.values(PaymentStatus).includes(status as PaymentStatus)
      ? status as PaymentStatus
      : undefined;

    // Validate sortBy
    const validSortBy = ['joinedAt', 'user.name', 'season.name', 'season.entryFee'].includes(sortBy as string)
      ? sortBy as 'joinedAt' | 'user.name' | 'season.name' | 'season.entryFee'
      : 'joinedAt';

    // Validate sortOrder
    const validSortOrder = ['asc', 'desc'].includes(sortOrder as string)
      ? sortOrder as 'asc' | 'desc'
      : 'desc';

    const result = await adminPaymentService.getPaymentsWithFilters({
      search: search ? String(search) : undefined,
      seasonId: seasonId ? String(seasonId) : undefined,
      status: validStatus,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      sortBy: validSortBy,
      sortOrder: validSortOrder
    });

    return sendPaginated(res, result.data, result.pagination, 'Payments retrieved successfully');
  } catch (error: any) {
    logger.error('Get payments error:', error);

    return sendError(res, error.message || 'Failed to get payments');
  }
};

/**
 * Get payment statistics
 * GET /api/admin/payments/stats
 * Query params: seasonId (optional)
 */
export const getPaymentStats = async (req: Request, res: Response) => {
  try {
    const { seasonId } = req.query;

    const stats = await adminPaymentService.getPaymentStats(
      seasonId ? String(seasonId) : undefined
    );

    return sendSuccess(res, stats, 'Payment statistics retrieved successfully');
  } catch (error: any) {
    logger.error('Get payment stats error:', error);

    return sendError(res, error.message || 'Failed to get payment statistics');
  }
};

/**
 * Update payment status for a single membership
 * PATCH /api/admin/payments/:membershipId/status
 * Body: { paymentStatus: PaymentStatus, notes?: string }
 */
export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    const { membershipId } = req.params;
    const { paymentStatus, notes } = req.body;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    if (!membershipId) {
      return sendError(res, 'Membership ID is required', 400);
    }

    if (!paymentStatus || !Object.values(PaymentStatus).includes(paymentStatus)) {
      return sendError(res, `Invalid payment status. Must be one of: ${Object.values(PaymentStatus).join(', ')}`, 400);
    }

    const result = await adminPaymentService.updatePaymentStatus({
      membershipId,
      adminId,
      paymentStatus,
      notes: notes?.trim()
    });

    return sendSuccess(res, { membership: result.membership, previousStatus: result.previousStatus }, `Payment status updated to ${paymentStatus}`);
  } catch (error: any) {
    logger.error('Update payment status error:', error);

    const statusCode = error.message === 'Membership not found' ? 404 : 500;

    return sendError(res, error.message || 'Failed to update payment status', statusCode);
  }
};

/**
 * Bulk update payment status for multiple memberships
 * PATCH /api/admin/payments/bulk-status
 * Body: { membershipIds: string[], paymentStatus: PaymentStatus, notes?: string }
 */
export const bulkUpdatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    const { membershipIds, paymentStatus, notes } = req.body;

    if (!adminId) {
      return sendError(res, 'Admin not authenticated', 401);
    }

    if (!membershipIds || !Array.isArray(membershipIds) || membershipIds.length === 0) {
      return sendError(res, 'Membership IDs array is required', 400);
    }

    if (!paymentStatus || !Object.values(PaymentStatus).includes(paymentStatus)) {
      return sendError(res, `Invalid payment status. Must be one of: ${Object.values(PaymentStatus).join(', ')}`, 400);
    }

    const result = await adminPaymentService.bulkUpdatePaymentStatus({
      membershipIds,
      adminId,
      paymentStatus,
      notes: notes?.trim()
    });

    return sendSuccess(res, result, `${result.updated} payment(s) updated to ${paymentStatus}`);
  } catch (error: any) {
    logger.error('Bulk update payment status error:', error);

    const statusCode = error.message.includes('not found') ? 404 : 500;

    return sendError(res, error.message || 'Failed to bulk update payment status', statusCode);
  }
};

/**
 * Get seasons with payment required (for filter dropdown)
 * GET /api/admin/payments/seasons
 */
export const getSeasonsWithPayment = async (req: Request, res: Response) => {
  try {
    const seasons = await adminPaymentService.getSeasonsWithPayment();

    return sendSuccess(res, seasons, 'Seasons retrieved successfully');
  } catch (error: any) {
    logger.error('Get seasons with payment error:', error);

    return sendError(res, error.message || 'Failed to get seasons');
  }
};
