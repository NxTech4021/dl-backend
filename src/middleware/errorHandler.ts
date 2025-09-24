import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logSecurityEvent } from './security';

// Custom error class
export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global error handler
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        // Unique constraint violation
        const field = (err.meta?.target as string[])?.[0];
        error = new AppError(
          `${field || 'Field'} already exists`,
          409,
          'DUPLICATE_ENTRY'
        );
        break;
      case 'P2014':
        // Relation violation
        error = new AppError(
          'Invalid relation reference',
          400,
          'INVALID_RELATION'
        );
        break;
      case 'P2003':
        // Foreign key constraint
        error = new AppError(
          'Referenced record not found',
          400,
          'FOREIGN_KEY_ERROR'
        );
        break;
      case 'P2025':
        // Record not found
        error = new AppError(
          'Record not found',
          404,
          'NOT_FOUND'
        );
        break;
      default:
        error = new AppError(
          'Database operation failed',
          500,
          'DATABASE_ERROR'
        );
    }
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    error = new AppError(
      'Invalid data provided',
      400,
      'VALIDATION_ERROR'
    );
  }

  // MongoDB errors (if using MongoDB)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    error = new AppError(
      `${field} already exists`,
      409,
      'DUPLICATE_ENTRY'
    );
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401, 'TOKEN_EXPIRED');
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {})
      .map((e: any) => e.message)
      .join(', ');
    error = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new AppError(
      'File too large',
      413,
      'FILE_SIZE_EXCEEDED'
    );
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    error = new AppError(
      'Too many files',
      400,
      'FILE_COUNT_EXCEEDED'
    );
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new AppError(
      'Unexpected file field',
      400,
      'UNEXPECTED_FILE'
    );
  }

  // Security logging for certain errors
  if (error.statusCode === 401 || error.statusCode === 403) {
    logSecurityEvent('AUTH_ERROR', {
      ip: req.ip,
      url: req.originalUrl,
      error: error.message,
    });
  }

  // Send error response
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err,
    }),
  });
};

// Not found handler
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

// Unhandled rejection handler
export const unhandledRejectionHandler = () => {
  process.on('unhandledRejection', (err: any) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    process.exit(1);
  });
};

// Uncaught exception handler
export const uncaughtExceptionHandler = () => {
  process.on('uncaughtException', (err: any) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    process.exit(1);
  });
};