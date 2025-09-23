import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { Request, Response, NextFunction } from 'express';

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "same-origin" },
  xssFilter: true,
});

// Input sanitization middleware
export const sanitizeInput = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Sanitized potentially malicious input in ${key} from IP: ${req.ip}`);
  }
});

// SQL injection prevention (for raw queries if any)
export const preventSQLInjection = (req: Request, res: Response, next: NextFunction) => {
  const sqlPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE|SCRIPT|JAVASCRIPT|EVAL)\b)/gi;

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlPattern.test(value);
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  if (req.body && checkValue(req.body)) {
    return res.status(400).json({
      error: 'Invalid input detected',
      code: 'INVALID_INPUT',
      success: false
    });
  }

  if (req.query && checkValue(req.query)) {
    return res.status(400).json({
      error: 'Invalid input detected',
      code: 'INVALID_INPUT',
      success: false
    });
  }

  if (req.params && checkValue(req.params)) {
    return res.status(400).json({
      error: 'Invalid input detected',
      code: 'INVALID_INPUT',
      success: false
    });
  }

  next();
};

// XSS prevention for user-generated content
export const sanitizeXSS = (input: string): string => {
  if (!input) return input;

  // Remove script tags and event handlers
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*"[^"]*"/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*'[^']*'/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Encode HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized;
};

// Request size limiter
export const requestSizeLimiter = (req: Request, res: Response, next: NextFunction) => {
  const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB

  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_REQUEST_SIZE) {
      res.status(413).json({
        error: 'Request entity too large',
        code: 'PAYLOAD_TOO_LARGE',
        success: false
      });
      req.connection.destroy();
    }
  });

  next();
};

// CSRF token validation (for state-changing operations)
export const validateCSRFToken = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF validation for GET requests and certain paths
  if (req.method === 'GET' || req.path.includes('/auth/')) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || token !== sessionToken) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'CSRF_VALIDATION_FAILED',
      success: false
    });
  }

  next();
};

// IP blocking middleware for suspicious activity
const blockedIPs = new Set<string>();
const suspiciousActivity = new Map<string, number>();

export const ipBlocker = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress || '';

  if (blockedIPs.has(ip)) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'IP_BLOCKED',
      success: false
    });
  }

  // Track suspicious activity
  const activityCount = suspiciousActivity.get(ip) || 0;
  if (activityCount > 100) { // More than 100 suspicious requests
    blockedIPs.add(ip);
    console.error(`Blocked IP due to suspicious activity: ${ip}`);
    return res.status(403).json({
      error: 'Access denied due to suspicious activity',
      code: 'IP_BLOCKED_SUSPICIOUS',
      success: false
    });
  }

  next();
};

// Log security events
export const logSecurityEvent = (eventType: string, details: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY] ${timestamp} - ${eventType}:`, details);
  // In production, send this to a security monitoring service
};