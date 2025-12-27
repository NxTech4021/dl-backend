/**
 * Admin Report Controller
 * Handles HTTP requests for admin reports
 */

import { Request, Response } from 'express';
import { getAdminReportService, DateRangeFilter } from '../../services/admin/adminReportService';

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

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get Player Registration Stats Error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve player registration statistics' });
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

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get Player Retention Stats Error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve player retention statistics' });
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

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get Season Performance Stats Error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve season performance statistics' });
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

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get Dispute Analysis Stats Error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve dispute analysis statistics' });
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

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get Revenue Stats Error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve revenue statistics' });
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

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get Membership Stats Error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve membership statistics' });
  }
};
