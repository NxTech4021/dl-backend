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


export default adminRouter;
