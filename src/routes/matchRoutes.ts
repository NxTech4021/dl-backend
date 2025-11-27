import { Router } from "express";
import { updateMatch, deleteMatch } from "../controllers/matchController";
import {
  createMatch,
  getMatches,
  getMatchById,
  getAvailableMatches,
  getMyMatches,
  joinMatch,
  respondToInvitation,
  proposeTimeSlot,
  voteForTimeSlot,
  confirmTimeSlot
} from "../controllers/match/matchInvitationController";
import {
  submitResult,
  confirmResult,
  submitWalkover,
  getMatchResult
} from "../controllers/match/matchResultController";
import {
  cancelMatch,
  requestReschedule,
  getCancellationRuleImpact,
  recordWalkover,
  continueMatch
} from "../controllers/match/matchScheduleController";
import {
  getMatchHistory,
  getMatchStats,
  getHeadToHead,
  getUpcomingMatches,
  getRecentResults
} from "../controllers/match/matchHistoryController";

const matchRoutes = Router();

// Match CRUD (using new invitation service)
matchRoutes.post("/create", createMatch);
matchRoutes.get('/', getMatches);
matchRoutes.get('/my', getMyMatches);
matchRoutes.get('/available/:divisionId', getAvailableMatches);
matchRoutes.get('/:id', getMatchById);

// Legacy endpoints (kept for backwards compatibility)
matchRoutes.put('/:id', updateMatch);
matchRoutes.delete('/delete/:id', deleteMatch);

// Join match
matchRoutes.post('/:id/join', joinMatch);

// Time slots
matchRoutes.post('/:id/timeslots', proposeTimeSlot);
matchRoutes.post('/timeslots/:id/vote', voteForTimeSlot);
matchRoutes.post('/timeslots/:id/confirm', confirmTimeSlot);

// Invitations
matchRoutes.post('/invitations/:id/respond', respondToInvitation);

// Results
matchRoutes.get('/:id/result', getMatchResult);
matchRoutes.post('/:id/result', submitResult);
matchRoutes.post('/:id/confirm', confirmResult);
matchRoutes.post('/:id/walkover', submitWalkover);

// Cancel/Reschedule
matchRoutes.get('/:id/cancel-impact', getCancellationRuleImpact);
matchRoutes.post('/:id/cancel', cancelMatch);
matchRoutes.post('/:id/reschedule', requestReschedule);
matchRoutes.post('/:id/walkover', recordWalkover);
matchRoutes.post('/:id/continue', continueMatch);

// History and Statistics
matchRoutes.get('/history', getMatchHistory);
matchRoutes.get('/stats', getMatchStats);
matchRoutes.get('/upcoming', getUpcomingMatches);
matchRoutes.get('/recent', getRecentResults);
matchRoutes.get('/head-to-head/:opponentId', getHeadToHead);

export default matchRoutes;
