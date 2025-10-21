import { Router } from 'express';
import { getAllSponsors, createSponsor, getSponsorById, updateSponsor, deleteSponsor } from '../controllers/sponsorController';

const sponsorRoutes = Router();

sponsorRoutes.get('/', getAllSponsors);
sponsorRoutes.post('/create', createSponsor);
sponsorRoutes.get('/:id', getSponsorById);
sponsorRoutes.put('/:id', updateSponsor);
sponsorRoutes.delete('/:id', deleteSponsor);

export default sponsorRoutes;