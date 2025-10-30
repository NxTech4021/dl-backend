/**
 * Date Conversion Utilities
 * Helper functions for converting dates to ISO strings
 */

export const FALLBACK_DATE_ISO = new Date(0).toISOString();

/**
 * Convert unknown date input to ISO string with fallback
 * @param input - Date input (Date object, string, or unknown)
 * @returns ISO date string (fallback to epoch if invalid)
 */
export function toISODateString(input: unknown): string {
  if (!input) return FALLBACK_DATE_ISO;
  const date = input instanceof Date ? input : new Date(input as any);
  return Number.isNaN(date.getTime()) ? FALLBACK_DATE_ISO : date.toISOString();
}

/**
 * Convert unknown date input to ISO string or null
 * @param input - Date input (Date object, string, or unknown)
 * @returns ISO date string or null if invalid/missing
 */
export function toISODateStringOrNull(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const date = input instanceof Date ? input : new Date(input as any);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
