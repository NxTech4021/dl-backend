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
  declineFriendlyMatchRequest,
  getFriendlyMatchComments,
  postFriendlyMatchComment,
  updateFriendlyMatchComment,
  deleteFriendlyMatchComment
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

// Comments
friendlyRoutes.get("/:id/comments", getFriendlyMatchComments);
friendlyRoutes.post("/:id/comment", postFriendlyMatchComment);
friendlyRoutes.put("/:id/comment/:commentId", updateFriendlyMatchComment);
friendlyRoutes.delete("/:id/comment/:commentId", deleteFriendlyMatchComment);

export default friendlyRoutes;
