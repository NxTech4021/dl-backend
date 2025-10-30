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
export declare abstract class QuestionnaireError extends Error {
    abstract readonly code: string;
    abstract readonly statusCode: number;
}
export declare class ValidationError extends QuestionnaireError {
    readonly field?: string | undefined;
    readonly validationDetails?: Record<string, unknown> | undefined;
    readonly code = "VALIDATION_ERROR";
    readonly statusCode = 400;
    constructor(message: string, field?: string | undefined, validationDetails?: Record<string, unknown> | undefined);
}
export declare class QuestionnaireNotFoundError extends QuestionnaireError {
    readonly code = "QUESTIONNAIRE_NOT_FOUND";
    readonly statusCode = 404;
    constructor(sport: string);
}
export declare class UserNotFoundError extends QuestionnaireError {
    readonly code = "USER_NOT_FOUND";
    readonly statusCode = 404;
    constructor(userId: string);
}
export declare class ScoringError extends QuestionnaireError {
    readonly cause?: Error | undefined;
    readonly code = "SCORING_ERROR";
    readonly statusCode = 500;
    constructor(message: string, cause?: Error | undefined);
}
export declare class DatabaseError extends QuestionnaireError {
    readonly cause?: Error | undefined;
    readonly code = "DATABASE_ERROR";
    readonly statusCode = 500;
    constructor(message: string, cause?: Error | undefined);
}
export declare class Result<T, E = Error> {
    private readonly value;
    private readonly error;
    private readonly success;
    private constructor();
    static success<T>(value: T): Result<T, never>;
    static failure<E>(error: E): Result<never, E>;
    isSuccess(): this is Result<T, never>;
    isFailure(): this is Result<never, E>;
    getValue(): T;
    getError(): E;
    map<U>(fn: (value: T) => U): Result<U, E>;
    mapError<F>(fn: (error: E) => F): Result<T, F>;
}
//# sourceMappingURL=questionnaire.d.ts.map