import { Router } from "express";
import { createSeason, getSeasons, updateSeason, deleteSeason} from "../controllers/seasonController";


const seasonRouter = Router();

seasonRouter.post("/create", createSeason);
seasonRouter.get('/getall', getSeasons);
seasonRouter.get('/:id', getSeasons); 
seasonRouter.put('/:id', updateSeason);
seasonRouter.delete('/:id', deleteSeason);


export default seasonRouter;