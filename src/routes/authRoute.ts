import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '../auth';

const router = express.Router();

// Convert Better Auth handler to work with Express.js
const authHandler = toNodeHandler(auth);

// Better Auth handles all authentication routes internally
// Just pass all requests to the handler
router.all('/*', authHandler);

export default router;
