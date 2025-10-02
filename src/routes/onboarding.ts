// Production-grade onboarding routes
import express from 'express';
import { PrismaClient } from '@prisma/client';
import QuestionnaireService, { loadQuestionnaire } from '../services/questionnaire';
import { scorePickleball, scoreTennis, scorePadel } from '../services/scoring';
import { 
  SportType, 
  SubmissionRequest, 
  QuestionnaireError, 
  ValidationError,
  UserNotFoundError,
  DatabaseError,
  ScoringError,
  Result 
} from '../types/questionnaire';
import ConfigurationService from '../config/questionnaire';
import Logger from '../utils/logger';
import QuestionnaireValidator from '../validators/questionnaire';

const prisma = new PrismaClient();
const router = express.Router();
const logger = Logger.getInstance(ConfigurationService.getConfig().logging.level, ConfigurationService.getConfig().logging.includeStackTrace);
const questionnaireService = new QuestionnaireService(logger);
const validator = new QuestionnaireValidator(logger);

// Middleware for request logging and correlation ID
router.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;
  
  logger.info(`${req.method} ${req.originalUrl}`, {
    requestId,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    operation: 'route_access'
  });
  
  next();
});

// Error handler middleware
function handleQuestionnaireError(error: unknown, res: express.Response): void {
  if (error instanceof QuestionnaireError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      success: false
    });
  } else if (error instanceof Error) {
    logger.error('Unexpected error in questionnaire route', {}, error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      success: false
    });
  } else {
    logger.error('Unknown error in questionnaire route', { error });
    res.status(500).json({
      error: 'Internal server error',
      code: 'UNKNOWN_ERROR',
      success: false
    });
  }
}

// Input validation middleware
function validateSportParam(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const sport = req.params.sport;
  const validation = validator.validateSport(sport);
  
  if (!validation.isValid) {
    const error = validation.errors[0];
    return handleQuestionnaireError(error, res);
  }
  
  req.sport = sport as SportType;
  next();
}

// Add types to express Request
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      sport?: SportType;
    }
  }
}

// Serve questions directly from files with proper error handling
router.get('/:sport/questions', validateSportParam, async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId!;
  const sport = req.sport!;
  
  try {
    logger.questionnaireRequested(sport, requestId);
    
    const result = await questionnaireService.loadQuestionnaire(sport);
    
    if (result.isFailure()) {
      return handleQuestionnaireError(result.getError(), res);
    }
    
    const { definition, hash } = result.getValue();
    
    // Set caching headers for better performance
    res.set({
      'ETag': hash,
      'Cache-Control': 'public, max-age=300', // 5 minutes cache
      'X-Request-ID': requestId
    });
    
    const duration = Date.now() - startTime;
    logger.info('Questionnaire served successfully', {
      sport,
      requestId,
      duration,
      questionCount: definition.questions.length,
      operation: 'get_questionnaire'
    });
    
    res.json(definition);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Unexpected error serving questionnaire', {
      sport,
      requestId,
      duration,
      operation: 'get_questionnaire'
    }, error as Error);
    
    handleQuestionnaireError(error, res);
  }
});

// Submit answers and save + score with proper error handling
router.post('/:sport/submit', validateSportParam, async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId!;
  const sport = req.sport!;
  
  try {
    // Validate request body structure
    const submissionRequest: SubmissionRequest = {
      userId: req.body.userId,
      sport,
      answers: req.body.answers,
      sessionId: req.body.sessionId
    };
    
    const validation = validator.validateSubmissionRequest(submissionRequest);
    if (!validation.isValid) {
      const error = validation.errors[0];
      logger.warn('Submission validation failed', {
        sport,
        userId: submissionRequest.userId,
        requestId,
        errors: validation.errors.map(e => ({ field: e.field, message: e.message }))
      });
      return handleQuestionnaireError(error, res);
    }
    
    // Sanitize answers to prevent injection
    const sanitizedAnswers = validator.sanitizeAnswers(submissionRequest.answers);
    
    logger.info('Processing questionnaire submission', {
      sport,
      userId: submissionRequest.userId,
      requestId,
      answerCount: Object.keys(sanitizedAnswers).length,
      operation: 'submit_questionnaire'
    });
    
    // Verify user exists with timeout
    const userCheckStart = Date.now();
    let user;
    try {
      user = await Promise.race([
        prisma.user.findUnique({ where: { id: submissionRequest.userId } }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('User lookup timeout')), 5000))
      ]);
    } catch (error) {
      logger.error('Database timeout during user lookup', {
        userId: submissionRequest.userId,
        requestId,
        duration: Date.now() - userCheckStart
      }, error as Error);
      return handleQuestionnaireError(new DatabaseError('User lookup failed'), res);
    }
    
    if (!user) {
      const error = new UserNotFoundError(submissionRequest.userId);
      logger.warn('User not found for questionnaire submission', {
        userId: submissionRequest.userId,
        sport,
        requestId
      });
      return handleQuestionnaireError(error, res);
    }
    
    logger.databaseOperation('user_lookup', 'user', Date.now() - userCheckStart);
    
    // Load questionnaire definition
    const questionnaireResult = await questionnaireService.loadQuestionnaire(sport);
    if (questionnaireResult.isFailure()) {
      return handleQuestionnaireError(questionnaireResult.getError(), res);
    }
    
    const { version, hash } = questionnaireResult.getValue();
    
    // Score with timeout and error handling
    const scoringStart = Date.now();
    let scoringResult;
    try {
      const scoringPromise = new Promise((resolve, reject) => {
        try {
          let result;
          if (sport === 'pickleball') {
            result = scorePickleball(sanitizedAnswers);
          } else if (sport === 'tennis') {
            result = scoreTennis(sanitizedAnswers);
          } else {
            result = scorePadel(sanitizedAnswers);
          }
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Scoring timeout')), ConfigurationService.getConfig().scoring.timeoutMs)
      );
      
      scoringResult = await Promise.race([scoringPromise, timeoutPromise]);
      
    } catch (error) {
      const scoringDuration = Date.now() - scoringStart;
      logger.error('Scoring failed', {
        sport,
        userId: submissionRequest.userId,
        requestId,
        duration: scoringDuration
      }, error as Error);
      return handleQuestionnaireError(new ScoringError('Failed to calculate rating'), res);
    }
    
    const scoringDuration = Date.now() - scoringStart;
    logger.scoringCompleted(sport, (scoringResult as any).singles || 0, (scoringResult as any).confidence || 'unknown', scoringDuration);
    
    // Database operations with proper error handling
    const dbStart = Date.now();
    let response;
    try {
      // Check for existing response
      const existingResponse = await prisma.questionnaireResponse.findFirst({
        where: {
          userId: submissionRequest.userId,
          sport
        },
        include: { result: true }
      });
      
      if (existingResponse) {
        // Update existing response
        response = await prisma.questionnaireResponse.update({
          where: { id: existingResponse.id },
          data: {
            qVersion: version,
            qHash: hash,
            answersJson: sanitizedAnswers,
            completedAt: new Date(),
            result: {
              upsert: {
                create: scoringResult,
                update: scoringResult
              }
            }
          },
          include: { result: true }
        });
        
        logger.info('Updated existing questionnaire response', {
          responseId: response.id,
          userId: submissionRequest.userId,
          sport,
          requestId
        });
      } else {
        // Create new response
        response = await prisma.questionnaireResponse.create({
          data: {
            userId: submissionRequest.userId,
            sport,
            qVersion: version,
            qHash: hash,
            answersJson: sanitizedAnswers,
            completedAt: new Date(),
            result: { create: scoringResult }
          },
          include: { result: true }
        });
        
        logger.info('Created new questionnaire response', {
          responseId: response.id,
          userId: submissionRequest.userId,
          sport,
          requestId
        });
      }
      
    } catch (error) {
      const dbDuration = Date.now() - dbStart;
      logger.error('Database error during response save', {
        userId: submissionRequest.userId,
        sport,
        requestId,
        duration: dbDuration
      }, error as Error);
      return handleQuestionnaireError(new DatabaseError('Failed to save response'), res);
    }
    
    const dbDuration = Date.now() - dbStart;
    logger.databaseOperation('upsert_response', 'questionnaire_response', dbDuration);
    
    logger.responseSubmitted(submissionRequest.userId, sport, response.id);
    
    // Check if user should be marked as completed onboarding
    await checkAndUpdateOnboardingCompletion(submissionRequest.userId, requestId);
    
    const totalDuration = Date.now() - startTime;
    logger.info('Questionnaire submission completed successfully', {
      responseId: response.id,
      userId: submissionRequest.userId,
      sport,
      requestId,
      totalDuration,
      operation: 'submit_questionnaire'
    });
    
    res.set('X-Request-ID', requestId);
    res.json({
      responseId: response.id,
      version,
      qHash: hash,
      result: response.result,
      sport,
      success: true
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Unexpected error in questionnaire submission', {
      sport,
      requestId,
      duration,
      operation: 'submit_questionnaire'
    }, error as Error);
    
    handleQuestionnaireError(error, res);
  }
});

// Get user's questionnaire responses with validation
router.get('/responses/:userId', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId!;
  const { userId } = req.params;
  
  try {
    // Validate userId
    const validation = validator.validateUserId(userId);
    if (!validation.isValid) {
      return handleQuestionnaireError(validation.errors[0], res);
    }
    
    logger.info('Fetching user responses', {
      userId,
      requestId,
      operation: 'get_user_responses'
    });
    
    const dbStart = Date.now();
    const responses = await Promise.race([
      prisma.questionnaireResponse.findMany({
        where: { userId },
        include: { result: true },
        orderBy: { completedAt: 'desc' }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 10000))
    ]);
    
    const dbDuration = Date.now() - dbStart;
    logger.databaseOperation('fetch_responses', 'questionnaire_response', dbDuration);
    
    const totalDuration = Date.now() - startTime;
    logger.info('User responses fetched successfully', {
      userId,
      requestId,
      responseCount: (responses as any[]).length,
      duration: totalDuration,
      operation: 'get_user_responses'
    });
    
    res.set('X-Request-ID', requestId);
    res.json({ responses, success: true });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error fetching user responses', {
      userId,
      requestId,
      duration,
      operation: 'get_user_responses'
    }, error as Error);
    
    handleQuestionnaireError(error, res);
  }
});

// Get specific sport response for user with validation
router.get('/responses/:userId/:sport', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId!;
  const { userId } = req.params;
  const sport = req.params.sport as SportType;
  
  try {
    // Validate userId
    const userValidation = validator.validateUserId(userId);
    if (!userValidation.isValid) {
      return handleQuestionnaireError(userValidation.errors[0], res);
    }
    
    // Validate sport
    const sportValidation = validator.validateSport(sport);
    if (!sportValidation.isValid) {
      return handleQuestionnaireError(sportValidation.errors[0], res);
    }
    
    logger.info('Fetching sport response', {
      userId,
      sport,
      requestId,
      operation: 'get_sport_response'
    });
    
    const dbStart = Date.now();
    const response = await Promise.race([
      prisma.questionnaireResponse.findFirst({
        where: {
          userId,
          sport
        },
        include: { result: true },
        orderBy: { completedAt: 'desc' }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 10000))
    ]);
    
    const dbDuration = Date.now() - dbStart;
    logger.databaseOperation('fetch_sport_response', 'questionnaire_response', dbDuration);
    
    if (!response) {
      logger.info('No response found for sport', {
        userId,
        sport,
        requestId
      });
      return res.status(404).json({ 
        error: 'No response found for this sport',
        code: 'RESPONSE_NOT_FOUND',
        success: false 
      });
    }
    
    const totalDuration = Date.now() - startTime;
    logger.info('Sport response fetched successfully', {
      userId,
      sport,
      requestId,
      responseId: response.id,
      duration: totalDuration,
      operation: 'get_sport_response'
    });
    
    res.set('X-Request-ID', requestId);
    res.json({ response, success: true });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error fetching sport response', {
      userId,
      sport,
      requestId,
      duration,
      operation: 'get_sport_response'
    }, error as Error);
    
    handleQuestionnaireError(error, res);
  }
});

// Update user profile information (name, gender, dateOfBirth)
router.put('/profile/:userId', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId!;
  const { userId } = req.params;
  const { name, gender, dateOfBirth } = req.body;
  
  try {
    // Validate userId
    const userValidation = validator.validateUserId(userId);
    if (!userValidation.isValid) {
      return handleQuestionnaireError(userValidation.errors[0], res);
    }
    
    // Validate input data
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: 'Name must be at least 2 characters long',
        code: 'INVALID_NAME',
        success: false
      });
    }
    
    if (!gender || (gender !== 'male' && gender !== 'female')) {
      return res.status(400).json({
        error: 'Gender must be either "male" or "female"',
        code: 'INVALID_GENDER',
        success: false
      });
    }
    
    let parsedDate = null;
    if (dateOfBirth) {
      parsedDate = new Date(dateOfBirth);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid date format for dateOfBirth',
          code: 'INVALID_DATE',
          success: false
        });
      }
      
      // Check if user is at least 13 years old
      const today = new Date();
      const age = today.getFullYear() - parsedDate.getFullYear();
      const monthDiff = today.getMonth() - parsedDate.getMonth();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsedDate.getDate()) 
        ? age - 1 
        : age;
      
      if (actualAge < 13) {
        return res.status(400).json({
          error: 'User must be at least 13 years old',
          code: 'USER_TOO_YOUNG',
          success: false
        });
      }
    }
    
    logger.info('Updating user profile', {
      userId,
      requestId,
      operation: 'update_profile'
    });
    
    const dbStart = Date.now();
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      const error = new UserNotFoundError(userId);
      logger.warn('User not found for profile update', {
        userId,
        requestId
      });
      return handleQuestionnaireError(error, res);
    }
    
    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name.trim(),
        gender,
        dateOfBirth: parsedDate
      }
    });
    
    const dbDuration = Date.now() - dbStart;
    logger.databaseOperation('update_profile', 'user', dbDuration);
    
    const totalDuration = Date.now() - startTime;
    logger.info('User profile updated successfully', {
      userId,
      requestId,
      duration: totalDuration,
      operation: 'update_profile'
    });
    
    res.set('X-Request-ID', requestId);
    res.json({
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        gender: updatedUser.gender,
        dateOfBirth: updatedUser.dateOfBirth
      },
      success: true
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error updating user profile', {
      userId,
      requestId,
      duration,
      operation: 'update_profile'
    }, error as Error);
    
    handleQuestionnaireError(error, res);
  }
});

// Mark onboarding as completed for a user
router.post('/complete/:userId', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId!;
  const { userId } = req.params;
  
  try {
    // Validate userId
    const validation = validator.validateUserId(userId);
    if (!validation.isValid) {
      return handleQuestionnaireError(validation.errors[0], res);
    }
    
    logger.info('Marking onboarding as completed', {
      userId,
      requestId,
      operation: 'complete_onboarding'
    });
    
    const dbStart = Date.now();
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      const error = new UserNotFoundError(userId);
      logger.warn('User not found for onboarding completion', {
        userId,
        requestId
      });
      return handleQuestionnaireError(error, res);
    }
    
    // Update user's onboarding completion status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        completedOnboarding: true
      }
    });
    
    const dbDuration = Date.now() - dbStart;
    logger.databaseOperation('complete_onboarding', 'user', dbDuration);
    
    const totalDuration = Date.now() - startTime;
    logger.info('Onboarding marked as completed successfully', {
      userId,
      requestId,
      duration: totalDuration,
      operation: 'complete_onboarding'
    });
    
    res.set('X-Request-ID', requestId);
    res.json({
      userId: updatedUser.id,
      completedOnboarding: updatedUser.completedOnboarding,
      success: true,
      message: 'Onboarding completed successfully'
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error completing onboarding', {
      userId,
      requestId,
      duration,
      operation: 'complete_onboarding'
    }, error as Error);
    
    handleQuestionnaireError(error, res);
  }
});

// Check if user has completed any sport assessments
router.get('/assessment-status/:userId', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId!;
  const { userId } = req.params;
  
  try {
    // Validate userId
    const validation = validator.validateUserId(userId);
    if (!validation.isValid) {
      return handleQuestionnaireError(validation.errors[0], res);
    }
    
    logger.info('Checking assessment status', {
      userId,
      requestId,
      operation: 'get_assessment_status'
    });
    
    const dbStart = Date.now();
    
    // Check if user has completed any sport assessments
    const assessmentCount = await prisma.questionnaireResponse.count({
      where: {
        userId,
        completedAt: { not: null }
      }
    });
    
    // Check if user has any sports selected (even if questionnaires not completed)
    const sportsCount = await prisma.questionnaireResponse.count({
      where: {
        userId
      }
    });
    
    // Also check if user has completed onboarding (which means they've made a decision about assessment)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { completedOnboarding: true }
    });
    
    const dbDuration = Date.now() - dbStart;
    logger.databaseOperation('fetch_assessment_status', 'questionnaire_response', dbDuration);
    
    // Assessment is considered complete if:
    // 1. User has completed at least one questionnaire, OR
    // 2. User has completed onboarding (meaning they've made a decision about assessment, even if they chose to skip), OR
    // 3. User has selected sports (even if they skipped questionnaires)
    const hasCompletedAssessment = assessmentCount > 0 || user?.completedOnboarding === true || sportsCount > 0;
    
    const totalDuration = Date.now() - startTime;
    logger.info('Assessment status fetched successfully', {
      userId,
      requestId,
      hasCompletedAssessment,
      assessmentCount,
      sportsCount,
      completedOnboarding: user?.completedOnboarding,
      duration: totalDuration,
      operation: 'get_assessment_status'
    });
    
    res.set('X-Request-ID', requestId);
    res.json({ 
      userId,
      hasCompletedAssessment,
      assessmentCount,
      success: true 
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error checking assessment status', {
      userId,
      requestId,
      duration,
      operation: 'get_assessment_status'
    }, error as Error);
    
    handleQuestionnaireError(error, res);
  }
});

// Check if user has completed onboarding
router.get('/status/:userId', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId!;
  const { userId } = req.params;
  
  try {
    // Validate userId
    const validation = validator.validateUserId(userId);
    if (!validation.isValid) {
      return handleQuestionnaireError(validation.errors[0], res);
    }
    
    logger.info('Checking onboarding status', {
      userId,
      requestId,
      operation: 'get_onboarding_status'
    });
    
    const dbStart = Date.now();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        completedOnboarding: true
      }
    });
    
    const dbDuration = Date.now() - dbStart;
    logger.databaseOperation('fetch_onboarding_status', 'user', dbDuration);
    
    if (!user) {
      const error = new UserNotFoundError(userId);
      logger.warn('User not found for onboarding status check', {
        userId,
        requestId
      });
      return handleQuestionnaireError(error, res);
    }
    
    const totalDuration = Date.now() - startTime;
    logger.info('Onboarding status fetched successfully', {
      userId,
      requestId,
      completedOnboarding: user.completedOnboarding,
      duration: totalDuration,
      operation: 'get_onboarding_status'
    });
    
    res.set('X-Request-ID', requestId);
    res.json({ 
      userId: user.id,
      completedOnboarding: user.completedOnboarding,
      success: true 
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error checking onboarding status', {
      userId,
      requestId,
      duration,
      operation: 'get_onboarding_status'
    }, error as Error);
    
    handleQuestionnaireError(error, res);
  }
});

// Save user sports selection
router.post('/sports/:userId', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId!;
  const { userId } = req.params;
  const { sports } = req.body;
  
  try {
    // Validate userId
    const validation = validator.validateUserId(userId);
    if (!validation.isValid) {
      return handleQuestionnaireError(validation.errors[0], res);
    }
    
    // Validate sports data - should be an array of strings
    if (!Array.isArray(sports) || sports.length === 0) {
      return res.status(400).json({
        error: 'Sports array is required and must not be empty',
        code: 'MISSING_SPORTS_DATA',
        success: false
      });
    }

    // Validate each sport is a valid sport type
    const validSports = ['pickleball', 'tennis', 'padel'];
    const invalidSports = sports.filter(sport => !validSports.includes(sport));
    if (invalidSports.length > 0) {
      return res.status(400).json({
        error: `Invalid sports: ${invalidSports.join(', ')}. Valid sports are: ${validSports.join(', ')}`,
        code: 'INVALID_SPORTS_DATA',
        success: false
      });
    }
    
    logger.info('Saving user sport preferences', {
      userId,
      requestId,
      sports,
      operation: 'save_sports'
    });
    
    const dbStart = Date.now();
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      const error = new UserNotFoundError(userId);
      logger.warn('User not found for sports save', {
        userId,
        requestId
      });
      return handleQuestionnaireError(error, res);
    }
    
    // Create questionnaire responses for each sport with empty answers
    // This allows the sports to be tracked even if user skips questionnaires
    const sportsToSave = [];
    
    for (const sport of sports) {
      // Check if response already exists for this sport
      const existingResponse = await prisma.questionnaireResponse.findFirst({
        where: {
          userId,
          sport
        }
      });
      
      if (!existingResponse) {
        // Create a placeholder response with empty answers
        const response = await prisma.questionnaireResponse.create({
          data: {
            userId,
            sport,
            qVersion: 1, // Default version
            qHash: 'placeholder', // Placeholder hash
            answersJson: {}, // Empty answers
            startedAt: new Date(),
            completedAt: null // Not completed since they skipped
          }
        });
        sportsToSave.push(response);
      }
    }
    
    const dbDuration = Date.now() - dbStart;
    logger.databaseOperation('save_sports', 'questionnaire_response', dbDuration);
    
    const totalDuration = Date.now() - startTime;
    logger.info('User sport preferences saved successfully', {
      userId,
      requestId,
      sports,
      savedCount: sportsToSave.length,
      duration: totalDuration,
      operation: 'save_sports'
    });
    
    res.set('X-Request-ID', requestId);
    res.json({ 
      userId,
      sports,
      savedCount: sportsToSave.length,
      success: true,
      message: 'Sport preferences saved successfully'
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error saving sport preferences', {
      userId,
      requestId,
      duration,
      operation: 'save_sports'
    }, error as Error);
    
    handleQuestionnaireError(error, res);
  }
});

// Save user location information
router.post('/location/:userId', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId!;
  const { userId } = req.params;
  const { country, state, city, latitude, longitude } = req.body;
  
  try {
    // Validate userId
    const validation = validator.validateUserId(userId);
    if (!validation.isValid) {
      return handleQuestionnaireError(validation.errors[0], res);
    }
    
    // Validate location data - at least city is required
    if (!city || city.trim() === '') {
      return res.status(400).json({
        error: 'City is required',
        code: 'MISSING_CITY_DATA',
        success: false
      });
    }

    // Clean the data
    const cleanCity = city.trim();
    const cleanState = state && state.trim() !== '' ? state.trim() : null;
    
    logger.info('Saving user location', {
      userId,
      requestId,
      city: cleanCity,
      state: cleanState,
      operation: 'save_location'
    });
    
    const dbStart = Date.now();
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      const error = new UserNotFoundError(userId);
      logger.warn('User not found for location save', {
        userId,
        requestId
      });
      return handleQuestionnaireError(error, res);
    }
    
    // Create location string - only include city and state if available
    const locationString = cleanState ? `${cleanCity}, ${cleanState}` : cleanCity;
    
    // Update user's area field
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        area: locationString
      }
    });
    
    const dbDuration = Date.now() - dbStart;
    logger.databaseOperation('save_location', 'user', dbDuration);
    
    const totalDuration = Date.now() - startTime;
    logger.info('User location saved successfully', {
      userId,
      requestId,
      duration: totalDuration,
      location: locationString,
      operation: 'save_location'
    });
    
    res.set('X-Request-ID', requestId);
    res.json({
      success: true,
      location: {
        area: updatedUser.area,
        city: cleanCity,
        ...(cleanState && { state: cleanState }),
        ...(latitude && longitude && { latitude, longitude })
      },
      message: 'Location saved successfully'
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error saving user location', {
      userId,
      requestId,
      duration,
      operation: 'save_location'
    }, error as Error);
    
    handleQuestionnaireError(error, res);
  }
});

// Search locations using Nominatim (OpenStreetMap)
router.get('/locations/search', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId!;
  const { q: query, limit = 5 } = req.query;

  try {
    // Validate query parameter
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Query parameter "q" is required and must be at least 2 characters',
        code: 'INVALID_QUERY',
        success: false
      });
    }

    const searchLimit = Math.min(parseInt(limit as string) || 5, 10);

    logger.info('Searching locations', {
      query,
      limit: searchLimit,
      requestId,
      operation: 'search_locations'
    });

    // Call Nominatim API
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(query.trim())}&` +
      `format=json&` +
      `addressdetails=1&` +
      `limit=${searchLimit}&` +
      `countrycodes=my`; // Restrict to Malaysia

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'DeuceLeague/1.0', // Required by Nominatim
        'Accept-Language': 'en'
      }
    });

    if (!response.ok) {
      logger.error('Nominatim API error', {
        status: response.status,
        requestId,
        operation: 'search_locations'
      });
      return res.status(500).json({
        error: 'Location search service unavailable',
        code: 'SERVICE_ERROR',
        success: false
      });
    }

    const data = await response.json();

    // Transform Nominatim response to our format
    const results = data.map((place: any) => {
      const address = place.address || {};
      const city = address.city || address.town || address.village || address.suburb || '';
      const postcode = address.postcode || '';
      const state = address.state || '';

      // Format: "City, Postcode State"
      let formattedAddress = '';
      if (city && postcode && state) {
        formattedAddress = `${city}, ${postcode} ${state}`;
      } else if (city && state) {
        formattedAddress = `${city}, ${state}`;
      } else {
        formattedAddress = place.display_name;
      }

      return {
        id: place.place_id.toString(),
        formatted_address: formattedAddress,
        geometry: {
          location: {
            lat: parseFloat(place.lat),
            lng: parseFloat(place.lon)
          }
        },
        components: {
          city,
          postcode,
          state
        },
        display_name: place.display_name
      };
    });

    const totalDuration = Date.now() - startTime;
    logger.info('Location search completed', {
      query,
      resultCount: results.length,
      duration: totalDuration,
      requestId,
      operation: 'search_locations'
    });

    res.set('X-Request-ID', requestId);
    res.json({
      success: true,
      results,
      count: results.length
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error searching locations', {
      query,
      requestId,
      duration,
      operation: 'search_locations'
    }, error as Error);

    res.status(500).json({
      error: 'Failed to search locations',
      code: 'SEARCH_ERROR',
      success: false
    });
  }
});

// Get user profile information
router.get('/profile/:userId', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.requestId!;
  const { userId } = req.params;
  
  try {
    // Validate userId
    const validation = validator.validateUserId(userId);
    if (!validation.isValid) {
      return handleQuestionnaireError(validation.errors[0], res);
    }
    
    logger.info('Fetching user profile', {
      userId,
      requestId,
      operation: 'get_profile'
    });
    
    const dbStart = Date.now();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        gender: true,
        dateOfBirth: true,
        createdAt: true
      }
    });
    
    const dbDuration = Date.now() - dbStart;
    logger.databaseOperation('fetch_profile', 'user', dbDuration);
    
    if (!user) {
      const error = new UserNotFoundError(userId);
      logger.warn('User not found for profile fetch', {
        userId,
        requestId
      });
      return handleQuestionnaireError(error, res);
    }
    
    const totalDuration = Date.now() - startTime;
    logger.info('User profile fetched successfully', {
      userId,
      requestId,
      duration: totalDuration,
      operation: 'get_profile'
    });
    
    res.set('X-Request-ID', requestId);
    res.json({ user, success: true });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error fetching user profile', {
      userId,
      requestId,
      duration,
      operation: 'get_profile'
    }, error as Error);
    
    handleQuestionnaireError(error, res);
  }
});

// Helper function to check if user should be marked as completed onboarding
async function checkAndUpdateOnboardingCompletion(userId: string, requestId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        completedOnboarding: true,
        name: true,
        gender: true,
        dateOfBirth: true,
        area: true
      }
    });

    if (!user || user.completedOnboarding) {
      return; // User not found or already completed
    }

    // Check if user has completed at least one questionnaire
    const questionnaireResponseCount = await prisma.questionnaireResponse.count({
      where: {
        userId,
        completedAt: { not: null }
      }
    });

    // Check if user has basic profile information
    const hasBasicProfile = user.name && user.gender && user.dateOfBirth;
    
    // Check if user has location information
    const hasLocation = user.area;

    // Mark as completed if user has basic profile + location (questionnaire is optional)
    if (hasBasicProfile && hasLocation) {
      await prisma.user.update({
        where: { id: userId },
        data: { completedOnboarding: true }
      });

      logger.info('User onboarding automatically marked as completed', {
        userId,
        requestId,
        questionnaireCount: questionnaireResponseCount,
        hasBasicProfile: !!hasBasicProfile,
        operation: 'auto_complete_onboarding'
      });
    }
  } catch (error) {
    logger.error('Error checking onboarding completion', {
      userId,
      requestId,
      operation: 'auto_complete_onboarding'
    }, error as Error);
    // Don't throw error as this is supplementary functionality
  }
}

export default router;
