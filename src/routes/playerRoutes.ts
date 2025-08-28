import { Router } from 'express';

import { getAllPlayers, getPlayerById, getPlayerStats } from '../controllers/playerController';

const playerRouter = Router();

playerRouter.get('/', getAllPlayers);

playerRouter.get('/stats', getPlayerStats);

playerRouter.get('/:id', getPlayerById);

export default playerRouter;


