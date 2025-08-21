// src/routes/onboarding.ts
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { loadQuestionnaire } from '../services/questionnaire';
import { scorePickleball, scoreTennis, scorePadel } from '../services/scoring';

const prisma = new PrismaClient();
const router = express.Router();

// Serve questions directly from files
router.get('/:sport/questions', (req, res) => {
  try {
    const sport = req.params.sport as 'pickleball'|'tennis'|'padel';
    
    if (!['pickleball', 'tennis', 'padel'].includes(sport)) {
      return res.status(400).json({ error: 'Invalid sport' });
    }
    
    const { def, qHash } = loadQuestionnaire(sport);
    res.set('ETag', qHash).json(def);
  } catch (error) {
    console.error('Error loading questionnaire:', error);
    res.status(500).json({ error: 'Failed to load questionnaire' });
  }
});

// Submit answers and save + score (single request flow)
router.post('/:sport/submit', async (req, res) => {
  try {
    const sport = req.params.sport as 'pickleball'|'tennis'|'padel';
    
    if (!['pickleball', 'tennis', 'padel'].includes(sport)) {
      return res.status(400).json({ error: 'Invalid sport' });
    }
    
    const { userId, answers } = req.body as { userId: string; answers: Record<string, any> };

    if (!userId || !answers) {
      return res.status(400).json({ error: 'Missing userId or answers' });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { version, qHash } = loadQuestionnaire(sport);

    // Score
    let result;
    if (sport === 'pickleball') {
      result = scorePickleball(answers);
    } else if (sport === 'tennis') {
      result = scoreTennis(answers);
    } else {
      result = scorePadel(answers);
    }

    // Check if user already has a response for this sport
    const existingResponse = await prisma.questionnaireResponse.findFirst({
      where: {
        userId,
        sport
      },
      include: { result: true }
    });

    let response;
    if (existingResponse) {
      // Update existing response
      response = await prisma.questionnaireResponse.update({
        where: { id: existingResponse.id },
        data: {
          qVersion: version,
          qHash,
          answersJson: answers,
          completedAt: new Date(),
          result: {
            upsert: {
              create: result,
              update: result
            }
          }
        },
        include: { result: true }
      });
    } else {
      // Create new response
      response = await prisma.questionnaireResponse.create({
        data: {
          userId, sport, qVersion: version, qHash,
          answersJson: answers, completedAt: new Date(),
          result: { create: result }
        },
        include: { result: true }
      });
    }

    res.json({ 
      responseId: response.id, 
      version, 
      qHash, 
      result: response.result,
      sport,
      success: true
    });
  } catch (error) {
    console.error('Error submitting questionnaire:', error);
    res.status(500).json({ error: 'Failed to submit questionnaire' });
  }
});

// Get user's questionnaire responses
router.get('/responses/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const responses = await prisma.questionnaireResponse.findMany({
      where: { userId },
      include: { result: true },
      orderBy: { completedAt: 'desc' }
    });

    res.json({ responses, success: true });
  } catch (error) {
    console.error('Error fetching responses:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

// Get specific sport response for user
router.get('/responses/:userId/:sport', async (req, res) => {
  try {
    const { userId, sport } = req.params;
    
    if (!['pickleball', 'tennis', 'padel'].includes(sport)) {
      return res.status(400).json({ error: 'Invalid sport' });
    }
    
    const response = await prisma.questionnaireResponse.findFirst({
      where: { 
        userId,
        sport 
      },
      include: { result: true },
      orderBy: { completedAt: 'desc' }
    });

    if (!response) {
      return res.status(404).json({ error: 'No response found for this sport' });
    }

    res.json({ response, success: true });
  } catch (error) {
    console.error('Error fetching sport response:', error);
    res.status(500).json({ error: 'Failed to fetch sport response' });
  }
});

export default router;
