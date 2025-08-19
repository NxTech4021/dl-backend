// src/services/scoring.ts
export function scorePickleball(answers: Record<string, any>) {
    // TODO: port real logic; return stable shape below
    return {
      source: 'questionnaire',
      singles: 1200,
      doubles: 1180,
      rd: 240,
      confidence: 'medium',
      detail: { notes: 'stub' }
    };
  }
  export const scoreTennis = scorePickleball;
  export const scorePadel  = scorePickleball;
  