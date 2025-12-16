import { Router } from "express";
import { verifyAuth } from "../middlewares/auth.middleware";
import {
  createFriendlyMatch,
  getFriendlyMatches,
  getFriendlyMatchById,
  joinFriendlyMatch,
  submitFriendlyResult,
  confirmFriendlyResult,
  acceptFriendlyMatchRequest,
  declineFriendlyMatchRequest
} from "../controllers/friendlyMatchController";

const friendlyRoutes = Router();

// Apply authentication middleware to all routes
friendlyRoutes.use(verifyAuth);

// Friendly match routes
friendlyRoutes.post("/create", createFriendlyMatch);
friendlyRoutes.get("/", getFriendlyMatches);
friendlyRoutes.get("/:id", getFriendlyMatchById);
friendlyRoutes.post("/:id/join", joinFriendlyMatch);
friendlyRoutes.post("/:id/result", submitFriendlyResult);
friendlyRoutes.post("/:id/confirm", confirmFriendlyResult);
friendlyRoutes.post("/:id/accept", acceptFriendlyMatchRequest);
friendlyRoutes.post("/:id/decline", declineFriendlyMatchRequest);

export default friendlyRoutes;
