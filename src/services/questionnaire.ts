// Production-grade questionnaire service
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { 
  SportType, 
  QuestionnaireDefinition, 
  QuestionnaireNotFoundError,
  Result
} from '../types/questionnaire';
import ConfigurationService from '../config/questionnaire';
import Logger from '../utils/logger';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface QuestionnaireLoadResult {
  readonly definition: QuestionnaireDefinition;
  readonly hash: string;
  readonly version: number;
}

class QuestionnaireService {
  private readonly logger: Logger;
  private readonly config = ConfigurationService.getConfig();
  private readonly questionnaireCache = new Map<string, { data: QuestionnaireLoadResult; timestamp: number }>();
  
  constructor(logger: Logger) {
    this.logger = logger;
  }
  
  async loadQuestionnaire(sport: SportType): Promise<Result<QuestionnaireLoadResult, QuestionnaireNotFoundError>> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cached = this.getCachedQuestionnaire(sport);
      if (cached) {
        this.logger.debug('Questionnaire loaded from cache', { sport });
        return Result.success(cached);
      }
      
      const filePath = this.getQuestionnairePath(sport);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        const error = new QuestionnaireNotFoundError(sport);
        this.logger.error('Questionnaire file not found', { sport, filePath }, error);
        return Result.failure(error);
      }
      
      const rawContent = await fs.readFile(filePath, 'utf8');
      
      let definition: QuestionnaireDefinition;
      try {
        definition = JSON.parse(rawContent) as QuestionnaireDefinition;
      } catch (parseError) {
        const error = new QuestionnaireNotFoundError(sport);
        this.logger.error('Failed to parse questionnaire JSON', { sport, filePath }, parseError as Error);
        return Result.failure(error);
      }
      
      const hash = crypto.createHash('sha1').update(rawContent).digest('hex');
      const version = definition.version;
      
      const result: QuestionnaireLoadResult = {
        definition,
        hash,
        version
      };
      
      // Cache the result
      this.cacheQuestionnaire(sport, result);
      
      const duration = Date.now() - startTime;
      this.logger.questionnaireLoaded(sport, version, definition.questions.length);
      this.logger.debug('Questionnaire loaded successfully', { sport, duration, questionCount: definition.questions.length });
      
      return Result.success(result);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const questionnaireError = new QuestionnaireNotFoundError(sport);
      this.logger.error('Unexpected error loading questionnaire', { sport, duration }, error as Error);
      return Result.failure(questionnaireError);
    }
  }
  
  private getQuestionnairePath(sport: SportType): string {
    return path.resolve(__dirname, this.config.questionnaireDataPath, `${sport}-questionnaire.v1.json`);
  }
  
  private getCachedQuestionnaire(sport: SportType): QuestionnaireLoadResult | null {
    const cached = this.questionnaireCache.get(sport);
    if (!cached) {
      return null;
    }
    
    const isExpired = Date.now() - cached.timestamp > this.config.cache.ttlMs;
    if (isExpired) {
      this.questionnaireCache.delete(sport);
      return null;
    }
    
    return cached.data;
  }
  
  private cacheQuestionnaire(sport: SportType, data: QuestionnaireLoadResult): void {
    this.questionnaireCache.set(sport, {
      data,
      timestamp: Date.now()
    });
  }
  
  // Clear cache - useful for testing or manual cache invalidation
  clearCache(): void {
    this.questionnaireCache.clear();
    this.logger.debug('Questionnaire cache cleared');
  }
}

export default QuestionnaireService;

// Legacy function for backward compatibility during migration
export async function loadQuestionnaire(sport: SportType) {
  const logger = Logger.getInstance();
  const service = new QuestionnaireService(logger);
  const result = await service.loadQuestionnaire(sport);
  
  if (result.isFailure()) {
    throw result.getError();
  }
  
  const { definition, hash, version } = result.getValue();
  return { def: definition, qHash: hash, version };
}
