import { Router } from "express";
import { 
    createDivision,
    getDivisionById, 
    getDivisions, 
    updateDivision, 
    deleteDivision,
    assignPlayerToDivision,
    removePlayerFromDivision,
    getDivisionAssignments,
    getUserDivisionAssignments,
    autoAssignPlayersToDivisions,
    transferPlayerBetweenDivisions,
    getDivisionsBySeasonId,
    getDivisionSummaryBySeasonId
} from "../controllers/divisionController";

const divisionRoutes = Router();

// Division CRUD
divisionRoutes.post("/create", createDivision);
divisionRoutes.get('/', getDivisions);
divisionRoutes.get('/:id', getDivisionById); 
divisionRoutes.put('/:id', updateDivision);
divisionRoutes.delete('/delete/:id', deleteDivision);

divisionRoutes.get("/season/:seasonId", getDivisionsBySeasonId);
divisionRoutes.get("/season/:seasonId/summary", getDivisionSummaryBySeasonId);


// Manual assignment
divisionRoutes.post("/assign", assignPlayerToDivision);
divisionRoutes.delete("/:divisionId/users/:userId", removePlayerFromDivision);

// Get assignments
divisionRoutes.get("/divisions/:divisionId", getDivisionAssignments);
divisionRoutes.get("/users/:userId", getUserDivisionAssignments);

// Bulk operations
divisionRoutes.post("/auto-assign", autoAssignPlayersToDivisions);
divisionRoutes.post("/transfer", transferPlayerBetweenDivisions);


export default divisionRoutes;