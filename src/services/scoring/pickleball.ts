// src/services/scoring/pickleball.ts
export function scorePickleball(answers: Record<string, any>) {
  const BASE_RATING = 1500;
  
  // Check if we should use DUPR conversion
  if (shouldSkipQuestionnaire(answers)) {
    return convertDuprToRating(answers);
  }

  // Rating adjustment ranges
  const EXPERIENCE_RANGE = 300;
  const SPORTS_BACKGROUND_RANGE = 280;
  const FREQUENCY_RANGE = 150;
  const SKILL_RANGE = 320;
  const COMPETITIVE_RANGE = 200;

  // Confidence weights
  const CONFIDENCE_WEIGHTS = {
    experience: 2.0,
    skills: 1.8,
    self_rating: 1.5,
    competitive_level: 1.3,
    sports_background: 1.2,
    frequency: 1.0,
    tournament: 1.0
  };

  let ratingAdjustment = 0;
  let weightedConfidenceScore = 0;
  let maxWeightedConfidence = 0;

  // Process each response
  const categories = ['experience', 'sports_background', 'frequency', 'competitive_level', 'self_rating', 'tournament'];
  
  for (const category of categories) {
    if (answers[category]) {
      const weight = getWeightForAnswer(category, answers[category]);
      
      if (category === 'experience') {
        ratingAdjustment += weight * EXPERIENCE_RANGE;
      } else if (category === 'sports_background') {
        ratingAdjustment += weight * SPORTS_BACKGROUND_RANGE;
      } else if (category === 'frequency') {
        ratingAdjustment += weight * FREQUENCY_RANGE;
      } else if (category === 'competitive_level') {
        ratingAdjustment += weight * COMPETITIVE_RANGE;
      } else if (category === 'self_rating') {
        ratingAdjustment += weight * SKILL_RANGE * 0.7;
      } else if (category === 'tournament') {
        ratingAdjustment += weight * SKILL_RANGE * 0.5;
      }

      const confidenceContribution = Math.abs(weight) * CONFIDENCE_WEIGHTS[category as keyof typeof CONFIDENCE_WEIGHTS];
      weightedConfidenceScore += confidenceContribution;
      maxWeightedConfidence += CONFIDENCE_WEIGHTS[category as keyof typeof CONFIDENCE_WEIGHTS];
    }
  }

  // Process skills
  if (answers.skills && typeof answers.skills === 'object') {
    const skillWeights: number[] = [];
    const skillCategories = ['serving', 'dinking', 'volleys', 'positioning'];
    
    for (const skill of skillCategories) {
      if (answers.skills[skill]) {
        const weight = getSkillWeight(skill, answers.skills[skill]);
        skillWeights.push(weight);
      }
    }

    if (skillWeights.length > 0) {
      const avgSkillWeight = skillWeights.reduce((a, b) => a + b, 0) / skillWeights.length;
      ratingAdjustment += avgSkillWeight * SKILL_RANGE;
      
      const confidenceContribution = Math.abs(avgSkillWeight) * CONFIDENCE_WEIGHTS.skills;
      weightedConfidenceScore += confidenceContribution;
      maxWeightedConfidence += CONFIDENCE_WEIGHTS.skills;
    }
  }

  // Calculate confidence
  const confidenceRatio = maxWeightedConfidence > 0 ? 
    Math.min(weightedConfidenceScore / maxWeightedConfidence, 1.0) : 0;

  let confidence: string;
  let rd: number;

  if (confidenceRatio < 0.4) {
    confidence = 'low';
    rd = 350;
  } else if (confidenceRatio < 0.7) {
    confidence = 'medium';
    rd = 250;
  } else {
    confidence = 'high';
    rd = 150;
  }

  // Final ratings
  const singlesRating = Math.max(1000, Math.min(8000, Math.round(BASE_RATING + ratingAdjustment)));
  const doublesAdjustment = ratingAdjustment < 0 ? 50 : 0;
  const doublesRating = Math.max(1000, Math.min(8000, Math.round(singlesRating + doublesAdjustment)));

  return {
    source: 'questionnaire',
    singles: singlesRating,
    doubles: doublesRating,
    rd,
    confidence,
    detail: {
      baseRating: BASE_RATING,
      totalAdjustment: ratingAdjustment,
      confidenceRatio
    }
  };
}

function shouldSkipQuestionnaire(answers: Record<string, any>): boolean {
  const hasDupr = answers.has_dupr;
  const duprSingles = answers.dupr_singles;
  const duprDoubles = answers.dupr_doubles;
  
  if (hasDupr && (duprSingles || duprDoubles)) {
    // Validate at least one DUPR rating is valid
    const validSingles = duprSingles && !isNaN(parseFloat(duprSingles)) && 
                        parseFloat(duprSingles) >= 2.0 && parseFloat(duprSingles) <= 8.0;
    const validDoubles = duprDoubles && !isNaN(parseFloat(duprDoubles)) && 
                        parseFloat(duprDoubles) >= 2.0 && parseFloat(duprDoubles) <= 8.0;
    
    return validSingles || validDoubles;
  }
  
  return false;
}

function convertDuprToRating(answers: Record<string, any>) {
  const duprSingles = answers.dupr_singles ? parseFloat(answers.dupr_singles) : null;
  const duprDoubles = answers.dupr_doubles ? parseFloat(answers.dupr_doubles) : null;
  const singlesReliability = answers.dupr_singles_reliability ? parseInt(answers.dupr_singles_reliability) : null;
  const doublesReliability = answers.dupr_doubles_reliability ? parseInt(answers.dupr_doubles_reliability) : null;

  function duprToRating(dupr: number): number {
    if (dupr <= 3.0) {
      return Math.round(1000 + (dupr - 2.0) * 900);
    } else if (dupr <= 4.0) {
      return Math.round(1900 + (dupr - 3.0) * 1000);
    } else if (dupr <= 5.0) {
      return Math.round(2900 + (dupr - 4.0) * 1000);
    } else if (dupr <= 6.0) {
      return Math.round(3900 + (dupr - 5.0) * 800);
    } else {
      return Math.round(4700 + (dupr - 6.0) * 650);
    }
  }

  let singlesRating = duprSingles ? duprToRating(duprSingles) : null;
  let doublesRating = duprDoubles ? duprToRating(duprDoubles) : null;
  let confidence = 'high';
  let rd = 110;

  // Handle missing ratings with estimation
  if (singlesRating && !doublesRating) {
    // Estimate doubles from singles (usually lower)
    const offset = duprSingles! <= 3.5 ? 0.1 : duprSingles! <= 4.5 ? 0.2 : 0.15;
    const estimatedDuprDoubles = Math.max(2.0, duprSingles! - offset);
    doublesRating = duprToRating(estimatedDuprDoubles);
    confidence = 'medium';
    rd = 130;
  } else if (doublesRating && !singlesRating) {
    // Estimate singles from doubles (usually higher)
    const offset = duprDoubles! <= 3.5 ? 0.15 : duprDoubles! <= 4.5 ? 0.25 : 0.15;
    const estimatedDuprSingles = Math.min(8.0, duprDoubles! + offset);
    singlesRating = duprToRating(estimatedDuprSingles);
    confidence = 'medium-high';
    rd = 110;
  }

  // Adjust RD based on reliability scores
  if (doublesReliability !== null) {
    if (doublesReliability >= 85) rd = Math.round(rd * 0.6);
    else if (doublesReliability >= 70) rd = Math.round(rd * 0.8);
    else if (doublesReliability >= 50) rd = Math.round(rd * 1.0);
    else if (doublesReliability >= 30) rd = Math.round(rd * 1.4);
    else rd = Math.round(rd * 1.8);
  }

  return {
    source: 'dupr_conversion',
    singles: singlesRating || BASE_RATING,
    doubles: doublesRating || BASE_RATING,
    rd: Math.min(350, rd),
    confidence,
    detail: {
      originalDuprSingles: duprSingles,
      originalDuprDoubles: duprDoubles,
      singlesReliability,
      doublesReliability,
      estimationUsed: !duprSingles || !duprDoubles
    }
  };
}

function getWeightForAnswer(category: string, answer: string): number {
  const weights: Record<string, Record<string, number>> = {
    experience: {
      "Less than 1 month": -0.7,
      "1-3 months": -0.4,
      "3-6 months": -0.1,
      "6-12 months": 0.2,
      "1-2 years": 0.5,
      "More than 2 years": 1.0
    },
    sports_background: {
      "No experience with racquet sports": -0.8,
      "Casual/recreational player of other racquet sports": -0.3,
      "Intermediate level in tennis, badminton, or table tennis": 0.4,
      "Advanced/competitive player in other racquet sports": 0.9,
      "Professional athlete in racquet sports": 1.0
    },
    frequency: {
      "Less than once a week": -0.6,
      "1-2 times per week": -0.2,
      "3-4 times per week": 0.3,
      "5+ times per week": 0.8
    },
    competitive_level: {
      "Recreational only": -0.6,
      "Social/Club matches": -0.2,
      "Local competitive events": 0.3,
      "Regional/National competitive events": 0.8
    },
    self_rating: {
      "Beginner: Just starting, learning the basic rules and strokes.": -0.8,
      "Improver: Can sustain short rallies but lacks consistency and tactical knowledge.": -0.4,
      "Intermediate: Can play consistently, understands basic tactics, and uses a variety of shots.": 0.0,
      "Advanced: Has a strong command of all major shots and a deep understanding of strategy.": 0.6,
      "Expert/Competitive: Plays at a high level in competitive tournaments.": 1.0
    },
    tournament: {
      "Never": -0.6,
      "Local tournaments": -0.1,
      "Regional tournaments": 0.4,
      "National/international tournaments": 0.9
    }
  };

  return weights[category]?.[answer] || 0;
}

function getSkillWeight(skill: string, answer: string): number {
  const skillWeights: Record<string, number> = {
    "Beginner (learning basic serves)": -0.7,
    "Beginner (learning to dink)": -0.7,
    "Beginner (learning basic volleys)": -0.7,
    "Beginner (learning basic positioning)": -0.7,
    "Developing (consistent basic serves)": -0.2,
    "Developing (can sustain short rallies)": -0.2,
    "Developing (can sustain volley exchanges)": -0.2,
    "Developing (understand basic strategy)": -0.2,
    "Intermediate (can place serves)": 0.3,
    "Intermediate (good control and placement)": 0.3,
    "Intermediate (good reflexes and placement)": 0.3,
    "Intermediate (good positioning and awareness)": 0.3,
    "Advanced (variety of controlled serves)": 0.8,
    "Advanced (excellent control and strategy)": 0.8,
    "Advanced (excellent reflexes and strategy)": 0.8,
    "Advanced (excellent strategy and adaptability)": 0.8
  };

  return skillWeights[answer] || 0;
}

const BASE_RATING = 1500;
  