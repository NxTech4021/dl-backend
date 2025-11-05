// Type definitions for questionnaire system

export type SportType = 'pickleball' | 'tennis' | 'padel';

export interface QuestionOption {
  readonly label: string;
  readonly value: boolean | number | string;
  readonly weight?: number;
}

export interface VisibilityCondition {
  readonly key: string;
  readonly op: '==' | '!=' | '>' | '<' | '>=' | '<=';
  readonly value: boolean | number | string;
}

export interface QuestionDefinition {
  readonly key: string;
  readonly question: string;
  readonly type: 'single_choice' | 'number' | 'skill_matrix';
  readonly options?: ReadonlyArray<QuestionOption>;
  readonly subQuestions?: Readonly<Record<string, {
    readonly question: string;
    readonly options: ReadonlyArray<QuestionOption>;
  }>>;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly optional?: boolean;
  readonly helptext?: string;
  readonly visible_if?: ReadonlyArray<VisibilityCondition>;
}

export interface QuestionnaireDefinition {
  readonly sport: SportType;
  readonly version: number;
  readonly questions: ReadonlyArray<QuestionDefinition>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface QuestionnaireResponse {
  readonly [key: string]: unknown;
}

export interface RatingResult {
  readonly source: 'questionnaire' | 'dupr_conversion' | 'default' | 'error_fallback';
  readonly singles: number;
  readonly doubles: number;
  readonly rd: number;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface SubmissionRequest {
  readonly userId: string;
  readonly sport: SportType;
  readonly answers: QuestionnaireResponse;
  readonly sessionId?: string;
}

export interface SubmissionResult {
  readonly responseId: number;
  readonly version: number;
  readonly qHash: string;
  readonly result: RatingResult;
  readonly sport: SportType;
  readonly success: true;
}

// Error types for proper error handling
export abstract class QuestionnaireError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
}

export class ValidationError extends QuestionnaireError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  
  constructor(
    message: string,
    public readonly field?: string,
    public readonly validationDetails?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class QuestionnaireNotFoundError extends QuestionnaireError {
  readonly code = 'QUESTIONNAIRE_NOT_FOUND';
  readonly statusCode = 404;
  
  constructor(sport: string) {
    super(`Questionnaire not found for sport: ${sport}`);
    this.name = 'QuestionnaireNotFoundError';
  }
}

export class UserNotFoundError extends QuestionnaireError {
  readonly code = 'USER_NOT_FOUND';
  readonly statusCode = 404;
  
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = 'UserNotFoundError';
  }
}

export class ScoringError extends QuestionnaireError {
  readonly code = 'SCORING_ERROR';
  readonly statusCode = 500;
  
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'ScoringError';
  }
}

export class DatabaseError extends QuestionnaireError {
  readonly code = 'DATABASE_ERROR';
  readonly statusCode = 500;
  
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

// Result type for consistent error handling
export class Result<T, E = Error> {
  private constructor(
    private readonly value: T | null,
    private readonly error: E | null,
    private readonly success: boolean
  ) {}
  
  static success<T>(value: T): Result<T, never> {
    return new Result(value, null, true) as Result<T, never>;
  }
  
  static failure<E>(error: E): Result<never, E> {
    return new Result(null, error, false) as Result<never, E>;
  }
  
  isSuccess(): this is Result<T, never> {
    return this.success;
  }
  
  isFailure(): this is Result<never, E> {
    return !this.success;
  }
  
  getValue(): T {
    if (!this.success || this.value === null) {
      throw new Error('Cannot get value from failed result');
    }
    return this.value;
  }
  
  getError(): E {
    if (this.success || this.error === null) {
      throw new Error('Cannot get error from successful result');
    }
    return this.error;
  }
  
  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.success && this.value !== null) {
      try {
        return Result.success(fn(this.value));
      } catch (error) {
        return Result.failure(error as E);
      }
    }
    return Result.failure(this.error as E);
  }
  
  mapError<F>(fn: (error: E) => F): Result<T, F> {
    if (this.success) {
      return Result.success(this.value as T);
    }
    return Result.failure(fn(this.error as E));
  }
}