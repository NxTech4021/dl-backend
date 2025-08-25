import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import onboardingRouter from '../src/routes/onboarding';
import QuestionnaireService from '../src/services/questionnaire';
import QuestionnaireValidator from '../src/validators/questionnaire';
import Logger from '../src/utils/logger';
import { ValidationError, UserNotFoundError } from '../src/types/questionnaire';

// Mock external dependencies
jest.mock('../src/utils/logger');
jest.mock('../src/services/questionnaire');

const app = express();
app.use(express.json());
app.use('/api/onboarding', onboardingRouter);

const prisma = new PrismaClient();

describe('Production Questionnaire System Tests', () => {
  let testUserId: string;
  let mockLogger: jest.Mocked<Logger>;
  let mockQuestionnaireService: jest.Mocked<QuestionnaireService>;

  beforeAll(async () => {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: 'production.test@example.com',
        name: 'Production Test User',
        username: 'production_test',
        displayUsername: 'productiontest',
        emailVerified: true,
      }
    });
    testUserId = testUser.id;

    // Setup mocks
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      questionnaireRequested: jest.fn(),
      questionnaireLoaded: jest.fn(),
      responseSubmitted: jest.fn(),
      scoringCompleted: jest.fn(),
      validationFailed: jest.fn(),
      databaseOperation: jest.fn(),
    } as any;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);
  });

  afterAll(async () => {
    // Clean up
    await prisma.questionnaireResponse.deleteMany({
      where: { userId: testUserId }
    });
    await prisma.user.delete({
      where: { id: testUserId }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    test('should reject invalid sport parameter', async () => {
      const response = await request(app)
        .get('/api/onboarding/invalid-sport/questions')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'VALIDATION_ERROR'
      });
      expect(mockLogger.validationFailed).toHaveBeenCalled();
    });

    test('should reject submission with missing userId', async () => {
      const response = await request(app)
        .post('/api/onboarding/tennis/submit')
        .send({
          answers: { experience: "1-2 years" }
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'VALIDATION_ERROR'
      });
    });

    test('should reject submission with invalid answers format', async () => {
      const response = await request(app)
        .post('/api/onboarding/tennis/submit')
        .send({
          userId: testUserId,
          answers: "invalid-format"
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'VALIDATION_ERROR'
      });
    });

    test('should reject submission with excessively long userId', async () => {
      const longUserId = 'a'.repeat(101); // Over 100 character limit
      
      const response = await request(app)
        .post('/api/onboarding/tennis/submit')
        .send({
          userId: longUserId,
          answers: { experience: "1-2 years" }
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'VALIDATION_ERROR'
      });
    });
  });

  describe('Security and Sanitization', () => {
    test('should sanitize HTML in answer values', async () => {
      const maliciousAnswers = {
        experience: "1-2 years",
        comment: "<script>alert('xss')</script>Clean comment"
      };

      const response = await request(app)
        .post('/api/onboarding/tennis/submit')
        .send({
          userId: testUserId,
          answers: maliciousAnswers
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify the data was sanitized in database
      const savedResponse = await prisma.questionnaireResponse.findFirst({
        where: { userId: testUserId, sport: 'tennis' }
      });
      
      const savedAnswers = savedResponse?.answersJson as any;
      expect(savedAnswers.comment).not.toContain('<script>');
      expect(savedAnswers.comment).toContain('Clean comment');
    });

    test('should handle deeply nested malicious objects', async () => {
      const nestedMaliciousAnswers = {
        skills: {
          serving: "Intermediate",
          description: "<img src=x onerror=alert('xss')>Good serve"
        }
      };

      const response = await request(app)
        .post('/api/onboarding/tennis/submit')
        .send({
          userId: testUserId,
          answers: nestedMaliciousAnswers
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent user gracefully', async () => {
      const response = await request(app)
        .post('/api/onboarding/tennis/submit')
        .send({
          userId: 'non-existent-user-id',
          answers: { experience: "1-2 years" }
        })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        code: 'USER_NOT_FOUND'
      });
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('should handle questionnaire loading errors', async () => {
      // Mock service to return error
      const mockService = {
        loadQuestionnaire: jest.fn().mockResolvedValue({
          isFailure: () => true,
          getError: () => new Error('File not found')
        })
      };

      (QuestionnaireService as jest.Mock).mockImplementation(() => mockService);

      const response = await request(app)
        .get('/api/onboarding/tennis/questions')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Performance and Timeouts', () => {
    test('should handle database timeouts gracefully', async () => {
      // This test would require mocking Prisma to simulate timeout
      // For now, we'll test the error handling path
      jest.spyOn(prisma.user, 'findUnique').mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database timeout')), 100);
        }) as any;
      });

      const response = await request(app)
        .post('/api/onboarding/tennis/submit')
        .send({
          userId: testUserId,
          answers: { experience: "1-2 years" }
        })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        code: 'DATABASE_ERROR'
      });

      // Restore original implementation
      jest.restoreAllMocks();
    });
  });

  describe('Request Correlation and Logging', () => {
    test('should include request ID in response headers', async () => {
      const response = await request(app)
        .get('/api/onboarding/tennis/questions')
        .set('X-Request-ID', 'test-request-123');

      expect(response.headers['x-request-id']).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/onboarding/tennis/questions'),
        expect.objectContaining({
          requestId: expect.any(String)
        })
      );
    });

    test('should generate request ID when not provided', async () => {
      const response = await request(app)
        .get('/api/onboarding/tennis/questions');

      expect(response.headers['x-request-id']).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('Caching Headers', () => {
    test('should include proper caching headers for questionnaire endpoint', async () => {
      const response = await request(app)
        .get('/api/onboarding/tennis/questions')
        .expect(200);

      expect(response.headers.etag).toBeDefined();
      expect(response.headers['cache-control']).toContain('public');
      expect(response.headers['cache-control']).toContain('max-age=300');
    });

    test('should return 304 when ETag matches', async () => {
      const firstResponse = await request(app)
        .get('/api/onboarding/tennis/questions');

      const etag = firstResponse.headers.etag;

      const secondResponse = await request(app)
        .get('/api/onboarding/tennis/questions')
        .set('If-None-Match', etag)
        .expect(304);

      expect(secondResponse.body).toEqual({});
    });
  });

  describe('Data Consistency', () => {
    test('should handle concurrent submissions properly', async () => {
      const answers = {
        experience: "1-2 years",
        frequency: "2-3 times per week",
        competitive_level: "Recreational only"
      };

      // Submit multiple requests concurrently
      const promises = Array.from({ length: 3 }, () =>
        request(app)
          .post('/api/onboarding/tennis/submit')
          .send({
            userId: testUserId,
            answers
          })
      );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should only have one response in database (updates, not duplicates)
      const savedResponses = await prisma.questionnaireResponse.findMany({
        where: { userId: testUserId, sport: 'tennis' }
      });

      expect(savedResponses).toHaveLength(1);
    });

    test('should maintain data integrity during updates', async () => {
      const initialAnswers = { experience: "1-2 years" };
      const updatedAnswers = { experience: "2-4 years", frequency: "Daily" };

      // Initial submission
      await request(app)
        .post('/api/onboarding/tennis/submit')
        .send({
          userId: testUserId,
          answers: initialAnswers
        })
        .expect(200);

      // Update submission
      const updateResponse = await request(app)
        .post('/api/onboarding/tennis/submit')
        .send({
          userId: testUserId,
          answers: updatedAnswers
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);

      // Verify updated data
      const savedResponse = await prisma.questionnaireResponse.findFirst({
        where: { userId: testUserId, sport: 'tennis' }
      });

      expect(savedResponse?.answersJson).toEqual(updatedAnswers);
    });
  });
});

describe('QuestionnaireValidator Unit Tests', () => {
  let validator: QuestionnaireValidator;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      validationFailed: jest.fn(),
    } as any;
    validator = new QuestionnaireValidator(mockLogger);
  });

  describe('Sport Validation', () => {
    test('should validate supported sports', () => {
      const result = validator.validateSport('tennis');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject unsupported sports', () => {
      const result = validator.validateSport('baseball');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toBeInstanceOf(ValidationError);
      expect(result.errors[0].field).toBe('sport');
    });

    test('should reject empty sport', () => {
      const result = validator.validateSport('');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('sport');
    });
  });

  describe('UserId Validation', () => {
    test('should validate proper userId', () => {
      const result = validator.validateUserId('valid-user-id');
      expect(result.isValid).toBe(true);
    });

    test('should reject empty userId', () => {
      const result = validator.validateUserId('');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('userId');
    });

    test('should reject overly long userId', () => {
      const longId = 'a'.repeat(101);
      const result = validator.validateUserId(longId);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Answers Validation', () => {
    test('should validate proper answers object', () => {
      const answers = { experience: "1-2 years", skill_level: 3 };
      const result = validator.validateAnswers(answers);
      expect(result.isValid).toBe(true);
    });

    test('should reject non-object answers', () => {
      const result = validator.validateAnswers("invalid" as any);
      expect(result.isValid).toBe(false);
    });

    test('should reject empty answers', () => {
      const result = validator.validateAnswers({});
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('answers');
    });

    test('should validate nested objects', () => {
      const answers = {
        skills: {
          serving: "Intermediate",
          forehand: "Advanced"
        }
      };
      const result = validator.validateAnswers(answers);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Sanitization', () => {
    test('should sanitize HTML from strings', () => {
      const maliciousAnswers = {
        comment: "<script>alert('xss')</script>Safe text"
      };
      
      const sanitized = validator.sanitizeAnswers(maliciousAnswers);
      expect(sanitized.comment).not.toContain('<script>');
      expect(sanitized.comment).toContain('Safe text');
    });

    test('should preserve valid data types', () => {
      const answers = {
        text: "Valid text",
        number: 42,
        boolean: true,
        nested: { key: "value" }
      };
      
      const sanitized = validator.sanitizeAnswers(answers);
      expect(sanitized).toEqual(answers);
    });

    test('should handle deeply nested objects', () => {
      const answers = {
        level1: {
          level2: {
            level3: "<script>bad</script>good"
          }
        }
      };
      
      const sanitized = validator.sanitizeAnswers(answers) as any;
      expect(sanitized.level1.level2.level3).not.toContain('<script>');
      expect(sanitized.level1.level2.level3).toContain('good');
    });
  });
});