import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import onboardingRouter from '../src/routes/onboarding';

const app = express();
app.use(express.json());
app.use('/api/onboarding', onboardingRouter);

const prisma = new PrismaClient();

describe('Questionnaire End-to-End Tests', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: 'test.questionnaire@example.com',
        name: 'Test User',
        username: 'testuser_questionnaire',
        displayUsername: 'testuser',
        emailVerified: true,
      }
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.questionnaireResponse.deleteMany({
      where: { userId: testUserId }
    });
    await prisma.user.delete({
      where: { id: testUserId }
    });
  });

  describe('Tennis Questionnaire', () => {
    test('should fetch tennis questionnaire successfully', async () => {
      const response = await request(app)
        .get('/api/onboarding/tennis/questions')
        .expect(200);

      expect(response.body).toHaveProperty('sport', 'tennis');
      expect(response.body).toHaveProperty('version', 1);
      expect(response.body).toHaveProperty('questions');
      expect(Array.isArray(response.body.questions)).toBe(true);
      expect(response.body.questions.length).toBeGreaterThan(0);

      // Check ETag header for caching
      expect(response.headers.etag).toBeDefined();
    });

    test('should submit tennis questionnaire and save to database', async () => {
      const tennisAnswers = {
        experience: "2-4 years",
        frequency: "3-4 times per week",
        competitive_level: "Local competitive events",
        coaching_background: "Regular coaching",
        tournament: "Local tournaments",
        self_rating: "3.0-4.0 (Intermediate)",
        skills: {
          serving: "Intermediate (good first serve placement, reliable second serve)",
          forehand: "Intermediate (good power and placement from baseline)",
          backhand: "Intermediate (good power and placement from baseline)",
          net_play: "Intermediate (good net coverage and volley placement)",
          movement: "Intermediate (good court movement and recovery)",
          mental_game: "Intermediate (good match strategy and point construction)"
        }
      };

      const response = await request(app)
        .post('/api/onboarding/tennis/submit')
        .send({
          userId: testUserId,
          answers: tennisAnswers
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('responseId');
      expect(response.body).toHaveProperty('sport', 'tennis');
      expect(response.body).toHaveProperty('result');
      
      // Verify result structure
      const result = response.body.result;
      expect(result).toHaveProperty('source', 'questionnaire');
      expect(result).toHaveProperty('singles');
      expect(result).toHaveProperty('doubles');
      expect(result).toHaveProperty('rd');
      expect(result).toHaveProperty('confidence');
      expect(['low', 'medium', 'high']).toContain(result.confidence);
      
      // Verify rating is reasonable
      expect(result.singles).toBeGreaterThan(800);
      expect(result.singles).toBeLessThan(8000);
      expect(result.doubles).toBeGreaterThan(800);
      expect(result.doubles).toBeLessThan(8000);

      // Verify data was saved to database
      const savedResponse = await prisma.questionnaireResponse.findFirst({
        where: {
          userId: testUserId,
          sport: 'tennis'
        },
        include: { result: true }
      });

      expect(savedResponse).toBeDefined();
      expect(savedResponse?.answersJson).toEqual(tennisAnswers);
      expect(savedResponse?.result).toBeDefined();
      expect(savedResponse?.result?.singles).toBe(result.singles);
    });

    test('should update existing tennis response when submitting again', async () => {
      const updatedAnswers = {
        experience: "More than 4 years",
        frequency: "5+ times per week",
        competitive_level: "Regional/National competitive events",
        coaching_background: "High-performance/academy coaching",
        tournament: "Regional tournaments",
        self_rating: "4.0-5.0 (Advanced)",
        skills: {
          serving: "Advanced (variety of serves with good placement and power)",
          forehand: "Advanced (excellent control, variety, and tactical awareness)",
          backhand: "Advanced (excellent control, variety, and tactical awareness)",
          net_play: "Advanced (excellent net game and transition play)",
          movement: "Advanced (excellent anticipation and court positioning)",
          mental_game: "Advanced (excellent tactical awareness and mental toughness)"
        }
      };

      const response = await request(app)
        .post('/api/onboarding/tennis/submit')
        .send({
          userId: testUserId,
          answers: updatedAnswers
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Rating should be higher due to better answers
      expect(response.body.result.singles).toBeGreaterThan(1800);

      // Verify only one response exists (updated, not duplicated)
      const responses = await prisma.questionnaireResponse.findMany({
        where: {
          userId: testUserId,
          sport: 'tennis'
        }
      });

      expect(responses).toHaveLength(1);
      expect(responses[0].answersJson).toEqual(updatedAnswers);
    });
  });

  describe('Pickleball Questionnaire', () => {
    test('should submit pickleball questionnaire successfully', async () => {
      const pickleballAnswers = {
        experience: "1-2 years",
        frequency: "3-4 times per week",
        competitive_level: "Social/Club matches",
        coaching_background: "Few lessons",
        tournament: "Local tournaments",
        self_rating: "3.0-3.5 (Intermediate)",
        skills: {
          serving: "Intermediate (consistent underhand serve with good placement)",
          forehand: "Intermediate (good control and placement from mid-court)",
          backhand: "Intermediate (good control and placement from mid-court)",
          net_play: "Intermediate (good dinking and volley technique)",
          movement: "Intermediate (good court positioning and shot anticipation)",
          mental_game: "Intermediate (good understanding of strategy and shot selection)"
        }
      };

      const response = await request(app)
        .post('/api/onboarding/pickleball/submit')
        .send({
          userId: testUserId,
          answers: pickleballAnswers
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sport).toBe('pickleball');
      expect(response.body.result.source).toBe('questionnaire');
    });
  });

  describe('Padel Questionnaire', () => {
    test('should submit padel questionnaire successfully', async () => {
      const padelAnswers = {
        experience: "6 months - 1 year",
        frequency: "1-2 times per week",
        competitive_level: "Recreational only",
        coaching_background: "No coaching",
        tournament: "Never",
        self_rating: "2.0-3.0 (Improver)",
        skills: {
          serving: "Developing (consistent underhand serve, learning placement)",
          forehand: "Developing (can hit basic groundstrokes consistently)",
          backhand: "Developing (can hit basic groundstrokes consistently)",
          net_play: "Developing (basic volley technique, learning positioning)",
          movement: "Developing (understand basic court movement)",
          mental_game: "Developing (basic understanding of tactics and positioning)"
        }
      };

      const response = await request(app)
        .post('/api/onboarding/padel/submit')
        .send({
          userId: testUserId,
          answers: padelAnswers
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sport).toBe('padel');
      expect(response.body.result.source).toBe('questionnaire');
    });
  });

  describe('Get User Responses', () => {
    test('should fetch all user responses', async () => {
      const response = await request(app)
        .get(`/api/onboarding/responses/${testUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.responses).toHaveLength(3); // tennis, pickleball, padel
      
      const sports = response.body.responses.map((r: any) => r.sport);
      expect(sports).toContain('tennis');
      expect(sports).toContain('pickleball');
      expect(sports).toContain('padel');
    });

    test('should fetch specific sport response', async () => {
      const response = await request(app)
        .get(`/api/onboarding/responses/${testUserId}/tennis`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response.sport).toBe('tennis');
      expect(response.body.response.result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should return error for invalid sport', async () => {
      await request(app)
        .get('/api/onboarding/invalid/questions')
        .expect(400);
    });

    test('should return error for missing userId', async () => {
      await request(app)
        .post('/api/onboarding/tennis/submit')
        .send({
          answers: { experience: "1-2 years" }
        })
        .expect(400);
    });

    test('should return error for non-existent user', async () => {
      await request(app)
        .post('/api/onboarding/tennis/submit')
        .send({
          userId: 'non-existent-id',
          answers: { experience: "1-2 years" }
        })
        .expect(404);
    });
  });
});
