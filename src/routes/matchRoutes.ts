import { Router } from "express";
import { createMatch, updateMatch, getMatchById, getMatches, deleteMatch } from "../controllers/matchController";


const matchRoutes = Router();

matchRoutes.post("/create", createMatch);
matchRoutes.get('/', getMatches);
matchRoutes.get('/:id', getMatchById); 
matchRoutes.put('/:id', updateMatch);
matchRoutes.delete('/delete/:id', deleteMatch);


export default matchRoutes;