import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth';

const app = express();

// Set up CORS
app.use(cors({
  origin: ['http://localhost:82', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// According to the official Express documentation for better-auth,
// the auth handler must be mounted BEFORE express.json().
// The "/api/auth/*" pattern is recommended for Express v4.
app.all("/api/auth/*splat", toNodeHandler(auth));

// The JSON parser for any other routes you might add later.
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

export default app;