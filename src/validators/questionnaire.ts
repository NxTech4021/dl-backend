// Validation for questionnaire system

import { 
  SportType, 
  QuestionnaireResponse, 
  SubmissionRequest, 
  ValidationError 
} from '../types/questionnaire';
import ConfigurationService from '../config/questionnaire';
import Logger from '../utils/logger';

interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: ReadonlyArray<ValidationError>;
}

class QuestionnaireValidator {
  private readonly logger: Logger;
  private readonly config = ConfigurationService.getConfig();
  
  constructor(logger: Logger) {
    this.logger = logger;
  }
  
  validateSport(sport: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!sport) {
      errors.push(new ValidationError('Sport is required', 'sport'));
    } else if (!ConfigurationService.isSupportedSport(sport)) {
      errors.push(new ValidationError(
        `Unsupported sport: ${sport}. Supported sports: ${this.config.supportedSports.join(', ')}`,
        'sport'
      ));
    }
    
    if (errors.length > 0) {
      this.logger.validationFailed('sport', sport, 'Invalid sport');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  validateUserId(userId: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!userId) {
      errors.push(new ValidationError('User ID is required', 'userId'));
    } else if (typeof userId !== 'string' || userId.trim().length === 0) {
      errors.push(new ValidationError('User ID must be a non-empty string', 'userId'));
    } else if (userId.length > 100) {
      errors.push(new ValidationError('User ID is too long (max 100 characters)', 'userId'));
    }
    
    if (errors.length > 0) {
      this.logger.validationFailed('userId', userId, 'Invalid user ID');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  validateAnswers(answers: QuestionnaireResponse): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!answers || typeof answers !== 'object') {
      errors.push(new ValidationError('Answers must be an object', 'answers'));
      return { isValid: false, errors };
    }
    
    const answerKeys = Object.keys(answers);
    if (answerKeys.length === 0) {
      errors.push(new ValidationError('At least one answer is required', 'answers'));
    }
    
    if (answerKeys.length > this.config.validation.maxAnswersLength) {
      errors.push(new ValidationError(
        `Too many answers (max ${this.config.validation.maxAnswersLength})`,
        'answers'
      ));
    }
    
    // Validate individual answer values
    for (const [key, value] of Object.entries(answers)) {
      if (key.length > 50) {
        errors.push(new ValidationError(
          `Answer key too long: ${key}`,
          `answers.${key}`
        ));
      }
      
      // Validate answer value types and content
      if (!this.isValidAnswerValue(value)) {
        errors.push(new ValidationError(
          `Invalid answer value for key: ${key}`,
          `answers.${key}`
        ));
      }
    }
    
    if (errors.length > 0) {
      this.logger.validationFailed('answers', `${answerKeys.length} answers`, 'Invalid answers format');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  validateSubmissionRequest(request: SubmissionRequest): ValidationResult {
    const allErrors: ValidationError[] = [];
    
    // Validate sport
    const sportValidation = this.validateSport(request.sport);
    allErrors.push(...sportValidation.errors);
    
    // Validate userId
    const userIdValidation = this.validateUserId(request.userId);
    allErrors.push(...userIdValidation.errors);
    
    // Validate answers
    const answersValidation = this.validateAnswers(request.answers);
    allErrors.push(...answersValidation.errors);
    
    // Validate optional sessionId
    if (request.sessionId) {
      if (typeof request.sessionId !== 'string' || request.sessionId.length > 100) {
        allErrors.push(new ValidationError(
          'Session ID must be a string (max 100 characters)',
          'sessionId'
        ));
      }
    }
    
    const isValid = allErrors.length === 0;
    
    if (!isValid) {
      this.logger.warn('Submission request validation failed', {
        userId: request.userId,
        sport: request.sport,
        errorCount: allErrors.length
      });
    }
    
    return {
      isValid,
      errors: allErrors
    };
  }
  
  private isValidAnswerValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true; // Allow null/undefined for optional questions
    }
    
    // Allow basic types
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return typeof value === 'string' ? value.length <= 1000 : true;
    }
    
    // Allow objects for skill matrix responses
    if (typeof value === 'object' && value !== null) {
      // Validate object depth and content
      return this.isValidObjectValue(value as Record<string, unknown>, 0, 3);
    }
    
    return false;
  }
  
  private isValidObjectValue(obj: Record<string, unknown>, depth: number, maxDepth: number): boolean {
    if (depth > maxDepth) {
      return false;
    }
    
    const keys = Object.keys(obj);
    if (keys.length > 20) { // Max 20 properties per object
      return false;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      if (key.length > 50) {
        return false;
      }
      
      if (typeof value === 'object' && value !== null) {
        if (!this.isValidObjectValue(value as Record<string, unknown>, depth + 1, maxDepth)) {
          return false;
        }
      } else if (!this.isValidAnswerValue(value)) {
        return false;
      }
    }
    
    return true;
  }
  
  // Sanitize input to prevent injection attacks
  sanitizeAnswers(answers: QuestionnaireResponse): QuestionnaireResponse {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(answers)) {
      const sanitizedKey = this.sanitizeString(key);
      const sanitizedValue = this.sanitizeValue(value);
      
      if (sanitizedKey && sanitizedValue !== undefined) {
        sanitized[sanitizedKey] = sanitizedValue;
      }
    }
    
    return sanitized;
  }
  
  private sanitizeString(str: string): string {
    if (typeof str !== 'string') return '';
    
    return str
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .slice(0, 1000); // Limit length
  }
  
  private sanitizeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }
    
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    
    if (typeof value === 'object' && value !== null) {
      const sanitized: Record<string, unknown> = {};
      const obj = value as Record<string, unknown>;
      
      for (const [key, val] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        if (sanitizedKey) {
          sanitized[sanitizedKey] = this.sanitizeValue(val);
        }
      }
      
      return sanitized;
    }
    
    return undefined;
  }
}

export default QuestionnaireValidator;