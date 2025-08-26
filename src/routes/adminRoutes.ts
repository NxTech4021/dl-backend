import { Router } from 'express';

import { adminLogin, createSuperadmin, getInviteEmail, registerAdmin, sendAdminInvite, getAdminSession, adminLogout } from '../controllers/admincontrollers';


const adminrouter = Router();

adminrouter.get("/get-invite", getInviteEmail);

adminrouter.post('/superadmin', createSuperadmin);
adminrouter.post('/register', registerAdmin);

adminrouter.post('/invite', sendAdminInvite);
adminrouter.post('/adminlogin', adminLogin);
adminrouter.get('/session', getAdminSession);
adminrouter.post('/logout', adminLogout);



export default adminrouter;


