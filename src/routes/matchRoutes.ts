import { Router } from "express";
import { verifyAuth } from "../middlewares/auth.middleware";
import {
  updateMatch,
  deleteMatch,
  getMatchComments,
  postMatchComment,
  updateMatchComment,
  deleteMatchComment
} from "../controllers/matchController";
import {
  createMatch,
  getMatches,
  getMatchById,
  getAvailableMatches,
  getMyMatches,
  getMyMatchesSummary,
  joinMatch,
  respondToInvitation,
  proposeTimeSlot,
  voteForTimeSlot,
  confirmTimeSlot,
  getPendingInvitations,
  getInvitationById
} from "../controllers/match/matchInvitationController";
import {
  submitResult,
  confirmResult,
  submitWalkover,
  getMatchResult,
  getDisputeById
} from "../controllers/match/matchResultController";
import {
  cancelMatch,
  requestReschedule,
  getCancellationRuleImpact,
  continueMatch
} from "../controllers/match/matchScheduleController";
import {
  getMatchHistory,
  getMatchStats,
  getHeadToHead,
  getUpcomingMatches,
  getRecentResults,
  getPendingConfirmationMatches,
  getDisputedMatches,
  getDivisionResults
} from "../controllers/match/matchHistoryController";

const matchRoutes = Router();

// Apply authentication middleware to all routes
matchRoutes.use(verifyAuth);

// Match CRUD (using new invitation service)
matchRoutes.post("/create", createMatch);
matchRoutes.get('/', getMatches);
matchRoutes.get('/my/summary', getMyMatchesSummary); // Lightweight endpoint for change detection
matchRoutes.get('/my', getMyMatches);
matchRoutes.get('/available/:divisionId', getAvailableMatches);
matchRoutes.get('/:id', getMatchById);

// Legacy endpoints (kept for backwards compatibility)
matchRoutes.put('/:id', updateMatch);
matchRoutes.delete('/delete/:id', deleteMatch);

// Join match
matchRoutes.post('/:id/join', joinMatch);

// Invitations
matchRoutes.get('/invitations/pending', getPendingInvitations);
matchRoutes.get('/invitations/:id', getInvitationById);
matchRoutes.post('/invitations/:id/respond', respondToInvitation);

// Results
matchRoutes.get('/:id/result', getMatchResult);
matchRoutes.post('/:id/result', submitResult);
matchRoutes.post('/:id/confirm', confirmResult);
matchRoutes.post('/:id/walkover', submitWalkover);

// Disputes
matchRoutes.get('/disputes/:id', getDisputeById);

// Cancel/Reschedule
matchRoutes.get('/:id/cancel-impact', getCancellationRuleImpact);
matchRoutes.post('/:id/cancel', cancelMatch);
matchRoutes.post('/:id/reschedule', requestReschedule);
// Note: walkover endpoint is defined in Results section (line 75) using submitWalkover
// recordWalkover was a duplicate that was never reachable - removed
matchRoutes.post('/:id/continue', continueMatch);

// History and Statistics
matchRoutes.get('/history', getMatchHistory);
matchRoutes.get('/stats', getMatchStats);
matchRoutes.get('/upcoming', getUpcomingMatches);
matchRoutes.get('/recent', getRecentResults);
matchRoutes.get('/pending-confirmation', getPendingConfirmationMatches);
matchRoutes.get('/disputed', getDisputedMatches);
matchRoutes.get('/head-to-head/:opponentId', getHeadToHead);
matchRoutes.get('/division/:divisionId/results', getDivisionResults);

// Comments
matchRoutes.get('/:id/comments', getMatchComments);
matchRoutes.post('/:id/comment', postMatchComment);
matchRoutes.put('/:id/comment/:commentId', updateMatchComment);
matchRoutes.delete('/:id/comment/:commentId', deleteMatchComment);

export default matchRoutes;
