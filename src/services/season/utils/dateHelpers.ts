/**
 * Date Helper Utilities
 * Pure date conversion and checking functions
 */

/**
 * Convert unknown input to ISO date string
 * Fallback to epoch (1970-01-01) for invalid dates
 */
export function toISODateString(input: unknown): string {
  if (!input) return new Date(0).toISOString();

  const date = input instanceof Date ? input : new Date(input as any);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

/**
 * Convert unknown input to ISO date string or null
 */
export function toISODateStringOrNull(input: unknown): string | null {
  if (input === null || input === undefined) return null;

  const date = input instanceof Date ? input : new Date(input as any);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Check if season registration is currently open
 * Players can register as long as the registration deadline hasn't passed,
 * even if the season has already started
 */
export function isRegistrationOpen(season: any): boolean {
  const now = new Date();

  // Only check registration deadline
  // Registration is open as long as the deadline hasn't passed
  if (season.regiDeadline && now > new Date(season.regiDeadline)) {
    return false;
  }

  return true;
}

/**
 * Check if season is currently active
 */
export function isSeasonActive(season: any): boolean {
  return season.isActive === true && season.status === "ACTIVE";
}

/**
 * Check if date is in the past
 */
export function isDateInPast(date: Date | string): boolean {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  return targetDate < new Date();
}

/**
 * Check if date is in the future
 */
export function isDateInFuture(date: Date | string): boolean {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  return targetDate > new Date();
}
