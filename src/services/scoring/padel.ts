// src/services/scoring/padel.ts
export function scorePadel(answers: Record<string, any>) {
  const BASE_RATING = 1500;
  
  // Rating adjustment ranges
  const EXPERIENCE_RANGE = 350;
  const COACHING_RANGE = 280;
  const FREQUENCY_RANGE = 180;
  const SKILL_RANGE = 400;
  const COMPETITIVE_RANGE = 220;
  const TOURNAMENT_RANGE = 180;
  const SPORTS_BACKGROUND_RANGE = 300;

  // Confidence weights
  const CONFIDENCE_WEIGHTS = {
    experience: 1.9,
    skills: 2.2,
    self_rating: 1.6,
    competitive_level: 1.4,
    coaching_background: 1.3,
    frequency: 1.1,
    tournament: 1.2,
    sports_background: 1.0
  };

  let ratingAdjustment = 0;
  let weightedConfidenceScore = 0;
  let maxWeightedConfidence = 0;

  // Process each response
  const categories = ['experience', 'sports_background', 'frequency', 'competitive_level', 'coaching_background', 'tournament', 'self_rating'];
  
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
      } else if (category === 'coaching_background') {
        ratingAdjustment += weight * COACHING_RANGE;
      } else if (category === 'tournament') {
        ratingAdjustment += weight * TOURNAMENT_RANGE;
      } else if (category === 'self_rating') {
        ratingAdjustment += weight * SKILL_RANGE * 0.6;
      }

      const confidenceContribution = Math.abs(weight) * CONFIDENCE_WEIGHTS[category as keyof typeof CONFIDENCE_WEIGHTS];
      weightedConfidenceScore += confidenceContribution;
      maxWeightedConfidence += CONFIDENCE_WEIGHTS[category as keyof typeof CONFIDENCE_WEIGHTS];
    }
  }

  // Process skills with padel-specific weighting
  if (answers.skills && typeof answers.skills === 'object') {
    const skillWeights: number[] = [];
    const skillCategories = ['serving', 'wall_play', 'net_play', 'lob_smash', 'glass_play', 'positioning'];
    const padelSpecificSkills = ['wall_play', 'glass_play', 'positioning']; // More important for padel
    
    for (const skill of skillCategories) {
      if (answers.skills[skill]) {
        let weight = getSkillWeight(skill, answers.skills[skill]);
        
        // Give extra weight to padel-specific skills
        if (padelSpecificSkills.includes(skill)) {
          weight *= 1.2;
        }
        
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

  // Final rating - padel is doubles only
  const finalRating = Math.max(800, Math.min(8000, Math.round(BASE_RATING + ratingAdjustment)));

  return {
    source: 'questionnaire',
    singles: finalRating, // Keep for compatibility but padel is doubles-only
    doubles: finalRating,
    rd,
    confidence,
    detail: {
      baseRating: BASE_RATING,
      totalAdjustment: ratingAdjustment,
      confidenceRatio,
      note: 'Padel is exclusively doubles - singles rating provided for system compatibility'
    }
  };
}

function getWeightForAnswer(category: string, answer: string): number {
  const weights: Record<string, Record<string, number>> = {
    experience: {
      "Less than 3 months": -0.8,
      "3-6 months": -0.4,
      "6 months - 1 year": 0.0,
      "1-2 years": 0.5,
      "More than 2 years": 1.0
    },
    sports_background: {
      "No prior racket/paddle sports": -0.4,
      "Some casual play (e.g., badminton, tennis, table tennis)": 0.0,
      "Regular player in another racket/paddle sport": 0.4,
      "Competitive background in another racket/paddle sport": 0.8
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
    coaching_background: {
      "No coaching": -0.4,
      "Few lessons": -0.1,
      "Regular coaching": 0.3,
      "High-performance/academy coaching": 0.8
    },
    tournament: {
      "Never": -0.6,
      "Local tournaments": -0.1,
      "Regional tournaments": 0.4,
      "National/international tournaments": 0.9
    },
    self_rating: {
      "Beginner: Just starting, learning the basic rules and strokes.": -0.8,
      "Improver: Can sustain short rallies but lacks consistency and tactical knowledge.": -0.4,
      "Intermediate: Can play consistently, understands basic tactics, and uses a variety of shots.": 0.0,
      "Advanced: Has a strong command of all major shots and a deep understanding of strategy.": 0.6,
      "Expert/Competitive: Plays at a high level in competitive tournaments.": 1.0
    }
  };

  return weights[category]?.[answer] || 0;
}

function getSkillWeight(skill: string, answer: string): number {
  const skillWeights: Record<string, number> = {
    // Serving (exact match from Python)
    "Beginner (learning basic underhand serve)": -0.8,
    "Developing (consistent serve to service box)": -0.3,
    "Intermediate (good placement and variety)": 0.3,
    "Advanced (excellent placement, spin, and tactical serving)": 0.8,
    
    // Wall Play (exact match from Python)
    "Beginner (struggle with balls off the wall)": -0.8,
    "Developing (can play basic shots off back wall)": -0.3,
    "Intermediate (comfortable using walls tactically)": 0.3,
    "Advanced (excellent wall play and court geometry understanding)": 0.8,
    
    // Net Play (exact match from Python)
    "Beginner (basic volleys, rarely at net)": -0.8,
    "Developing (comfortable with simple volleys)": -0.3,
    "Intermediate (good net coverage and volley placement)": 0.3,
    "Advanced (dominant net game with excellent positioning)": 0.8,
    
    // Lob and Smash (exact match from Python)
    "Beginner (learning basic lobs and overheads)": -0.8,
    "Developing (can execute basic lobs and smashes)": -0.3,
    "Intermediate (good lob placement and overhead power)": 0.3,
    "Advanced (excellent lob variety and smash winners)": 0.8,
    
    // Glass Play (exact match from Python)
    "Beginner (struggle with balls off glass walls)": -0.8,
    "Developing (can return balls off glass walls)": -0.3,
    "Intermediate (use glass walls tactically)": 0.3,
    "Advanced (master glass wall angles and spins)": 0.8,
    
    // Positioning (exact match from Python)
    "Beginner (learning basic court positions, focused on hitting the ball)": -0.8,
    "Developing (understand basic partner positioning)": -0.3,
    "Intermediate (good court coverage with partner)": 0.3,
    "Advanced (excellent tactical positioning and anticipation)": 0.8
  };

  return skillWeights[answer] || 0;
}
