import { Router } from "express";
import { verifyAuth } from "../middlewares/auth.middleware";
import { matchJoinLimiter, scoreSubmissionLimiter, commentLimiter } from '../middlewares/rateLimiter';
import {
  createFriendlyMatch,
  getFriendlyMatches,
  getFriendlyMatchById,
  getFriendlyMatchDetails,
  getFriendlyMatchesSummary,
  joinFriendlyMatch,
  submitFriendlyResult,
  confirmFriendlyResult,
  acceptFriendlyMatchRequest,
  declineFriendlyMatchRequest,
  cancelFriendlyMatch,
  leaveFriendlyMatch,
  updateFriendlyMatchDetails,
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
friendlyRoutes.get("/summary", getFriendlyMatchesSummary); // Lightweight endpoint for change detection
friendlyRoutes.get("/", getFriendlyMatches);
friendlyRoutes.get("/:id/details", getFriendlyMatchDetails); // Full match details for UI display
friendlyRoutes.get("/:id", getFriendlyMatchById);
friendlyRoutes.post("/:id/join", matchJoinLimiter, joinFriendlyMatch);
friendlyRoutes.post("/:id/result", scoreSubmissionLimiter, submitFriendlyResult);
friendlyRoutes.post("/:id/confirm", scoreSubmissionLimiter, confirmFriendlyResult);
friendlyRoutes.post("/:id/accept", acceptFriendlyMatchRequest);
friendlyRoutes.post("/:id/decline", declineFriendlyMatchRequest);
friendlyRoutes.post("/:id/cancel", cancelFriendlyMatch);
friendlyRoutes.post("/:id/leave", leaveFriendlyMatch);
friendlyRoutes.patch("/:id/details", updateFriendlyMatchDetails);

// Comments
friendlyRoutes.get("/:id/comments", getFriendlyMatchComments);
friendlyRoutes.post("/:id/comment", commentLimiter, postFriendlyMatchComment);
friendlyRoutes.put("/:id/comment/:commentId", updateFriendlyMatchComment);
friendlyRoutes.delete("/:id/comment/:commentId", deleteFriendlyMatchComment);

export default friendlyRoutes;
