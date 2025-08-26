import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import onboardingRouter from '../src/routes/onboarding';

const app = express();
app.use(express.json());
app.use('/api/onboarding', onboardingRouter);

const prisma = new PrismaClient();

describe('Questionnaire API Tests', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: 'test.api@example.com',
        name: 'Test API User',
        username: 'testapi',
        displayUsername: 'testapi',
        emailVerified: true,
      }
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    try {
      // First delete rating results
      const responses = await (prisma as any).questionnaireResponse.findMany({
        where: { userId: testUserId },
        select: { id: true }
      });
      
      for (const response of responses) {
        await (prisma as any).initialRatingResult.deleteMany({
          where: { responseId: response.id }
        });
      }
      
      // Then delete responses
      await (prisma as any).questionnaireResponse.deleteMany({
        where: { userId: testUserId }
      });
      
      // Finally delete user
      await prisma.user.delete({
        where: { id: testUserId }
      });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
    
    await prisma.$disconnect();
  });

  test('should fetch tennis questionnaire', async () => {
    const response = await request(app)
      .get('/api/onboarding/tennis/questions')
      .expect(200);

    expect(response.body).toHaveProperty('sport', 'tennis');
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('questions');
    expect(Array.isArray(response.body.questions)).toBe(true);
    expect(response.body.questions.length).toBeGreaterThan(0);
  });

  test('should fetch pickleball questionnaire', async () => {
    const response = await request(app)
      .get('/api/onboarding/pickleball/questions')
      .expect(200);

    expect(response.body).toHaveProperty('sport', 'pickleball');
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('questions');
  });

  test('should fetch padel questionnaire', async () => {
    const response = await request(app)
      .get('/api/onboarding/padel/questions')
      .expect(200);

    expect(response.body).toHaveProperty('sport', 'padel');
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('questions');
  });

  test('should submit tennis questionnaire and calculate rating', async () => {
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
    
    const result = response.body.result;
    expect(result).toHaveProperty('source', 'questionnaire');
    expect(result).toHaveProperty('singles');
    expect(result).toHaveProperty('doubles');
    expect(result).toHaveProperty('rd');
    expect(result).toHaveProperty('confidence');
    
    // Verify rating is reasonable for intermediate player
    expect(result.singles).toBeGreaterThan(1000);
    expect(result.singles).toBeLessThan(3000);
    expect(['low', 'medium', 'high']).toContain(result.confidence);

    console.log('Tennis rating result:', result);
  });

  test('should submit pickleball questionnaire', async () => {
    const pickleballAnswers = {
      experience: "1-2 years",
      frequency: "2-3 times per week",
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
    
    console.log('Pickleball rating result:', response.body.result);
  });

  test('should submit padel questionnaire', async () => {
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
    
    console.log('Padel rating result:', response.body.result);
  });

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
    
    console.log('All responses count:', response.body.responses.length);
  });

  test('should handle beginner vs advanced ratings differently', async () => {
    // Create another user for comparison
    const advancedUser = await prisma.user.create({
      data: {
        email: 'advanced.test@example.com',
        name: 'Advanced User',
        username: 'advanced',
        displayUsername: 'advanced',
        emailVerified: true,
      }
    });

    // Beginner answers
    const beginnerAnswers = {
      experience: "Less than 6 months",
      frequency: "Less than once a week",
      competitive_level: "Recreational only",
      coaching_background: "No coaching",
      tournament: "Never",
      self_rating: "1.0-2.0 (Beginner)",
      skills: {
        serving: "Beginner (learning basic serve motion)",
        forehand: "Beginner (learning basic strokes)",
        backhand: "Beginner (learning basic strokes)",
        net_play: "Beginner (rarely come to net, basic volley technique)",
        movement: "Beginner (learning basic court positioning)",
        mental_game: "Beginner (focus mainly on hitting the ball back)"
      }
    };

    // Advanced answers
    const advancedAnswers = {
      experience: "More than 4 years",
      frequency: "5+ times per week",
      competitive_level: "Regional/National competitive events",
      coaching_background: "High-performance/academy coaching",
      tournament: "National/international tournaments",
      self_rating: "5.0-6.0 (Professional)",
      skills: {
        serving: "Advanced (variety of serves with good placement and power)",
        forehand: "Advanced (excellent control, variety, and tactical awareness)",
        backhand: "Advanced (excellent control, variety, and tactical awareness)",
        net_play: "Advanced (excellent net game and transition play)",
        movement: "Advanced (excellent anticipation and court positioning)",
        mental_game: "Advanced (excellent tactical awareness and mental toughness)"
      }
    };

    const beginnerResponse = await request(app)
      .post('/api/onboarding/tennis/submit')
      .send({ userId: testUserId, answers: beginnerAnswers })
      .expect(200);

    const advancedResponse = await request(app)
      .post('/api/onboarding/tennis/submit')
      .send({ userId: advancedUser.id, answers: advancedAnswers })
      .expect(200);

    // Advanced should have significantly higher rating
    expect(advancedResponse.body.result.singles).toBeGreaterThan(beginnerResponse.body.result.singles + 1000);
    
    console.log('Beginner rating:', beginnerResponse.body.result.singles);
    console.log('Advanced rating:', advancedResponse.body.result.singles);
    console.log('Rating difference:', advancedResponse.body.result.singles - beginnerResponse.body.result.singles);

    // Clean up advanced user
    const advancedResponses = await (prisma as any).questionnaireResponse.findMany({
      where: { userId: advancedUser.id },
      select: { id: true }
    });
    
    for (const resp of advancedResponses) {
      await (prisma as any).initialRatingResult.deleteMany({
        where: { responseId: resp.id }
      });
    }
    
    await (prisma as any).questionnaireResponse.deleteMany({
      where: { userId: advancedUser.id }
    });
    
    await prisma.user.delete({ where: { id: advancedUser.id } });
  });

  test('should return error for invalid sport', async () => {
    const response = await request(app)
      .get('/api/onboarding/invalid/questions')
      .expect(400);

    expect(response.body.error).toBe('Invalid sport');
  });

  test('should return error for missing userId', async () => {
    const response = await request(app)
      .post('/api/onboarding/tennis/submit')
      .send({ answers: { experience: "1-2 years" } })
      .expect(400);

    expect(response.body.error).toBe('Missing userId or answers');
  });
});
