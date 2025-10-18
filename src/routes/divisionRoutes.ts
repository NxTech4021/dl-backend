import { Router } from "express";
import { createDivision, getDivisionById, getDivisions, updateDivision, deleteDivision } from "../controllers/divisionController";

const divisionRoutes = Router();

divisionRoutes.post("/create", createDivision);
divisionRoutes.get('/', getDivisions);
divisionRoutes.get('/:id', getDivisionById); 
divisionRoutes.put('/:id', updateDivision);
divisionRoutes.delete('/delete/:id', deleteDivision);


export default divisionRoutes;