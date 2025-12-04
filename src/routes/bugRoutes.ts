import { Router } from "express";
import { verifyAuth } from "../middlewares/auth.middleware";
import {
  // Public endpoints (Widget)
  getModulesByApp,
  createBugReport,
  getMyBugReports,
  getBugReportById,
  addComment,
  uploadScreenshot,
  initDLAApp,
  // Admin endpoints
  getAllBugReports,
  getAdminBugReportById,
  updateBugReport,
  addAdminComment,
  markAsDuplicate,
  deleteBugReport,
  getBugStats,
  // App & Module management
  getApps,
  createApp,
  createModule,
  getAppSettings,
  updateAppSettings,
} from "../controllers/bugController";

const bugRouter = Router();

// =============================================
// PUBLIC ENDPOINTS (No auth - for bug widget)
// These endpoints allow reporting bugs even from login page
// =============================================

// Initialize DLA app (auto-creates if not exists) - for DLAdmin widget
// Public: allows bug reporting before login
bugRouter.get("/init/dla", initDLAApp);

// Create new bug report - Public: allows reporting login issues
bugRouter.post("/reports", createBugReport);

// Get modules for a specific app (for dropdown) - Public
bugRouter.get("/apps/:appId/modules", getModulesByApp);

// =============================================
// AUTHENTICATED USER ENDPOINTS
// =============================================

// Get current user's bug reports
bugRouter.get("/reports/my", verifyAuth, getMyBugReports);

// Get specific bug report (user view)
bugRouter.get("/reports/:id", verifyAuth, getBugReportById);

// Add comment to bug report
bugRouter.post("/reports/:id/comments", verifyAuth, addComment);

// Upload screenshot (expects pre-uploaded URL from cloud storage)
bugRouter.post("/screenshots", verifyAuth, uploadScreenshot);

// Get all apps (for app selector)
bugRouter.get("/apps", verifyAuth, getApps);

// =============================================
// ADMIN ENDPOINTS
// =============================================

// Get all bug reports with filters and pagination
bugRouter.get("/admin/reports", verifyAuth, getAllBugReports);

// Get bug statistics
bugRouter.get("/admin/stats", verifyAuth, getBugStats);

// Get specific bug report (admin view - includes internal comments)
bugRouter.get("/admin/reports/:id", verifyAuth, getAdminBugReportById);

// Update bug report (status, priority, assignee, etc.)
bugRouter.put("/admin/reports/:id", verifyAuth, updateBugReport);

// Add admin comment (can be internal)
bugRouter.post("/admin/reports/:id/comments", verifyAuth, addAdminComment);

// Mark as duplicate
bugRouter.post("/admin/reports/:id/duplicate", verifyAuth, markAsDuplicate);

// Delete bug report
bugRouter.delete("/admin/reports/:id", verifyAuth, deleteBugReport);

// =============================================
// APP & MODULE MANAGEMENT (Admin)
// =============================================

// Create new app
bugRouter.post("/admin/apps", verifyAuth, createApp);

// Create module for app
bugRouter.post("/admin/apps/:appId/modules", verifyAuth, createModule);

// Get app settings
bugRouter.get("/admin/apps/:appId/settings", verifyAuth, getAppSettings);

// Update app settings
bugRouter.put("/admin/apps/:appId/settings", verifyAuth, updateAppSettings);

export default bugRouter;
