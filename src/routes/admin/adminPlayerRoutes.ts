/**
 * Admin Player Routes
 * Routes for player management operations (ban, unban, delete, status)
 */

import { Router } from 'express';
import {
  banPlayer,
  unbanPlayer,
  deletePlayer,
  updatePlayerStatus,
  getPlayerStatusHistory,
  getPlayers,
  updatePlayer,
  getPlayerDetails
} from '../../controllers/admin/adminPlayerController';

const router = Router();

// List players with optional status filter
// GET /api/admin/players?status=BANNED&page=1&limit=20&search=john
router.get('/', getPlayers);

// Ban a player
// POST /api/admin/players/:id/ban
// Body: { reason: string, notes?: string }
router.post('/:id/ban', banPlayer);

// Unban a player
// POST /api/admin/players/:id/unban
// Body: { notes?: string }
router.post('/:id/unban', unbanPlayer);

// Delete a player (soft delete by default)
// DELETE /api/admin/players/:id
// Body: { reason: string, hardDelete?: boolean }
router.delete('/:id', deletePlayer);

// Update player status
// PATCH /api/admin/players/:id/status
// Body: { status: UserStatus, notes?: string }
router.patch('/:id/status', updatePlayerStatus);

// Get player status history
// GET /api/admin/players/:id/status-history
router.get('/:id/status-history', getPlayerStatusHistory);

// Get player details (admin view)
// GET /api/admin/players/:id
router.get('/:id', getPlayerDetails);

// Update player profile (admin)
// PUT /api/admin/players/:id
// Body: { name?, email?, phoneNumber?, area?, bio?, gender?, dateOfBirth? }
router.put('/:id', updatePlayer);

export default router;
