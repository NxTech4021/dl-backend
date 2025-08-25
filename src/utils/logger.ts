// Logging utility for questionnaire system

interface LogContext {
  readonly userId?: string;
  readonly sport?: string;
  readonly sessionId?: string;
  readonly requestId?: string;
  readonly [key: string]: unknown;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private static instance: Logger;
  private readonly logLevel: LogLevel;
  private readonly includeStackTrace: boolean;
  
  private constructor(level: LogLevel = 'info', includeStackTrace: boolean = false) {
    this.logLevel = level;
    this.includeStackTrace = includeStackTrace;
  }
  
  static getInstance(level?: LogLevel, includeStackTrace?: boolean): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(level, includeStackTrace);
    }
    return Logger.instance;
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.logLevel];
  }
  
  private formatMessage(level: LogLevel, message: string, context?: LogContext, error?: Error): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? JSON.stringify(context) : '';
    const errorStr = error && this.includeStackTrace ? `\n${error.stack}` : error ? error.message : '';
    
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${contextStr}${errorStr}`;
  }
  
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }
  
  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, context));
    }
  }
  
  warn(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context, error));
    }
  }
  
  error(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context, error));
    }
  }
  
  // Specialized logging methods for questionnaire operations
  questionnaireRequested(sport: string, requestId: string): void {
    this.info('Questionnaire requested', { sport, requestId, operation: 'get_questionnaire' });
  }
  
  questionnaireLoaded(sport: string, version: number, questionCount: number): void {
    this.info('Questionnaire loaded successfully', { 
      sport, 
      version, 
      questionCount, 
      operation: 'load_questionnaire' 
    });
  }
  
  responseSubmitted(userId: string, sport: string, responseId: number): void {
    this.info('Response submitted successfully', { 
      userId, 
      sport, 
      responseId, 
      operation: 'submit_response' 
    });
  }
  
  scoringCompleted(sport: string, rating: number, confidence: string, duration: number): void {
    this.info('Scoring completed', { 
      sport, 
      rating, 
      confidence, 
      duration, 
      operation: 'scoring' 
    });
  }
  
  validationFailed(field: string, value: unknown, reason: string): void {
    this.warn('Validation failed', { 
      field, 
      value, 
      reason, 
      operation: 'validation' 
    });
  }
  
  databaseOperation(operation: string, table: string, duration: number): void {
    this.debug('Database operation completed', { 
      operation, 
      table, 
      duration, 
      operation_type: 'database' 
    });
  }
}

export default Logger;