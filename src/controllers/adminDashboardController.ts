/**
 * Admin Dashboard Controller
 * Handles HTTP requests for dashboard statistics
 */

import { Request, Response } from 'express';
import {
  getDashboardKPIStats,
  getSportMetrics,
  getMatchActivityData,
  getUserGrowthData,
  getSportComparisonData,
  getAllDashboardStats,
} from '../services/admin/adminDashboardService';
import { sendSuccess, sendError } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * Get all dashboard stats in one call
 * GET /api/admin/dashboard/stats
 */
export async function getDashboardStats(req: Request, res: Response) {
  try {
    const stats = await getAllDashboardStats();

    return sendSuccess(res, stats);
  } catch (error: any) {
    logger.error('Get dashboard stats error:', error);
    return sendError(res, error.message || 'Failed to get dashboard stats');
  }
}

/**
 * Get KPI stats only
 * GET /api/admin/dashboard/kpi
 */
export async function getKPIStats(req: Request, res: Response) {
  try {
    const stats = await getDashboardKPIStats();

    return sendSuccess(res, stats);
  } catch (error: any) {
    logger.error('Get KPI stats error:', error);
    return sendError(res, error.message || 'Failed to get KPI stats');
  }
}

/**
 * Get sport-specific metrics
 * GET /api/admin/dashboard/sports
 */
export async function getSportsMetrics(req: Request, res: Response) {
  try {
    const metrics = await getSportMetrics();

    return sendSuccess(res, metrics);
  } catch (error: any) {
    logger.error('Get sports metrics error:', error);
    return sendError(res, error.message || 'Failed to get sports metrics');
  }
}

/**
 * Get match activity data for charts
 * GET /api/admin/dashboard/match-activity
 */
export async function getMatchActivity(req: Request, res: Response) {
  try {
    const { weeks } = req.query;
    const weeksNum = weeks ? parseInt(weeks as string, 10) : 12;

    const data = await getMatchActivityData(weeksNum);

    return sendSuccess(res, data);
  } catch (error: any) {
    logger.error('Get match activity error:', error);
    return sendError(res, error.message || 'Failed to get match activity data');
  }
}

/**
 * Get user growth data for charts
 * GET /api/admin/dashboard/user-growth
 */
export async function getUserGrowth(req: Request, res: Response) {
  try {
    const { months } = req.query;
    const monthsNum = months ? parseInt(months as string, 10) : 6;

    const data = await getUserGrowthData(monthsNum);

    return sendSuccess(res, data);
  } catch (error: any) {
    logger.error('Get user growth error:', error);
    return sendError(res, error.message || 'Failed to get user growth data');
  }
}

/**
 * Get sport comparison data for charts
 * GET /api/admin/dashboard/sport-comparison
 */
export async function getSportComparison(req: Request, res: Response) {
  try {
    const data = await getSportComparisonData();

    return sendSuccess(res, data);
  } catch (error: any) {
    logger.error('Get sport comparison error:', error);
    return sendError(res, error.message || 'Failed to get sport comparison data');
  }
}
