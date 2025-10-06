import { Router } from 'express';
import { 
  getRegistrations, 
  getRegistrationById, 
  registerPlayer,
  registerTeam,
  updateRegistration, 
  cancelRegistration,
  deleteRegistration 
} from '../controllers/registrationController';

const router = Router();

router.get('/', getRegistrations);
router.get('/:id', getRegistrationById);
router.post('/player', registerPlayer);
router.post('/team', registerTeam);
router.put('/:id', updateRegistration);
router.patch('/:id/cancel', cancelRegistration);
router.delete('/:id', deleteRegistration);

export default router;


