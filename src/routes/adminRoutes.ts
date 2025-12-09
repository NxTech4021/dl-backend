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
import adminReportRoutes from "./admin/adminReportRoutes";
import adminRatingRoutes from "./adminRatingRoutes";
import adminInactivityRoutes from "./adminInactivityRoutes";
import adminBest6Routes from "./admin/adminBest6Routes";
import adminDashboardRoutes from "./adminDashboardRoutes";

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

// Admin Reports Routes
adminRouter.use("/reports", adminReportRoutes);

export default adminRouter;
