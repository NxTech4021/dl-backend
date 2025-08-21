// src/routes/onboarding.ts
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { loadQuestionnaire } from '../services/questionnaire';
import { scorePickleball, scoreTennis, scorePadel } from '../services/scoring';

const prisma = new PrismaClient();
const router = express.Router();

// Serve questions directly from files
router.get('/:sport/questions', (req, res) => {
  const sport = req.params.sport as 'pickleball'|'tennis'|'padel';
  const { def, qHash } = loadQuestionnaire(sport);
  res.set('ETag', qHash).json(def);
});

// Submit answers and save + score (single request flow)
router.post('/:sport/submit', async (req, res) => {
  const sport = req.params.sport as 'pickleball'|'tennis'|'padel';
  const { userId, answers } = req.body as { userId: number; answers: Record<string, any> };

  const { version, qHash } = loadQuestionnaire(sport);

  // Score
  const result =
    sport === 'pickleball' ? scorePickleball(answers) :
    sport === 'tennis'     ? scoreTennis(answers) :
                             scorePadel(answers);

  // Persist
  const response = await prisma.questionnaireResponse.create({
    data: {
      userId, sport, qVersion: version, qHash,
      answersJson: answers, completedAt: new Date(),
      result: { create: result }
    },
    include: { result: true }
  });

  res.json({ responseId: response.id, version, qHash, result: response.result });
});

export default router;
