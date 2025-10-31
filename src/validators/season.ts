import { Prisma } from "@prisma/client";
import { Response } from "express";

export const validateCreateSeasonData = (data: any) => {
  const { name, startDate, endDate, entryFee, leagueIds, categoryId } = data;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { 
      isValid: false, 
      error: "Season name is required and must be a non-empty string" 
    };
  }

  if (!startDate || !endDate) {
    return { 
      isValid: false, 
      error: "Start date and end date are required" 
    };
  }

  if (new Date(startDate) >= new Date(endDate)) {
    return {
      isValid: false,
      error: "Start date must be before end date"
    };
  }

  if (!entryFee || isNaN(Number(entryFee)) || Number(entryFee) < 0) {
    return { 
      isValid: false, 
      error: "Entry fee must be a valid non-negative number" 
    };
  }

  if (!leagueIds || !Array.isArray(leagueIds) || leagueIds.length === 0) {
    return { 
      isValid: false, 
      error: "At least one league must be specified" 
    };
  }

  if (!categoryId || typeof categoryId !== 'string') {
    return { 
      isValid: false, 
      error: "A category must be specified" 
    };
  }

  return { isValid: true };
};

export const validateUpdateSeasonData = (data: any) => {
  const { leagueIds, categoryIds, startDate, endDate, entryFee, name } = data;

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return {
      isValid: false,
      error: "Season name must be a non-empty string"
    };
  }

  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    return {
      isValid: false,
      error: "Start date must be before end date"
    };
  }

  if (entryFee !== undefined && (isNaN(Number(entryFee)) || Number(entryFee) < 0)) {
    return {
      isValid: false,
      error: "Entry fee must be a valid non-negative number"
    };
  }

  if (leagueIds && (!Array.isArray(leagueIds) || leagueIds.length === 0)) {
    return {
      isValid: false,
      error: "leagueIds must be an array with at least one league"
    };
  }

  if (categoryIds && (!Array.isArray(categoryIds) || categoryIds.length === 0)) {
    return {
      isValid: false,
      error: "categoryIds must be an array with at least one category"
    };
  }

  return { isValid: true };
};

export const validateStatusUpdate = (data: any) => {
  const { status, isActive } = data;

  if (!status && typeof isActive === "undefined") {
    return {
      isValid: false,
      error: "Provide either status or isActive."
    };
  }

  if (isActive !== undefined && typeof isActive !== "boolean") {
    return {
      isValid: false,
      error: "isActive must be a boolean value"
    };
  }

  return { isValid: true };
};

export const validateWithdrawalRequest = (data: any) => {
  const { seasonId, reason } = data;

  if (!seasonId || typeof seasonId !== 'string') {
    return {
      isValid: false,
      error: "seasonId is required and must be a string"
    };
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return {
      isValid: false,
      error: "reason is required and must be a non-empty string"
    };
  }

  if (reason.length > 500) {
    return {
      isValid: false,
      error: "Reason must be less than 500 characters"
    };
  }

  return { isValid: true };
};

export const handlePrismaError = (error: any, res: Response, defaultMessage: string) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return res.status(409).json({
          success: false,
          error: "A season with this name already exists",
        });
      case "P2003":
        return res.status(400).json({
          success: false,
          error: "One or more league IDs or category IDs are invalid",
        });
      case "P2025":
        return res.status(404).json({
          success: false,
          error: "Season not found",
        });
      default:
        break;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      error: "Invalid data format",
    });
  }

  return res.status(500).json({
    success: false,
    error: defaultMessage,
  });
};

export const handleWithdrawalError = (error: any, res: Response) => {
  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ 
      error: "Invalid data format or type for withdrawal request." 
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return res.status(404).json({ error: "Withdrawal request not found." });
  }

  res.status(500).json({ error: "Failed to process withdrawal request." });
};