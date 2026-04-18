/**
 * Timezone Utilities
 * Centralized timezone handling for Malaysia Time (UTC+8)
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Malaysia timezone constant
export const MALAYSIA_TIMEZONE = 'Asia/Kuala_Lumpur';

/**
 * Get current time in Malaysia timezone
 */
export function getCurrentMalaysiaTime(): Date {
  return dayjs().tz(MALAYSIA_TIMEZONE).toDate();
}

/**
 * Convert any date to Malaysia timezone
 */
export function toMalaysiaTime(date: Date | string): Date {
  return dayjs(date).tz(MALAYSIA_TIMEZONE).toDate();
}

/**
 * Format date in Malaysia timezone
 */
export function formatMalaysiaTime(date: Date | string, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(date).tz(MALAYSIA_TIMEZONE).format(format);
}

/**
 * Check if a date is in the past (Malaysia time)
 */
export function isPastTime(date: Date | string): boolean {
  const now = getCurrentMalaysiaTime();
  const checkDate = toMalaysiaTime(date);
  return checkDate < now;
}

/**
 * Get start of day in Malaysia timezone
 */
export function getStartOfDayMalaysia(date?: Date | string): Date {
  return dayjs(date).tz(MALAYSIA_TIMEZONE).startOf('day').toDate();
}

/**
 * Get end of day in Malaysia timezone
 */
export function getEndOfDayMalaysia(date?: Date | string): Date {
  return dayjs(date).tz(MALAYSIA_TIMEZONE).endOf('day').toDate();
}

/**
 * Parse ISO string ensuring Malaysia timezone
 */
export function parseToMalaysiaTime(isoString: string): Date {
  return dayjs(isoString).tz(MALAYSIA_TIMEZONE, true).toDate();
}

/**
 * Add hours to a date in Malaysia timezone
 */
export function addHoursMalaysia(date: Date | string, hours: number): Date {
  return dayjs(date).tz(MALAYSIA_TIMEZONE).add(hours, 'hour').toDate();
}

/**
 * Get timezone offset for Malaysia (should be +08:00)
 */
export function getMalaysiaOffset(): string {
  return dayjs().tz(MALAYSIA_TIMEZONE).format('Z');
}

// ---- Display formatting helpers ----
// All user-facing date/time strings should use these so times are always
// shown in the venue's timezone (Malaysia for now). When the app expands
// internationally, swap MALAYSIA_TIMEZONE for the league's own timezone field.

/**
 * Format a date for display: "Apr 9, 2026"
 */
export function formatMatchDate(date: Date | string): string {
  return dayjs(date).tz(MALAYSIA_TIMEZONE).format('MMM D, YYYY');
}

/**
 * Format a time for display: "3:00 PM"
 */
export function formatMatchTime(date: Date | string): string {
  return dayjs(date).tz(MALAYSIA_TIMEZONE).format('h:mm A');
}

/**
 * Format date + time for display: "Apr 9, 2026 at 3:00 PM"
 */
export function formatMatchDateTime(date: Date | string): string {
  return dayjs(date).tz(MALAYSIA_TIMEZONE).format('MMM D, YYYY [at] h:mm A');
}

/**
 * Format a date with weekday: "Wed, Apr 9"
 * Used in match reminder notifications.
 */
export function formatMatchDateShort(date: Date | string): string {
  return dayjs(date).tz(MALAYSIA_TIMEZONE).format('ddd, MMM D');
}

/**
 * Format a date dynamically relative to today (Malaysia time) for notification messages.
 *  • Same day    → "today"
 *  • +1 day      → "tomorrow"
 *  • +2–6 days   → full day name, e.g. "Saturday"
 *  • +7+ days (or past) → "D MMMM", e.g. "12 April"
 */
export function formatDynamicDate(date: Date | string): string {
  const now = dayjs().tz(MALAYSIA_TIMEZONE).startOf('day');
  const matchDay = dayjs(date).tz(MALAYSIA_TIMEZONE).startOf('day');
  const diffDays = matchDay.diff(now, 'day');
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays >= 2 && diffDays <= 6) return dayjs(date).tz(MALAYSIA_TIMEZONE).format('dddd');
  return dayjs(date).tz(MALAYSIA_TIMEZONE).format('D MMMM');
}

/**
 * Same as formatDynamicDate but prefixes "on " for day/date labels (not today/tomorrow).
 * Use for messages using the [(on) dynamic Day/Date] pattern, e.g.:
 *   "today" → "today"
 *   "tomorrow" → "tomorrow"
 *   "Saturday" → "on Saturday"
 *   "12 April" → "on 12 April"
 */
export function formatDynamicDateWithOn(date: Date | string): string {
  const label = formatDynamicDate(date);
  return label === 'today' || label === 'tomorrow' ? label : `on ${label}`;
}

/**
 * Parse a naive datetime string from a user's device and store as UTC.
 * The deviceTimezone tells us what timezone the user intended.
 * If device is already in Malaysia, we still parse explicitly to avoid
 * Node.js interpreting naive strings as UTC.
 *
 * Usage: parseDateFromDevice("2026-04-09T14:50:00", "Asia/Kuala_Lumpur")
 * Returns: Date object representing 14:50 MYT = 06:50 UTC
 */
export function parseDateFromDevice(naiveDateString: string, deviceTimezone?: string): Date {
  const tz = deviceTimezone || MALAYSIA_TIMEZONE;
  return dayjs.tz(naiveDateString, tz).toDate();
}

/**
 * Log timezone information for debugging
 */
export function logTimezoneInfo(label: string, date?: Date | string): void {
  const d = date ? dayjs(date) : dayjs();
  console.log(`[${label}]`, {
    utc: d.utc().format('YYYY-MM-DD HH:mm:ss Z'),
    malaysia: d.tz(MALAYSIA_TIMEZONE).format('YYYY-MM-DD HH:mm:ss Z'),
    offset: getMalaysiaOffset(),
  });
}
