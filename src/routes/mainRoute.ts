import express from 'express';

import { auth } from '../auth';


const router = express.Router();

import adminrouter from './adminRoutes';
import onboardingRoutes from './onboarding'
// import featureRouter from './featureRoutes';




router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// router.get("/me", async (req, res) => {
//   const session = await auth.api.getSession({ headers: req.headers });
//   if (!session) {
//     return res.status(401).json({ message: "Not logged in" });
//   }
//   res.json(session);
// });


// router.use('/chat', chatRouter);
router.use("/api/admin", adminrouter);




export default router;
