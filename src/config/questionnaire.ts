// Configuration service for questionnaire system

import { DEFAULT_CONFIG, SportType } from './defaults';

interface QuestionnaireConfig {
  readonly questionnaireDataPath: string;
  readonly supportedSports: ReadonlyArray<string>;
  readonly validation: {
    readonly maxAnswersLength: number;
    readonly requiredFields: ReadonlyArray<string>;
  };
  readonly scoring: {
    readonly timeoutMs: number;
    readonly defaultRating: number;
    readonly maxRating: number;
    readonly minRating: number;
  };
  readonly logging: {
    readonly level: 'debug' | 'info' | 'warn' | 'error';
    readonly includeStackTrace: boolean;
  };
  readonly cache: {
    readonly ttlMs: number;
  };
  readonly database: {
    readonly timeoutMs: number;
  };
}

class ConfigurationService {
  private static instance: QuestionnaireConfig;
  
  static getConfig(): QuestionnaireConfig {
    if (!this.instance) {
      this.instance = {
        questionnaireDataPath: DEFAULT_CONFIG.QUESTIONNAIRE_DATA_PATH,
        supportedSports: [...DEFAULT_CONFIG.SUPPORTED_SPORTS],
        validation: {
          maxAnswersLength: DEFAULT_CONFIG.MAX_ANSWERS_LENGTH,
          requiredFields: ['userId', 'answers'] as const,
        },
        scoring: {
          timeoutMs: DEFAULT_CONFIG.SCORING_TIMEOUT_MS,
          defaultRating: DEFAULT_CONFIG.DEFAULT_RATING,
          maxRating: DEFAULT_CONFIG.MAX_RATING,
          minRating: DEFAULT_CONFIG.MIN_RATING,
        },
        logging: {
          level: DEFAULT_CONFIG.LOG_LEVEL,
          includeStackTrace: process.env.NODE_ENV !== 'production',
        },
        cache: {
          ttlMs: DEFAULT_CONFIG.CACHE_TTL_MS,
        },
        database: {
          timeoutMs: DEFAULT_CONFIG.DB_TIMEOUT_MS,
        },
      };
    }
    return this.instance;
  }
  
  static isSupportedSport(sport: string): sport is SportType {
    return DEFAULT_CONFIG.SUPPORTED_SPORTS.includes(sport as SportType);
  }
}

export default ConfigurationService;