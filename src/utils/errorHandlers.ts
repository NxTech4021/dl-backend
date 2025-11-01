import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from './errors';
import { logger } from './logger';

/**
 * Handle controller errors consistently
 */
export const handleControllerError = (
  error: any,
  res: Response,
  operation: string
): Response => {
  logger.error(`Error in ${operation}:`, error);

  // Handle custom AppError
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      ...(error.details && { details: error.details }),
    });
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(error, res);
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      error: 'Invalid data format or validation error',
    });
  }

  // Handle generic errors
  return res.status(500).json({
    success: false,
    error: error.message || `Failed to ${operation}`,
  });
};

/**
 * Handle Prisma-specific errors
 */
export const handlePrismaError = (
  error: Prisma.PrismaClientKnownRequestError,
  res: Response
): Response => {
  switch (error.code) {
    case 'P2002':
      return res.status(409).json({
        success: false,
        error: 'A record with this unique constraint already exists',
        field: (error.meta?.target as string[])?.join(', '),
      });

    case 'P2003':
      return res.status(400).json({
        success: false,
        error: 'Invalid reference to related record',
        field: error.meta?.field_name,
      });

    case 'P2025':
      return res.status(404).json({
        success: false,
        error: 'Record not found',
      });

    case 'P2014':
      return res.status(400).json({
        success: false,
        error: 'Invalid relation',
      });

    default:
      logger.error('Unhandled Prisma error:', { code: error.code, meta: error.meta });
      return res.status(500).json({
        success: false,
        error: 'Database operation failed',
      });
  }
};