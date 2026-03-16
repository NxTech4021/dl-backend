import { Router } from 'express';
import {
  createCrashReport,
  getCrashReports,
  getCrashReportById,
  updateCrashReport,
  getCrashStats,
} from '../controllers/crashReportController';
import { optionalAuth, verifyAuth, requireAdmin } from '../middlewares/auth.middleware';
import { crashReportLimiter } from '../middlewares/rateLimiter';

const crashReportRoutes = Router();

// Public: submit crash report (optionalAuth — anonymous allowed)
crashReportRoutes.post('/', crashReportLimiter, optionalAuth, createCrashReport);

// Admin: view crash reports
crashReportRoutes.get('/admin', verifyAuth, requireAdmin, getCrashReports);
crashReportRoutes.get('/admin/stats', verifyAuth, requireAdmin, getCrashStats);
crashReportRoutes.get('/admin/:id', verifyAuth, requireAdmin, getCrashReportById);
crashReportRoutes.patch('/admin/:id', verifyAuth, requireAdmin, updateCrashReport);

export default crashReportRoutes;
