/**
 * Admin Report Controller
 * Handles HTTP requests for admin reports
 */

import { Request, Response } from 'express';
import { getAdminReportService, DateRangeFilter } from '../../services/admin/adminReportService';
import { sendSuccess, sendError } from '../../utils/response';

const reportService = getAdminReportService();

/**
 * Parse date range from query parameters
 */
function parseDateRange(startDate?: string, endDate?: string): DateRangeFilter {
  const filter: DateRangeFilter = {};
  if (startDate) {
    filter.startDate = new Date(startDate);
  }
  if (endDate) {
    filter.endDate = new Date(endDate);
  }
  return filter;
}

/**
 * Get player registration statistics
 * GET /api/admin/reports/player-registration
 */
export const getPlayerRegistrationStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const filters = parseDateRange(startDate as string, endDate as string);

    const stats = await reportService.getPlayerRegistrationStats(filters);

    return sendSuccess(res, stats);
  } catch (error) {
    console.error('Get Player Registration Stats Error:', error);
    return sendError(res, 'Failed to retrieve player registration statistics', 500);
  }
};

/**
 * Get player retention statistics
 * GET /api/admin/reports/player-retention
 */
export const getPlayerRetentionStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const filters = parseDateRange(startDate as string, endDate as string);

    const stats = await reportService.getPlayerRetentionStats(filters);

    return sendSuccess(res, stats);
  } catch (error) {
    console.error('Get Player Retention Stats Error:', error);
    return sendError(res, 'Failed to retrieve player retention statistics', 500);
  }
};

/**
 * Get season performance statistics
 * GET /api/admin/reports/season-performance
 */
export const getSeasonPerformanceStats = async (req: Request, res: Response) => {
  try {
    const { seasonId } = req.query;

    const stats = await reportService.getSeasonPerformanceStats(seasonId as string);

    return sendSuccess(res, stats);
  } catch (error) {
    console.error('Get Season Performance Stats Error:', error);
    return sendError(res, 'Failed to retrieve season performance statistics', 500);
  }
};

/**
 * Get dispute analysis statistics
 * GET /api/admin/reports/dispute-analysis
 */
export const getDisputeAnalysisStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const filters = parseDateRange(startDate as string, endDate as string);

    const stats = await reportService.getDisputeAnalysisStats(filters);

    return sendSuccess(res, stats);
  } catch (error) {
    console.error('Get Dispute Analysis Stats Error:', error);
    return sendError(res, 'Failed to retrieve dispute analysis statistics', 500);
  }
};

/**
 * Get revenue statistics
 * GET /api/admin/reports/revenue
 */
export const getRevenueStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const filters = parseDateRange(startDate as string, endDate as string);

    const stats = await reportService.getRevenueStats(filters);

    return sendSuccess(res, stats);
  } catch (error) {
    console.error('Get Revenue Stats Error:', error);
    return sendError(res, 'Failed to retrieve revenue statistics', 500);
  }
};

/**
 * Get membership statistics
 * GET /api/admin/reports/membership
 */
export const getMembershipStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const filters = parseDateRange(startDate as string, endDate as string);

    const stats = await reportService.getMembershipStats(filters);

    return sendSuccess(res, stats);
  } catch (error) {
    console.error('Get Membership Stats Error:', error);
    return sendError(res, 'Failed to retrieve membership statistics', 500);
  }
};
