import { Router } from "express";
import { createSeason, getSeasons, updateSeason} from "../controllers/seasonController";


const seasonRouter = Router();

seasonRouter.post("/create", createSeason);
seasonRouter.get('/getall', getSeasons);
seasonRouter.get('/:id', getSeasons); 
seasonRouter.put('/:id', updateSeason);


export default seasonRouter;