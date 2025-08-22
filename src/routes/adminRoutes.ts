import { Router } from 'express';

import { adminLogin, createSuperadmin, getInviteEmail, registerAdmin, sendAdminInvite } from '../controllers/admincontrollers';


const adminrouter = Router();

adminrouter.get("/get-invite", getInviteEmail);

adminrouter.post('/superadmin', createSuperadmin);
adminrouter.post('/register', registerAdmin);

adminrouter.post('/invite', sendAdminInvite);
adminrouter.post('/adminlogin', adminLogin);



export default adminrouter;


