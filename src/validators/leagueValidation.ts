import { LeagueStatus, LeagueDurationUnit, LeagueJoinRequestStatus } from "@prisma/client";

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Helper function to validate required string
function validateRequiredString(value: any, fieldName: string, maxLength?: number): string[] {
  const errors: string[] = [];

  if (!value || typeof value !== 'string' || !value.trim()) {
    errors.push(`${fieldName} is required`);
    return errors;
  }

  if (maxLength && value.trim().length > maxLength) {
    errors.push(`${fieldName} cannot exceed ${maxLength} characters`);
  }

  return errors;
}

// Helper function to validate optional string
function validateOptionalString(value: any, fieldName: string, maxLength?: number): string[] {
  const errors: string[] = [];

  if (value !== undefined && value !== null) {
    if (typeof value !== 'string') {
      errors.push(`${fieldName} must be a string`);
      return errors;
    }

    if (maxLength && value.length > maxLength) {
      errors.push(`${fieldName} cannot exceed ${maxLength} characters`);
    }
  }

  return errors;
}

// Helper function to validate email
function validateEmail(value: any): boolean {
  if (!value || typeof value !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

// Helper function to validate color
function validateColor(value: any): boolean {
  if (!value || typeof value !== 'string') return false;
  const colorRegex = /^#[0-9A-F]{6}$/i;
  return colorRegex.test(value);
}

// Helper function to validate URL
function validateURL(value: any): boolean {
  if (!value || typeof value !== 'string') return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// Create League validation
export function validateCreateLeague(data: any): ValidationResult {
  const errors: string[] = [];

  // Required fields
  errors.push(...validateRequiredString(data.name, "League name", 255));
  errors.push(...validateRequiredString(data.sport, "Sport"));
  errors.push(...validateRequiredString(data.location, "Location"));

  // Optional fields
  errors.push(...validateOptionalString(data.description, "Description"));
  errors.push(...validateOptionalString(data.theme, "Theme"));

  // Validate status if provided
  if (data.status !== undefined) {
    const validStatuses = Object.values(LeagueStatus);
    if (!validStatuses.includes(data.status)) {
      errors.push("Invalid status value");
    }
  }

  // Validate branding fields
  if (data.brandingLogoUrl !== undefined && data.brandingLogoUrl !== null && data.brandingLogoUrl !== "") {
    if (!validateURL(data.brandingLogoUrl)) {
      errors.push("Invalid logo URL format");
    }
  }

  if (data.brandingPrimaryColor !== undefined && data.brandingPrimaryColor !== null && data.brandingPrimaryColor !== "") {
    if (!validateColor(data.brandingPrimaryColor)) {
      errors.push("Invalid primary color format. Use hex format like #FF0000");
    }
  }

  if (data.brandingSecondaryColor !== undefined && data.brandingSecondaryColor !== null && data.brandingSecondaryColor !== "") {
    if (!validateColor(data.brandingSecondaryColor)) {
      errors.push("Invalid secondary color format. Use hex format like #FF0000");
    }
  }

  return { isValid: errors.length === 0, errors };
}

// Update League validation
export function validateUpdateLeague(data: any): ValidationResult {
  const errors: string[] = [];

  // All fields are optional for updates, but validate if provided
  if (data.name !== undefined) {
    errors.push(...validateRequiredString(data.name, "League name", 255));
  }

  if (data.sport !== undefined) {
    errors.push(...validateRequiredString(data.sport, "Sport"));
  }

  if (data.location !== undefined) {
    errors.push(...validateRequiredString(data.location, "Location"));
  }

  errors.push(...validateOptionalString(data.description, "Description"));
  errors.push(...validateOptionalString(data.theme, "Theme"));

  // Validate status if provided
  if (data.status !== undefined) {
    const validStatuses = Object.values(LeagueStatus);
    if (!validStatuses.includes(data.status)) {
      errors.push("Invalid status value");
    }
  }

  // Validate branding fields
  if (data.brandingLogoUrl !== undefined && data.brandingLogoUrl !== null && data.brandingLogoUrl !== "") {
    if (!validateURL(data.brandingLogoUrl)) {
      errors.push("Invalid logo URL format");
    }
  }

  if (data.brandingPrimaryColor !== undefined && data.brandingPrimaryColor !== null && data.brandingPrimaryColor !== "") {
    if (!validateColor(data.brandingPrimaryColor)) {
      errors.push("Invalid primary color format. Use hex format like #FF0000");
    }
  }

  if (data.brandingSecondaryColor !== undefined && data.brandingSecondaryColor !== null && data.brandingSecondaryColor !== "") {
    if (!validateColor(data.brandingSecondaryColor)) {
      errors.push("Invalid secondary color format. Use hex format like #FF0000");
    }
  }

  if (data.isArchived !== undefined && typeof data.isArchived !== 'boolean') {
    errors.push("isArchived must be a boolean");
  }

  return { isValid: errors.length === 0, errors };
}

// List Leagues validation
export function validateListLeagues(data: any): ValidationResult {
  const errors: string[] = [];

  // All query parameters are optional
  if (data.page !== undefined) {
    const page = parseInt(data.page);
    if (isNaN(page) || page < 1) {
      errors.push("Page must be a positive integer");
    }
  }

  if (data.pageSize !== undefined) {
    const pageSize = parseInt(data.pageSize);
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      errors.push("Page size must be between 1 and 100");
    }
  }

  return { isValid: errors.length === 0, errors };
}

// League Settings validation
export function validateLeagueSettings(data: any): ValidationResult {
  const errors: string[] = [];

  // Validate duration settings
  if (data.durationUnit !== undefined) {
    const validUnits = Object.values(LeagueDurationUnit);
    if (!validUnits.includes(data.durationUnit)) {
      errors.push("Invalid duration unit");
    }
  }

  if (data.durationValue !== undefined) {
    const value = parseInt(data.durationValue);
    if (isNaN(value) || value < 1 || value > 52) {
      errors.push("Duration value must be between 1 and 52");
    }
  }

  // Validate player limits
  if (data.minPlayersPerDivision !== undefined) {
    const min = parseInt(data.minPlayersPerDivision);
    if (isNaN(min) || min < 2 || min > 100) {
      errors.push("Minimum players per division must be between 2 and 100");
    }
  }

  if (data.maxPlayersPerDivision !== undefined) {
    const max = parseInt(data.maxPlayersPerDivision);
    if (isNaN(max) || max < 2 || max > 100) {
      errors.push("Maximum players per division must be between 2 and 100");
    }
  }

  // Validate min <= max
  if (data.minPlayersPerDivision !== undefined && data.maxPlayersPerDivision !== undefined) {
    const min = parseInt(data.minPlayersPerDivision);
    const max = parseInt(data.maxPlayersPerDivision);
    if (!isNaN(min) && !isNaN(max) && min > max) {
      errors.push("Minimum players per division cannot exceed maximum players per division");
    }
  }

  if (data.registrationDeadlineDays !== undefined) {
    const days = parseInt(data.registrationDeadlineDays);
    if (isNaN(days) || days < 0 || days > 365) {
      errors.push("Registration deadline days must be between 0 and 365");
    }
  }

  if (data.archiveRetentionMonths !== undefined) {
    const months = parseInt(data.archiveRetentionMonths);
    if (isNaN(months) || months < 1 || months > 120) {
      errors.push("Archive retention months must be between 1 and 120");
    }
  }

  return { isValid: errors.length === 0, errors };
}

// Preview League Settings validation
export function validatePreviewLeagueSettings(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data.previewPayload) {
    errors.push("previewPayload is required");
  }

  if (data.expiresInMinutes !== undefined) {
    const minutes = parseInt(data.expiresInMinutes);
    if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
      errors.push("Expires in minutes must be between 1 and 1440 (24 hours)");
    }
  }

  return { isValid: errors.length === 0, errors };
}

// Join Request validation
export function validateCreateLeagueJoinRequest(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data.userId || typeof data.userId !== 'string') {
    errors.push("userId is required");
  }

  errors.push(...validateOptionalString(data.notes, "Notes"));

  return { isValid: errors.length === 0, errors };
}

// Update Join Request Status validation
export function validateUpdateLeagueJoinRequestStatus(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data.status) {
    errors.push("status is required");
  } else {
    const validStatuses = Object.values(LeagueJoinRequestStatus);
    if (!validStatuses.includes(data.status)) {
      errors.push("Invalid status value");
    }
  }

  // Require decision reason for denied requests
  if (data.status === LeagueJoinRequestStatus.DENIED) {
    if (!data.decisionReason || typeof data.decisionReason !== 'string' || !data.decisionReason.trim()) {
      errors.push("Decision reason is required when denying a request");
    }
  }

  return { isValid: errors.length === 0, errors };
}

// League Template validation
export function validateCreateLeagueTemplate(data: any): ValidationResult {
  const errors: string[] = [];

  errors.push(...validateRequiredString(data.name, "Template name", 255));
  errors.push(...validateRequiredString(data.sport, "Sport"));
  errors.push(...validateOptionalString(data.description, "Description"));

  return { isValid: errors.length === 0, errors };
}

// Bulk Create Leagues validation
export function validateBulkCreateLeagues(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data.leagues || !Array.isArray(data.leagues)) {
    errors.push("leagues must be an array");
    return { isValid: false, errors };
  }

  if (data.leagues.length === 0) {
    errors.push("At least one league is required");
  }

  if (data.leagues.length > 50) {
    errors.push("Cannot create more than 50 leagues at once");
  }

  // Validate each league
  data.leagues.forEach((league: any, index: number) => {
    const leagueValidation = validateCreateLeague(league);
    if (!leagueValidation.isValid) {
      leagueValidation.errors.forEach(error => {
        errors.push(`League ${index + 1}: ${error}`);
      });
    }
  });

  if (data.copySettingsFromLeagueId !== undefined && typeof data.copySettingsFromLeagueId !== 'string') {
    errors.push("copySettingsFromLeagueId must be a string");
  }

  return { isValid: errors.length === 0, errors };
}

// Copy League Settings validation
export function validateCopyLeagueSettings(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data.sourceLeagueId || typeof data.sourceLeagueId !== 'string') {
    errors.push("sourceLeagueId is required");
  }

  if (!data.targetLeagueIds || !Array.isArray(data.targetLeagueIds)) {
    errors.push("targetLeagueIds must be an array");
    return { isValid: false, errors };
  }

  if (data.targetLeagueIds.length === 0) {
    errors.push("At least one target league is required");
  }

  if (data.targetLeagueIds.length > 20) {
    errors.push("Cannot copy to more than 20 leagues at once");
  }

  data.targetLeagueIds.forEach((id: any, index: number) => {
    if (typeof id !== 'string') {
      errors.push(`Target league ID ${index + 1} must be a string`);
    }
  });

  return { isValid: errors.length === 0, errors };
}

// Export input types for TypeScript support
export interface CreateLeagueInput {
  name: string;
  sport: string;
  location: string;
  status?: LeagueStatus;
  description?: string;
  brandingLogoUrl?: string;
  brandingPrimaryColor?: string;
  brandingSecondaryColor?: string;
  theme?: string;
}

export interface UpdateLeagueInput extends Partial<CreateLeagueInput> {
  isArchived?: boolean;
}

export interface ListLeaguesInput {
  search?: string;
  sport?: string;
  status?: string;
  location?: string;
  page?: string;
  pageSize?: string;
}

export interface LeagueSettingsInput {
  durationUnit?: LeagueDurationUnit;
  durationValue?: number;
  minPlayersPerDivision?: number;
  maxPlayersPerDivision?: number;
  registrationDeadlineDays?: number;
  paymentSettings?: any;
  divisionRules?: any;
  playoffConfiguration?: any;
  finalsConfiguration?: any;
  workflowConfiguration?: any;
  templates?: any;
  customRulesText?: string;
  branding?: any;
  integrationSettings?: any;
  bulkOperations?: any;
  archiveRetentionMonths?: number;
  validationRules?: any;
  errorHandling?: any;
  previewPayload?: any;
  previewExpiresAt?: Date;
}

export interface CreateLeagueJoinRequestInput {
  userId: string;
  notes?: string;
}

export interface UpdateLeagueJoinRequestStatusInput {
  status: LeagueJoinRequestStatus;
  decisionReason?: string;
}

export interface CreateLeagueTemplateInput {
  name: string;
  sport: string;
  description?: string;
  settings?: any;
}

export interface BulkCreateLeaguesInput {
  leagues: CreateLeagueInput[];
  copySettingsFromLeagueId?: string;
}

export interface CopyLeagueSettingsInput {
  sourceLeagueId: string;
  targetLeagueIds: string[];
}