import { Router } from "express";
import { verifyAuth } from "../middlewares/auth.middleware";
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
  updatePassword
} from "../controllers/admincontrollers";
import adminMatchRoutes from "./admin/adminMatchRoutes";
import bracketRoutes from "./admin/bracketRoutes";
import adminRatingRoutes from "./adminRatingRoutes";


const adminRouter = Router();
// TO DO
// Make them protected routes
adminRouter.get("/get-invite", getInviteEmail);
adminRouter.get("/session", getAdminSession);
adminRouter.get("/getadmins", fetchAdmins);
adminRouter.get("/profile/:id", getAdminById);

adminRouter.put("/activity/tracklogin", trackLogin)
adminRouter.put("/account/update", updateAdmin)
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

export default adminRouter;
