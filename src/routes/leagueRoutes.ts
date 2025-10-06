import { Router } from "express";
import {
  createLeague,
  listLeagues,
  getLeagueById,
  updateLeague,
  deleteLeague,
  getLeagueSettings,
  updateLeagueSettings,
  previewLeagueSettings,
  listLeagueJoinRequests,
  createLeagueJoinRequest,
  updateLeagueJoinRequestStatus,
  listLeagueTemplates,
  createLeagueTemplate,
  bulkCreateLeagues,
  copyLeagueSettings,
  getSportOptions,
  getLocationOptions,
  searchSports,
  searchLocations,
} from "../controllers/leagueController";
import { requireLeagueAdmin, validateAdminId, optionalAuth } from "../middlewares/permissions";

const leagueRouter = Router();

// Public routes (no authentication required)
leagueRouter.get("/", optionalAuth(), listLeagues);
leagueRouter.get("/sports", getSportOptions);
leagueRouter.get("/locations", getLocationOptions);
leagueRouter.get("/sports/search", searchSports);
leagueRouter.get("/locations/search", searchLocations);

// Admin-only routes for templates (must be before /:leagueId to avoid param matching)
leagueRouter.get("/templates", requireLeagueAdmin, listLeagueTemplates);
leagueRouter.post("/templates", requireLeagueAdmin, validateAdminId(), createLeagueTemplate);

// Admin-only bulk operations (must be before /:leagueId to avoid param matching)
leagueRouter.post("/bulk/create", requireLeagueAdmin, validateAdminId(), bulkCreateLeagues);
leagueRouter.post("/bulk/copy-settings", requireLeagueAdmin, validateAdminId(), copyLeagueSettings);

// Admin-only routes for league management
leagueRouter.post("/", requireLeagueAdmin, validateAdminId(), createLeague);

// Specific ID routes (must be after more specific routes like /templates and /bulk)
leagueRouter.get("/:leagueId", optionalAuth(), getLeagueById);
leagueRouter.put("/:leagueId", requireLeagueAdmin, validateAdminId(), updateLeague);
leagueRouter.delete("/:leagueId", requireLeagueAdmin, validateAdminId(), deleteLeague);

// Admin-only routes for league settings
leagueRouter.get("/:leagueId/settings", requireLeagueAdmin, getLeagueSettings);
leagueRouter.put("/:leagueId/settings", requireLeagueAdmin, validateAdminId(), updateLeagueSettings);
leagueRouter.post("/:leagueId/settings/preview", requireLeagueAdmin, previewLeagueSettings);

// Admin-only routes for join requests
leagueRouter.get("/:leagueId/join-requests", requireLeagueAdmin, listLeagueJoinRequests);
leagueRouter.post("/:leagueId/join-requests", optionalAuth(), createLeagueJoinRequest); // Players can create requests
leagueRouter.patch("/:leagueId/join-requests/:requestId", requireLeagueAdmin, validateAdminId(), updateLeagueJoinRequestStatus);

export default leagueRouter;
