import { Router } from "express";
import { verifyAuth, requireAdmin } from "../middlewares/auth.middleware";
import {
  createSuperadmin,
  getInviteEmail,
  registerAdmin,
  sendAdminInvite,
  getAdminSession,
  fetchAdmins,
  getAdminById,
  updateAdmin,
  trackLogin,
  updatePassword,
} from "../controllers/admincontrollers";
import adminMatchRoutes from "./admin/adminMatchRoutes";
import bracketRoutes from "./admin/bracketRoutes";
import adminPlayerRoutes from "./admin/adminPlayerRoutes";
import adminLogRoutes from "./admin/adminLogRoutes";
import userActivityLogRoutes from "./admin/userActivityLogRoutes";
import adminReportRoutes from "./admin/adminReportRoutes";
import adminPaymentRoutes from "./admin/adminPaymentRoutes";
import adminRatingRoutes from "./adminRatingRoutes";
import adminInactivityRoutes from "./adminInactivityRoutes";
import adminBest6Routes from "./admin/adminBest6Routes";
import adminDashboardRoutes from "./adminDashboardRoutes";
import adminSystemRoutes from "./admin/systemRoutes";
import adminAchievementRoutes from "./admin/adminAchievementRoutes";
import partnershipAdminRoutes from "./admin/partnershipAdminRoutes";
import adminStatusRoutes from "./admin/adminStatusRoutes";

const adminRouter = Router();

// Apply authentication to all admin routes
adminRouter.use(verifyAuth);
adminRouter.use(requireAdmin);

// Admin account routes
adminRouter.get("/get-invite", getInviteEmail);
adminRouter.get("/session", getAdminSession);
adminRouter.get("/getadmins", fetchAdmins);
adminRouter.get("/profile/:id", getAdminById);

adminRouter.put("/activity/tracklogin", trackLogin);
adminRouter.put("/account/update", updateAdmin);
adminRouter.post("/superadmin", createSuperadmin);
adminRouter.post("/register", registerAdmin);
adminRouter.post("/invite", sendAdminInvite);
adminRouter.post("/updatepassword", updatePassword);

// Admin Match Management Routes (AS1-AS6)
adminRouter.use("/", adminMatchRoutes);

// Admin Bracket Routes (AS2)
adminRouter.use("/", bracketRoutes);

// Admin Rating Routes (Ratings & Standings Module)
adminRouter.use("/ratings", adminRatingRoutes);

// Admin Best 6 & Standings Routes
adminRouter.use("/", adminBest6Routes);

// Admin Inactivity Routes
adminRouter.use("/inactivity", adminInactivityRoutes);

// Admin Dashboard Routes
adminRouter.use("/dashboard", adminDashboardRoutes);

// Admin Player Management Routes (ban, unban, delete, status)
adminRouter.use("/players", adminPlayerRoutes);

// Admin Action Logs Routes
adminRouter.use("/logs", adminLogRoutes);

// User Activity Logs Routes
adminRouter.use("/user-activity", userActivityLogRoutes);

// Admin Reports Routes
adminRouter.use("/reports", adminReportRoutes);

// Admin Payment Management Routes
adminRouter.use("/payments", adminPaymentRoutes);

// Admin System Routes
adminRouter.use("/system", adminSystemRoutes);

// Admin Achievement Routes
adminRouter.use("/achievements", adminAchievementRoutes);

// Admin Partnership Management Routes (withdrawal requests, dissolved partnerships)
adminRouter.use("/partnerships", partnershipAdminRoutes);

// Admin Status Management Routes (suspend, activate, status history)
adminRouter.use("/admins", adminStatusRoutes);

export default adminRouter;
