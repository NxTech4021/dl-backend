import { Router } from 'express';
import { getAllSponsors, createSponsor, getSponsorById, updateSponsor, deleteSponsor } from '../controllers/sponsorController';
import { verifyAuth, requireAdmin } from '../middlewares/auth.middleware';

const sponsorRoutes = Router();

sponsorRoutes.get('/', getAllSponsors);
sponsorRoutes.post('/create', verifyAuth, requireAdmin, createSponsor);
sponsorRoutes.get('/:id', getSponsorById);
sponsorRoutes.put('/:id', verifyAuth, requireAdmin, updateSponsor);
sponsorRoutes.delete('/:id', verifyAuth, requireAdmin, deleteSponsor);

export default sponsorRoutes;