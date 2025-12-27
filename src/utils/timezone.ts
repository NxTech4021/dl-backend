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
