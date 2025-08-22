import { Router } from 'express';

import { adminLogin, createSuperadmin, sendAdminInvite } from '../controllers/admincontrollers';


const adminrouter = Router();

adminrouter.post('/superadmin', createSuperadmin);


adminrouter.post('/invite', sendAdminInvite);
adminrouter.post('/adminlogin', adminLogin);



export default adminrouter;