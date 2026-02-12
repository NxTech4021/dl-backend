import { Response } from "express";

// ---- Types ----

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---- Helpers ----

/**
 * Send a standard success response.
 * Use for single items, arrays (non-paginated), or action confirmations.
 *
 * Shape: { success: true, data: T, message?: string }
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): void {
  const body: Record<string, unknown> = { success: true, data };
  if (message) body.message = message;
  res.status(statusCode).json(body);
}

/**
 * Send a paginated list response.
 * Pagination is a sibling of data, never nested inside it.
 *
 * Shape: { success: true, data: T[], pagination: {...}, message?: string, ...meta }
 *
 * The optional `meta` param spreads extra top-level fields for endpoints
 * that return additional data (e.g., getDivisionsBySeasonId returns `season` and `filters`).
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  message?: string,
  meta?: Record<string, unknown>
): void {
  const body: Record<string, unknown> = { success: true, data, pagination };
  if (message) body.message = message;
  if (meta) Object.assign(body, meta);
  res.status(200).json(body);
}

/**
 * Send a standard error response.
 *
 * Shape: { success: false, data: null, message: string }
 */
export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500
): void {
  res.status(statusCode).json({ success: false, data: null, message });
}
