// Default configuration for questionnaire service

export const DEFAULT_CONFIG = {
  QUESTIONNAIRE_DATA_PATH: '../data/questionnaires',
  MAX_ANSWERS_LENGTH: 50,
  SCORING_TIMEOUT_MS: 5000,
  DEFAULT_RATING: 1500,
  MAX_RATING: 8000,
  MIN_RATING: 800,
  LOG_LEVEL: 'info' as const,
  REQUEST_TIMEOUT: 30000,
  SUPPORTED_SPORTS: ['pickleball', 'tennis', 'padel'] as const,
  CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
  RATE_LIMIT: {
    GENERAL: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 100
    },
    SUBMISSION: {
      WINDOW_MS: 5 * 60 * 1000, // 5 minutes
      MAX_REQUESTS: 10
    }
  },
  REQUEST_SIZE_LIMIT: 1024 * 1024, // 1MB
  DB_TIMEOUT_MS: 10000 // 10 seconds
} as const;

export type ConfigType = typeof DEFAULT_CONFIG;
export type SportType = typeof DEFAULT_CONFIG.SUPPORTED_SPORTS[number];
export type LogLevel = typeof DEFAULT_CONFIG.LOG_LEVEL;