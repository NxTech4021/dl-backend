/**
 * Enum Conversion Utilities
 * Helper functions for converting strings to Prisma enums
 */

import { DivisionLevel, GameType, GenderType } from "@prisma/client";

/**
 * Convert string to enum value (case-insensitive)
 * @param value - String value to convert
 * @param enumType - Enum object to convert to
 * @returns Enum value or undefined if invalid
 */
export function toEnum<T extends DivisionLevel | GameType | GenderType>(
  value: string | undefined,
  enumType: Record<string, T>
): T | undefined {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  return enumType[normalized];
}
