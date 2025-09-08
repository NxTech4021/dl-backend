import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware";
import {
  adminLogin,
  createSuperadmin,
  getInviteEmail,
  registerAdmin,
  sendAdminInvite,
  getAdminSession,
  // adminLogout,
  fetchAdmins,
  getAdminById,
  updateAdmin
} from "../controllers/admincontrollers";


const adminrouter = Router();
// TO DO
// Make them protected routes
adminrouter.get("/get-invite", getInviteEmail);
adminrouter.get("/session", getAdminSession);
adminrouter.get("/getadmins", fetchAdmins);
adminrouter.get("/profile/:id", getAdminById);

adminrouter.put("/account/update", updateAdmin)
adminrouter.post("/superadmin", createSuperadmin);
adminrouter.post("/register", registerAdmin);
adminrouter.post("/invite", sendAdminInvite);
adminrouter.post("/adminlogin", adminLogin);
// adminrouter.post("/logout", adminLogout);

export default adminrouter;
