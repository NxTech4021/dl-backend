/**
 * Admin Payment Controller
 * Handles HTTP requests for payment management operations
 */

import { Request, Response } from 'express';
import { PaymentStatus } from '@prisma/client';
import * as adminPaymentService from '../../services/admin/adminPaymentService';
import { logger } from '../../utils/logger';

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

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      message: 'Payments retrieved successfully'
    });
  } catch (error: any) {
    logger.error('Get payments error:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get payments'
    });
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

    return res.status(200).json({
      success: true,
      data: stats,
      message: 'Payment statistics retrieved successfully'
    });
  } catch (error: any) {
    logger.error('Get payment stats error:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get payment statistics'
    });
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
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    if (!membershipId) {
      return res.status(400).json({
        success: false,
        message: 'Membership ID is required'
      });
    }

    if (!paymentStatus || !Object.values(PaymentStatus).includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Must be one of: ${Object.values(PaymentStatus).join(', ')}`
      });
    }

    const result = await adminPaymentService.updatePaymentStatus({
      membershipId,
      adminId,
      paymentStatus,
      notes: notes?.trim()
    });

    return res.status(200).json({
      success: true,
      data: result.membership,
      previousStatus: result.previousStatus,
      message: `Payment status updated to ${paymentStatus}`
    });
  } catch (error: any) {
    logger.error('Update payment status error:', error);

    const statusCode = error.message === 'Membership not found' ? 404 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update payment status'
    });
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
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    if (!membershipIds || !Array.isArray(membershipIds) || membershipIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Membership IDs array is required'
      });
    }

    if (!paymentStatus || !Object.values(PaymentStatus).includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Must be one of: ${Object.values(PaymentStatus).join(', ')}`
      });
    }

    const result = await adminPaymentService.bulkUpdatePaymentStatus({
      membershipIds,
      adminId,
      paymentStatus,
      notes: notes?.trim()
    });

    return res.status(200).json({
      success: true,
      data: result,
      message: `${result.updated} payment(s) updated to ${paymentStatus}`
    });
  } catch (error: any) {
    logger.error('Bulk update payment status error:', error);

    const statusCode = error.message.includes('not found') ? 404 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to bulk update payment status'
    });
  }
};

/**
 * Get seasons with payment required (for filter dropdown)
 * GET /api/admin/payments/seasons
 */
export const getSeasonsWithPayment = async (req: Request, res: Response) => {
  try {
    const seasons = await adminPaymentService.getSeasonsWithPayment();

    return res.status(200).json({
      success: true,
      data: seasons,
      message: 'Seasons retrieved successfully'
    });
  } catch (error: any) {
    logger.error('Get seasons with payment error:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get seasons'
    });
  }
};
