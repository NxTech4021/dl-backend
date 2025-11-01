import winston from 'winston';
import fs from 'fs';
import path from 'path';

// ============================================================================
// Winston Configuration
// ============================================================================

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }: any) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0 && meta.timestamp === undefined) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  })
);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Winston instance for file and console logging
export const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Console transport (development)
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    }),
    
    // Error log file (errors only)
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Combined log file (all levels)
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
    
    // Separate file for specific operations
    new winston.transports.File({
      filename: path.join(logsDir, 'database.log'),
      level: 'debug',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format((info) => {
          return info.operation_type === 'database' ? info : false;
        })(),
        logFormat
      ),
    }),
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 5,
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 5,
    })
  ],
});

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface LogContext {
  readonly userId?: string;
  readonly adminId?: string;
  readonly seasonId?: string;
  readonly divisionId?: string;
  readonly matchId?: string;
  readonly sport?: string;
  readonly sessionId?: string;
  readonly requestId?: string;
  readonly operation?: string;
  readonly duration?: number;
  readonly error?: Error | string;
  readonly stack?: string;
  readonly [key: string]: unknown;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// Enhanced Logger Class
// ============================================================================

class Logger {
  private static instance: Logger;
  private readonly logLevel: LogLevel;
  private readonly includeStackTrace: boolean;
  private performanceTracking: Map<string, PerformanceMetrics>;
  
  private constructor(
    level: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info',
    includeStackTrace: boolean = process.env.NODE_ENV !== 'production'
  ) {
    this.logLevel = level;
    this.includeStackTrace = includeStackTrace;
    this.performanceTracking = new Map();
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
  
  private sanitizeContext(context?: LogContext): LogContext {
    if (!context) return {};
    
    // Remove sensitive information
    const sanitized = { ...context };
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken'];
    
    sensitiveKeys.forEach(key => {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
  
  // ============================================================================
  // Core Logging Methods
  // ============================================================================
  
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      const sanitized = this.sanitizeContext(context);
      winstonLogger.debug(message, sanitized);
    }
  }
  
  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      const sanitized = this.sanitizeContext(context);
      winstonLogger.info(message, sanitized);
    }
  }
  
  warn(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog('warn')) {
      const sanitized = this.sanitizeContext(context);
      const logData = {
        ...sanitized,
        ...(error && { 
          error: error.message,
          ...(this.includeStackTrace && { stack: error.stack })
        }),
      };
      winstonLogger.warn(message, logData);
    }
  }
  
  error(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog('error')) {
      const sanitized = this.sanitizeContext(context);
      const logData = {
        ...sanitized,
        ...(error && { 
          error: error.message,
          errorName: error.name,
          stack: error.stack,
        }),
      };
      winstonLogger.error(message, logData);
    }
  }
  
  // ============================================================================
  // Performance Tracking
  // ============================================================================
  
  startPerformanceTracking(operationId: string, operation: string, metadata?: Record<string, any>): void {
    this.performanceTracking.set(operationId, {
      operation,
      startTime: Date.now(),
      metadata,
    });
    
    this.debug(`Started tracking: ${operation}`, { operationId, ...metadata });
  }
  
  endPerformanceTracking(operationId: string, additionalContext?: LogContext): void {
    const tracking = this.performanceTracking.get(operationId);
    
    if (!tracking) {
      this.warn('Performance tracking not found', { operationId });
      return;
    }
    
    tracking.endTime = Date.now();
    tracking.duration = tracking.endTime - tracking.startTime;
    
    this.info(`Completed: ${tracking.operation}`, {
      operationId,
      duration: `${tracking.duration}ms`,
      ...tracking.metadata,
      ...additionalContext,
    });
    
    this.performanceTracking.delete(operationId);
  }
  
  // ============================================================================
  // HTTP Request Logging
  // ============================================================================
  
  httpRequest(method: string, url: string, statusCode: number, duration: number, context?: LogContext): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    this[level](`HTTP ${method} ${url}`, {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      ...context,
    });
  }
  
  // ============================================================================
  // Database Operations
  // ============================================================================
  
  databaseOperation(operation: string, table: string, duration: number, context?: LogContext): void {
    this.debug('Database operation completed', {
      operation,
      table,
      duration: `${duration}ms`,
      operation_type: 'database',
      ...context,
    });
  }
  
  databaseError(operation: string, table: string, error: Error, context?: LogContext): void {
    this.error('Database operation failed', {
      operation,
      table,
      operation_type: 'database',
      ...context,
    }, error);
  }
  
  // ============================================================================
  // Questionnaire Operations
  // ============================================================================
  
  questionnaireRequested(sport: string, requestId: string, context?: LogContext): void {
    this.info('Questionnaire requested', {
      sport,
      requestId,
      operation: 'get_questionnaire',
      ...context,
    });
  }
  
  questionnaireLoaded(sport: string, version: number, questionCount: number, context?: LogContext): void {
    this.info('Questionnaire loaded successfully', {
      sport,
      version,
      questionCount,
      operation: 'load_questionnaire',
      ...context,
    });
  }
  
  responseSubmitted(userId: string, sport: string, responseId: number, context?: LogContext): void {
    this.info('Response submitted successfully', {
      userId,
      sport,
      responseId,
      operation: 'submit_response',
      ...context,
    });
  }
  
  scoringCompleted(sport: string, rating: number, confidence: string, duration: number, context?: LogContext): void {
    this.info('Scoring completed', {
      sport,
      rating,
      confidence,
      duration: `${duration}ms`,
      operation: 'scoring',
      ...context,
    });
  }
  
  validationFailed(field: string, value: unknown, reason: string, context?: LogContext): void {
    this.warn('Validation failed', {
      field,
      value: typeof value === 'object' ? JSON.stringify(value) : value,
      reason,
      operation: 'validation',
      ...context,
    });
  }
  
  // ============================================================================
  // Season & Division Operations
  // ============================================================================
  
  seasonCreated(seasonId: string, seasonName: string, context?: LogContext): void {
    this.info('Season created', {
      seasonId,
      seasonName,
      operation: 'create_season',
      ...context,
    });
  }
  
  divisionCreated(divisionId: string, divisionName: string, seasonId: string, context?: LogContext): void {
    this.info('Division created', {
      divisionId,
      divisionName,
      seasonId,
      operation: 'create_division',
      ...context,
    });
  }
  
  playerAssigned(userId: string, divisionId: string, seasonId: string, context?: LogContext): void {
    this.info('Player assigned to division', {
      userId,
      divisionId,
      seasonId,
      operation: 'assign_player',
      ...context,
    });
  }
  
  playerRemoved(userId: string, divisionId: string, reason?: string, context?: LogContext): void {
    this.info('Player removed from division', {
      userId,
      divisionId,
      reason,
      operation: 'remove_player',
      ...context,
    });
  }
  
  playerTransferred(userId: string, fromDivisionId: string, toDivisionId: string, context?: LogContext): void {
    this.info('Player transferred between divisions', {
      userId,
      fromDivisionId,
      toDivisionId,
      operation: 'transfer_player',
      ...context,
    });
  }
  
  // ============================================================================
  // Notification Operations
  // ============================================================================
  
  notificationSent(type: string, userIds: string[], context?: LogContext): void {
    this.info('Notification sent', {
      type,
      recipientCount: userIds.length,
      operation: 'send_notification',
      ...context,
    });
  }
  
  notificationFailed(type: string, userIds: string[], error: Error, context?: LogContext): void {
    this.error('Notification sending failed', {
      type,
      recipientCount: userIds.length,
      operation: 'send_notification',
      ...context,
    }, error);
  }
  
  // ============================================================================
  // Authentication & Authorization
  // ============================================================================
  
  authSuccess(userId: string, method: string, context?: LogContext): void {
    this.info('Authentication successful', {
      userId,
      method,
      operation: 'authentication',
      ...context,
    });
  }
  
  authFailed(method: string, reason: string, context?: LogContext): void {
    this.warn('Authentication failed', {
      method,
      reason,
      operation: 'authentication',
      ...context,
    });
  }
  
  unauthorizedAccess(userId: string | undefined, resource: string, context?: LogContext): void {
    this.warn('Unauthorized access attempt', {
      userId: userId || 'anonymous',
      resource,
      operation: 'authorization',
      ...context,
    });
  }
  
  // ============================================================================
  // Payment Operations
  // ============================================================================
  
  paymentProcessed(userId: string, amount: number, status: string, context?: LogContext): void {
    this.info('Payment processed', {
      userId,
      amount,
      status,
      operation: 'payment',
      ...context,
    });
  }
  
  paymentFailed(userId: string, amount: number, reason: string, context?: LogContext): void {
    this.error('Payment failed', {
      userId,
      amount,
      reason,
      operation: 'payment',
      ...context,
    });
  }
  
  // ============================================================================
  // System & Health
  // ============================================================================
  
  serverStarted(port: number, environment: string): void {
    this.info('🚀 Server started successfully', {
      port,
      environment,
      nodeVersion: process.version,
      platform: process.platform,
      operation: 'server_start',
    });
  }
  
  serverShutdown(reason: string): void {
    this.info('Server shutting down', {
      reason,
      operation: 'server_shutdown',
    });
  }
  
  healthCheck(status: 'healthy' | 'unhealthy', checks?: Record<string, boolean>): void {
    const level = status === 'healthy' ? 'info' : 'error';
    this[level]('Health check', {
      status,
      checks,
      operation: 'health_check',
    });
  }
  
  // ============================================================================
  // External Service Integrations
  // ============================================================================
  
  externalServiceCall(service: string, endpoint: string, duration: number, context?: LogContext): void {
    this.debug('External service call', {
      service,
      endpoint,
      duration: `${duration}ms`,
      operation: 'external_service',
      ...context,
    });
  }
  
  externalServiceError(service: string, endpoint: string, error: Error, context?: LogContext): void {
    this.error('External service call failed', {
      service,
      endpoint,
      operation: 'external_service',
      ...context,
    }, error);
  }
  
  // ============================================================================
  // Socket.IO Operations
  // ============================================================================
  
  socketConnected(socketId: string, userId?: string): void {
    this.info('Socket connected', {
      socketId,
      userId,
      operation: 'socket_connection',
    });
  }
  
  socketDisconnected(socketId: string, userId?: string, reason?: string): void {
    this.info('Socket disconnected', {
      socketId,
      userId,
      reason,
      operation: 'socket_disconnection',
    });
  }
  
  socketEvent(event: string, socketId: string, data?: any): void {
    this.debug('Socket event', {
      event,
      socketId,
      data: data ? JSON.stringify(data) : undefined,
      operation: 'socket_event',
    });
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  /**
   * Create a child logger with persistent context
   */
  child(defaultContext: LogContext): ChildLogger {
    return new ChildLogger(this, defaultContext);
  }
  
  /**
   * Log a separator for better readability in logs
   */
  separator(text?: string): void {
    const line = '='.repeat(80);
    if (text) {
      this.info(`${line}\n${text}\n${line}`);
    } else {
      this.info(line);
    }
  }
}

// ============================================================================
// Child Logger (for scoped logging)
// ============================================================================

class ChildLogger {
  constructor(
    private parent: Logger,
    private defaultContext: LogContext
  ) {}
  
  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, { ...this.defaultContext, ...context });
  }
  
  info(message: string, context?: LogContext): void {
    this.parent.info(message, { ...this.defaultContext, ...context });
  }
  
  warn(message: string, context?: LogContext, error?: Error): void {
    this.parent.warn(message, { ...this.defaultContext, ...context }, error);
  }
  
  error(message: string, context?: LogContext, error?: Error): void {
    this.parent.error(message, { ...this.defaultContext, ...context }, error);
  }
}

// ============================================================================
// Exports
// ============================================================================

export const logger = Logger.getInstance();
export default Logger;