// Production middleware for questionnaire routes

import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import Logger from '../utils/logger';
import { ValidationError } from '../types/questionnaire';
import { DEFAULT_CONFIG } from '../config/defaults';

const logger = Logger.getInstance();

// Rate limiting middleware for questionnaire endpoints
export const questionnaireRateLimit = rateLimit({
  windowMs: DEFAULT_CONFIG.RATE_LIMIT.GENERAL.WINDOW_MS,
  max: DEFAULT_CONFIG.RATE_LIMIT.GENERAL.MAX_REQUESTS,
  message: {
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED',
    success: false,
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      method: req.method
    });
    
    res.status(429).json({
      error: 'Too many requests from this IP',
      code: 'RATE_LIMIT_EXCEEDED',
      success: false,
      retryAfter: 15 * 60
    });
  }
});

// Submission-specific rate limiting (more restrictive)
export const submissionRateLimit = rateLimit({
  windowMs: DEFAULT_CONFIG.RATE_LIMIT.SUBMISSION.WINDOW_MS,
  max: DEFAULT_CONFIG.RATE_LIMIT.SUBMISSION.MAX_REQUESTS,
  message: {
    error: 'Too many submissions from this IP',
    code: 'SUBMISSION_RATE_LIMIT_EXCEEDED',
    success: false,
    retryAfter: 5 * 60
  },
  keyGenerator: (req) => {
    // Use combination of IP and userId for more granular control
    const userId = req.body?.userId || 'unknown';
    return `${req.ip}:${userId}`;
  },
  handler: (req, res) => {
    logger.warn('Submission rate limit exceeded', {
      ...(req.ip && { ip: req.ip }),
      ...(req.body?.userId && { userId: req.body.userId }),
      ...(req.headers['user-agent'] && { userAgent: req.headers['user-agent'] }),
      ...(req.params?.sport && { sport: req.params.sport })
    });
    
    res.status(429).json({
      error: 'Too many submissions. Please wait before submitting again.',
      code: 'SUBMISSION_RATE_LIMIT_EXCEEDED',
      success: false,
      retryAfter: 5 * 60
    });
  }
});

// Request size limiting middleware
export const requestSizeLimit = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.get('Content-Length') || '0');
  const maxSize = DEFAULT_CONFIG.REQUEST_SIZE_LIMIT;
  
  if (contentLength > maxSize) {
    logger.warn('Request too large', {
      contentLength,
      maxSize,
      ip: req.ip,
      path: req.path,
      userAgent: req.headers['user-agent']
    });
    
    return res.status(413).json({
      error: 'Request payload too large',
      code: 'PAYLOAD_TOO_LARGE',
      success: false,
      maxSize: maxSize
    });
  }
  
  next();
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Set security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'none'; object-src 'none';",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  });
  
  next();
};

// Request validation middleware
export const validateContentType = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' && req.path.includes('/submit')) {
    const contentType = req.get('Content-Type');
    
    if (!contentType || !contentType.includes('application/json')) {
      logger.warn('Invalid content type', {
        contentType,
        expectedType: 'application/json',
        ip: req.ip,
        path: req.path
      });
      
      return res.status(400).json({
        error: 'Content-Type must be application/json',
        code: 'INVALID_CONTENT_TYPE',
        success: false
      });
    }
  }
  
  next();
};

// Health check middleware to detect if services are available
export const healthCheck = (req: Request, res: Response, next: NextFunction) => {
  // Simple health check - can be expanded to check database, external services, etc.
  const healthStatus = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    nodeVersion: process.version
  };
  
  logger.debug('Health check performed', healthStatus);
  
  // Add health info to request for monitoring
  req.healthStatus = healthStatus;
  
  next();
};

// Error boundary middleware for unhandled errors
export const errorBoundary = (error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error in questionnaire middleware', {
    error: error.message,
    ...(error.stack && { stack: error.stack }),
    path: req.path,
    method: req.method,
    ...(req.ip && { ip: req.ip }),
    ...(req.headers['user-agent'] && { userAgent: req.headers['user-agent'] })
  });
  
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    success: false
  });
};

// Request timeout middleware
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          timeout: timeoutMs,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        res.status(408).json({
          error: 'Request timeout',
          code: 'REQUEST_TIMEOUT',
          success: false,
          timeout: timeoutMs
        });
      }
    }, timeoutMs);
    
    // Clear timeout when request completes
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    
    next();
  };
};

// Add TypeScript declarations for custom request properties
declare global {
  namespace Express {
    interface Request {
      healthStatus?: {
        timestamp: string;
        uptime: number;
        memoryUsage: NodeJS.MemoryUsage;
        nodeVersion: string;
      };
    }
  }
}