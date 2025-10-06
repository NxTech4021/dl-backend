import { Router } from 'express';
import { getSports } from '../controllers/sportController';

const router = Router();

router.get('/', getSports);

export default router;
