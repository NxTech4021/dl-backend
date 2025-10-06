import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware";
import {
  // adminLogin,
  createSuperadmin,
  getInviteEmail,
  registerAdmin,
  sendAdminInvite,
  getAdminSession,
  // adminLogout,
  fetchAdmins,
  getAdminById,
  updateAdmin,
  updatePassword
} from "../controllers/admincontrollers";


const adminRouter = Router();
// TO DO
// Make them protected routes
adminRouter.get("/get-invite", getInviteEmail);
adminRouter.get("/session", getAdminSession);
adminRouter.get("/getadmins", fetchAdmins);
adminRouter.get("/profile/:id", getAdminById);

adminRouter.put("/account/update", updateAdmin)
adminRouter.post("/superadmin", createSuperadmin);
adminRouter.post("/register", registerAdmin);
adminRouter.post("/invite", sendAdminInvite);
adminRouter.post("/updatepassword", updatePassword);
// adminRouter.post("/logout", adminLogout);

export default adminRouter;
