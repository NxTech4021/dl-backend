// src/services/scoring/tennis.ts
export function scoreTennis(answers: Record<string, any>) {
  const BASE_RATING = 1500;
  
  // Rating adjustment ranges
  const EXPERIENCE_RANGE = 400;
  const COACHING_RANGE = 300;
  const FREQUENCY_RANGE = 200;
  const SKILL_RANGE = 350;
  const COMPETITIVE_RANGE = 250;
  const TOURNAMENT_RANGE = 200;

  // Confidence weights
  const CONFIDENCE_WEIGHTS = {
    experience: 1.8,
    skills: 2.0,
    self_rating: 1.5,
    competitive_level: 1.4,
    coaching_background: 1.3,
    frequency: 1.1,
    tournament: 1.2
  };

  let ratingAdjustment = 0;
  let weightedConfidenceScore = 0;
  let maxWeightedConfidence = 0;

  // Process each response
  const categories = ['experience', 'frequency', 'competitive_level', 'coaching_background', 'tournament', 'self_rating'];
  
  for (const category of categories) {
    if (answers[category]) {
      const weight = getWeightForAnswer(category, answers[category]);
      
      if (category === 'experience') {
        ratingAdjustment += weight * EXPERIENCE_RANGE;
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

  // Process skills
  if (answers.skills && typeof answers.skills === 'object') {
    const skillWeights: number[] = [];
    const skillCategories = ['serving', 'forehand', 'backhand', 'net_play', 'movement', 'mental_game'];
    
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

  // Final rating
  const finalRating = Math.max(800, Math.min(8000, Math.round(BASE_RATING + ratingAdjustment)));

  return {
    source: 'questionnaire',
    singles: finalRating,
    doubles: finalRating, // Same for tennis initially
    singles_rating: finalRating,
    doubles_rating: finalRating,
    rd,
    confidence,
    detail: {
      baseRating: BASE_RATING,
      totalAdjustment: ratingAdjustment,
      confidenceRatio
    }
  };
}

function getWeightForAnswer(category: string, answer: string): number {
  const weights: Record<string, Record<string, number>> = {
    experience: {
      "Less than 6 months": -0.8,
      "6 months - 1 year": -0.5,
      "1-2 years": -0.1,
      "2-5 years": 0.4,
      "More than 5 years": 1.0
    },
    frequency: {
      "Rarely (less than once a month)": -0.6,
      "Monthly (1-2 times per month)": -0.2,
      "Weekly (1-2 times per week)": 0.3,
      "Regular (3-4 times per week)": 0.7,
      "Daily/Intensive (5+ times per week)": 1.0
    },
    competitive_level: {
      "Recreational/social tennis with friends": -0.5,
      "Social/friendly matches": -0.1,
      "Local/small tournaments": 0.4,
      "Regional/state tournaments": 0.8,
      "National tournaments": 1.0
    },
    coaching_background: {
      "Self-taught/no formal instruction": -0.7,
      "Some coaching experience (group or private)": -0.3,
      "Regular coaching in the past or ongoing group lessons": 0.2,
      "Extensive private coaching experience": 0.6,
      "Professional/academy training background": 1.0
    },
    tournament: {
      "Never played tournaments": -0.6,
      "Club level tournaments": -0.1,
      "Regional tournaments": 0.3,
      "State level tournaments": 0.7,
      "National tournaments": 1.0
    },
    self_rating: {
      "1.0-2.0 (Beginner)": -0.8,
      "2.0-3.0 (Improver)": -0.4,
      "3.0-4.0 (Intermediate)": 0.0,
      "4.0-5.0 (Advanced)": 0.6,
      "5.0-6.0 (Professional)": 1.0
    }
  };

  return weights[category]?.[answer] || 0;
}

function getSkillWeight(skill: string, answer: string): number {
  const skillWeights: Record<string, number> = {
    "Beginner (learning basic serve motion)": -0.8,
    "Beginner (learning basic strokes)": -0.8,
    "Beginner (rarely come to net, basic volley technique)": -0.8,
    "Beginner (learning basic court positioning)": -0.8,
    "Beginner (focus mainly on hitting the ball back)": -0.8,
    "Developing (consistent first serve, learning second serve)": -0.3,
    "Developing (can rally consistently from baseline)": -0.3,
    "Developing (comfortable with basic volleys)": -0.3,
    "Developing (understand basic court coverage)": -0.3,
    "Developing (basic understanding of tactics)": -0.3,
    "Intermediate (good first serve placement, reliable second serve)": 0.3,
    "Intermediate (good power and placement from baseline)": 0.3,
    "Intermediate (good net coverage and volley placement)": 0.3,
    "Intermediate (good court movement and recovery)": 0.3,
    "Intermediate (good match strategy and point construction)": 0.3,
    "Advanced (variety of serves with good placement and power)": 0.8,
    "Advanced (excellent control, variety, and tactical awareness)": 0.8,
    "Advanced (excellent net game and transition play)": 0.8,
    "Advanced (excellent anticipation and court positioning)": 0.8,
    "Advanced (excellent tactical awareness and mental toughness)": 0.8
  };

  return skillWeights[answer] || 0;
}
