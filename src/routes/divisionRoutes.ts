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
    getDivisionSummaryBySeasonId,
    backfillDivisionStandings,
    syncDivisionCounts
} from "../controllers/divisionController";
import { verifyAuth, requireAdmin } from "../middlewares/auth.middleware";

const divisionRoutes = Router();

// Division CRUD
divisionRoutes.post("/create", verifyAuth, requireAdmin, createDivision);
divisionRoutes.get('/', verifyAuth, getDivisions);
divisionRoutes.get('/:id', verifyAuth, getDivisionById);
divisionRoutes.put('/:id', verifyAuth, requireAdmin, updateDivision);
divisionRoutes.delete('/delete/:id', verifyAuth, requireAdmin, deleteDivision);

divisionRoutes.get("/season/:seasonId", verifyAuth, getDivisionsBySeasonId);
divisionRoutes.get("/season/:seasonId/summary", verifyAuth, getDivisionSummaryBySeasonId);


// Manual assignment
divisionRoutes.post("/assign", verifyAuth, requireAdmin, assignPlayerToDivision);
divisionRoutes.delete("/:divisionId/users/:userId", verifyAuth, requireAdmin, removePlayerFromDivision);

// Get assignments
divisionRoutes.get("/divisions/:divisionId", verifyAuth, getDivisionAssignments);
divisionRoutes.get("/users/:userId", verifyAuth, getUserDivisionAssignments);

// Bulk operations
divisionRoutes.post("/auto-assign", verifyAuth, requireAdmin, autoAssignPlayersToDivisions);
divisionRoutes.post("/transfer", verifyAuth, requireAdmin, transferPlayerBetweenDivisions);

//  Utility

// Backfill standings for existing players
divisionRoutes.post("/backfill-standings", verifyAuth, requireAdmin, backfillDivisionStandings);

// Sync division counts (fix standing issues - if any )
divisionRoutes.post("/sync-counts", verifyAuth, requireAdmin, syncDivisionCounts);


export default divisionRoutes;