// Updated scoring logic aligned with pickleball_questionnaire_final.py

type QuestionnaireAnswers = Record<string, any>;

const BASE_RATING = 1500;
const EXPERIENCE_RANGE = 300;
const SPORTS_BACKGROUND_RANGE = 280;
const FREQUENCY_RANGE = 150;
const SKILL_RANGE = 320;
const COMPETITIVE_RANGE = 200;

const HIGH_CONFIDENCE_RD = 150;
const MEDIUM_CONFIDENCE_RD = 250;
const LOW_CONFIDENCE_RD = 350;

const CONFIDENCE_WEIGHTS = {
  experience: 2.0,
  skills: 1.8,
  self_rating: 1.5,
  competitive_level: 1.3,
  sports_background: 1.2,
  frequency: 1.0,
  tournament: 1.0,
} as const;

const RELIABILITY_ASSUMPTIONS = {
  singles_default: 25,
  doubles_default: 45,
  singles_penalty: 1.3,
  doubles_bonus: 0.9,
};

const CATEGORY_WEIGHTS: Record<string, Record<string, number>> = {
  experience: {
    "Less than 3 months": -0.7,
    "3-6 months": -0.4,
    "6-12 months": 0.2,
    "1-2 years": 0.5,
    "More than 2 years": 1.0,
  },
  sports_background: {
    "No prior experience with racquet sports": -0.8,
    "Casual/recreational player of other racquet sports": -0.3,
    "Intermediate level in tennis or table tennis": 0.4,
    "Advanced/competitive player in other racquet sports": 0.9,
    "Professional or ex-professional athlete in racquet sports": 1.0,
  },
  frequency: {
    "Less than once a month": -0.4,
    "1-2 times a month": 0.0,
    "Once a week": 0.3,
    "2-3 times a week": 0.7,
    "4+ times a week": 1.0,
  },
  competitive_level: {
    "Recreational/social games": -0.4,
    "Club/DUPR match play": 0.2,
    "Novice/Intermediate Competitive tournaments": 0.7,
    "High-level competitive tournaments": 1.0,
  },
  self_rating: {
    "1.0-1.5 (Beginner)": -0.8,
    "2.0-2.5 (Lower Intermediate)": -0.4,
    "3.0-3.5 (Intermediate)": 0.0,
    "4.0-4.5 (Advanced)": 0.5,
    "5.0+ (Expert/Pro)": 1.0,
  },
  tournament: {
    "Never": -0.5,
    "Recreational/social tournaments": 0.0,
    "Competitive tournaments": 0.5,
    "Professional tournaments": 1.0,
  },
};

const SKILL_WEIGHTS: Record<string, number> = {
  "Beginner (learning basic serves)": -0.7,
  "Developing (consistent basic serves)": -0.2,
  "Intermediate (can place serves)": 0.3,
  "Advanced (variety of controlled serves)": 0.8,

  "Beginner (learning to dink)": -0.7,
  "Developing (can sustain short rallies)": -0.2,
  "Intermediate (good control and placement)": 0.3,
  "Advanced (excellent control and strategy)": 0.8,

  "Beginner (learning basic volleys)": -0.7,
  "Developing (can sustain volley exchanges)": -0.2,
  "Intermediate (good reflexes and placement)": 0.3,
  "Advanced (excellent reflexes and strategy)": 0.8,

  "Beginner (learning basic positioning)": -0.7,
  "Developing (understand basic strategy)": -0.2,
  "Intermediate (good positioning and awareness)": 0.3,
  "Advanced (excellent strategy and adaptability)": 0.8,
};

export function scorePickleball(answers: QuestionnaireAnswers) {
  if (shouldSkipQuestionnaire(answers)) {
    const duprResult = convertDuprToDmr(answers);
    if (duprResult) {
      return convertToBackendResponse(duprResult);
    }
    // fall through to questionnaire scoring if conversion failed
  }

  return scoreQuestionnaire(answers);
}

function scoreQuestionnaire(answers: QuestionnaireAnswers) {
  let ratingAdjustment = 0;
  let weightedConfidenceScore = 0;
  let maxWeightedConfidence = 0;

  const categories = [
    "experience",
    "sports_background",
    "frequency",
    "competitive_level",
    "self_rating",
    "tournament",
  ] as const;

  for (const category of categories) {
    const answer = answers[category];
    if (typeof answer === "string") {
      const weight = CATEGORY_WEIGHTS[category]?.[answer] ?? 0;

      if (category === "experience") {
        ratingAdjustment += weight * EXPERIENCE_RANGE;
      } else if (category === "sports_background") {
        ratingAdjustment += weight * SPORTS_BACKGROUND_RANGE;
      } else if (category === "frequency") {
        ratingAdjustment += weight * FREQUENCY_RANGE;
      } else if (category === "competitive_level") {
        ratingAdjustment += weight * COMPETITIVE_RANGE;
      } else if (category === "self_rating") {
        ratingAdjustment += weight * SKILL_RANGE * 0.7;
      } else if (category === "tournament") {
        ratingAdjustment += weight * SKILL_RANGE * 0.5;
      }

      weightedConfidenceScore += Math.abs(weight) * CONFIDENCE_WEIGHTS[category];
      maxWeightedConfidence += CONFIDENCE_WEIGHTS[category];
    }
  }

  if (answers.skills && typeof answers.skills === "object") {
    const skillResponses = answers.skills as Record<string, string>;
    const skillWeights: number[] = [];

    for (const answer of Object.values(skillResponses)) {
      if (typeof answer === "string") {
        const weight = SKILL_WEIGHTS[answer] ?? 0;
        skillWeights.push(weight);
      }
    }

    if (skillWeights.length > 0) {
      const avgSkillWeight =
        skillWeights.reduce((sum, value) => sum + value, 0) / skillWeights.length;
      ratingAdjustment += avgSkillWeight * SKILL_RANGE;
      weightedConfidenceScore += Math.abs(avgSkillWeight) * CONFIDENCE_WEIGHTS.skills;
      maxWeightedConfidence += CONFIDENCE_WEIGHTS.skills;
    }
  }

  const confidenceRatio =
    maxWeightedConfidence > 0
      ? Math.min(weightedConfidenceScore / maxWeightedConfidence, 1)
      : 0;

  let confidence: "low" | "medium" | "high";
  let rd: number;

  if (confidenceRatio < 0.4) {
    confidence = "low";
    rd = LOW_CONFIDENCE_RD;
  } else if (confidenceRatio < 0.7) {
    confidence = "medium";
    rd = MEDIUM_CONFIDENCE_RD;
  } else {
    confidence = "high";
    rd = HIGH_CONFIDENCE_RD;
  }

  const singlesRating = Math.round(BASE_RATING + ratingAdjustment);
  const doublesRating = Math.round(
    singlesRating + (ratingAdjustment < 0 ? 50 : 0)
  );

  return {
    source: "questionnaire",
    singles: singlesRating,
    doubles: doublesRating,
    rd,
    confidence,
    detail: {
      baseRating: BASE_RATING,
      totalAdjustment: ratingAdjustment,
      confidenceRatio,
    },
  };
}

function shouldSkipQuestionnaire(answers: QuestionnaireAnswers): boolean {
  const hasDupr = answers.has_dupr === "Yes" || answers.has_dupr === true;
  const duprSingles = sanitizeNumberInput(answers.dupr_singles);
  const duprDoubles = sanitizeNumberInput(answers.dupr_doubles);

  if (hasDupr && (duprSingles !== null || duprDoubles !== null)) {
    const singlesValid =
      duprSingles !== null && duprSingles >= 2.0 && duprSingles <= 8.0;
    const doublesValid =
      duprDoubles !== null && duprDoubles >= 2.0 && duprDoubles <= 8.0;
    return singlesValid || doublesValid;
  }
  return false;
}

function convertDuprToDmr(answers: QuestionnaireAnswers) {
  let duprSingles = sanitizeNumberInput(answers.dupr_singles);
  let duprDoubles = sanitizeNumberInput(answers.dupr_doubles);
  let singlesReliability = sanitizeIntegerInput(answers.dupr_singles_reliability);
  let doublesReliability = sanitizeIntegerInput(answers.dupr_doubles_reliability);

  if (duprSingles !== null) {
    const validation = validateDuprInput(duprSingles, "singles");
    if (validation.error) {
      throw new Error(validation.error);
    }
    duprSingles = validation.value;
  }

  if (duprDoubles !== null) {
    const validation = validateDuprInput(duprDoubles, "doubles");
    if (validation.error) {
      throw new Error(validation.error);
    }
    duprDoubles = validation.value;
  }

  if (singlesReliability !== null) {
    const validation = validateReliabilityInput(singlesReliability);
    if (validation.error) {
      throw new Error(validation.error);
    }
    singlesReliability = validation.value;
  }

  if (doublesReliability !== null) {
    const validation = validateReliabilityInput(doublesReliability);
    if (validation.error) {
      throw new Error(validation.error);
    }
    doublesReliability = validation.value;
  }

  const patternAnalysis = detectDuprReliabilityPattern(
    duprSingles,
    duprDoubles,
    singlesReliability,
    doublesReliability
  );

  const singlesDmr = duprSingles !== null ? duprToDmr(duprSingles) : null;
  const doublesDmr = duprDoubles !== null ? duprToDmr(duprDoubles) : null;

  const hasBoth = Boolean(singlesDmr && doublesDmr);

  let singlesRating = singlesDmr;
  let doublesRating = doublesDmr;
  let confidence: "low" | "medium" | "medium-high" | "high";
  let rd: number;
  let sourceDetail = "";

  if (singlesRating && !doublesRating) {
    const estimatedDuprDoubles = skillAwareEstimation(
      duprSingles!,
      "singles",
      singlesReliability
    );
    doublesRating = duprToDmr(estimatedDuprDoubles);
    confidence = "medium";
    const baseRd = 130;
    rd = calculateReliabilityAdjustedRd(
      baseRd,
      singlesReliability,
      "singles",
      hasBoth
    );
    sourceDetail = `DUPR Singles: ${duprSingles} (reliability: ${
      singlesReliability ?? "low-assumed"
    }%), Doubles estimated: ${estimatedDuprDoubles.toFixed(2)}`;
  } else if (doublesRating && !singlesRating) {
    const estimatedDuprSingles = skillAwareEstimation(
      duprDoubles!,
      "doubles",
      doublesReliability
    );
    singlesRating = duprToDmr(estimatedDuprSingles);
    confidence = "medium-high";
    const baseRd = 110;
    rd = calculateReliabilityAdjustedRd(
      baseRd,
      doublesReliability,
      "doubles",
      hasBoth
    );
    sourceDetail = `DUPR Doubles: ${duprDoubles} (reliability: ${
      doublesReliability ?? "medium-assumed"
    }%), Singles estimated: ${estimatedDuprSingles.toFixed(2)}`;
  } else if (singlesRating && doublesRating) {
    let baseRd: number;
    let primaryReliability: number | null = null;

    if (patternAnalysis.more_reliable_format === "doubles") {
      confidence = "high";
      baseRd = 65;
      primaryReliability = doublesReliability;
    } else if (patternAnalysis.more_reliable_format === "singles") {
      confidence = "medium-high";
      baseRd = 75;
      primaryReliability = singlesReliability;
    } else {
      confidence = "high";
      baseRd = 70;
      const reliabilities = [singlesReliability, doublesReliability].filter(
        (r): r is number => r !== null && r !== undefined
      );
      if (reliabilities.length) {
        primaryReliability =
          reliabilities.reduce((sum, value) => sum + value, 0) / reliabilities.length;
      }
    }

    baseRd = Math.round(baseRd / patternAnalysis.confidence_adjustment);
    rd = calculateReliabilityAdjustedRd(baseRd, primaryReliability, "both", hasBoth);

    const notes =
      patternAnalysis.notes.length > 0
        ? patternAnalysis.notes.join(" | ")
        : "Standard pattern";
    sourceDetail = `DUPR Singles: ${duprSingles ?? "n/a"} (reliability: ${
      singlesReliability ?? "unknown"
    }%), Doubles: ${duprDoubles ?? "n/a"} (reliability: ${
      doublesReliability ?? "unknown"
    }%) | ${notes}`;
  } else {
    return null;
  }

  return {
    singles_rating: singlesRating!,
    doubles_rating: doublesRating!,
    confidence,
    rating_deviation: rd,
    source: "dupr_conversion",
    original_dupr_singles: duprSingles,
    original_dupr_doubles: duprDoubles,
    singles_reliability: singlesReliability,
    doubles_reliability: doublesReliability,
    pattern_analysis: patternAnalysis,
    adjustment_detail: {
      dupr_source: sourceDetail,
      has_both_ratings: hasBoth,
      more_reliable_format: patternAnalysis.more_reliable_format,
      confidence_adjustment: patternAnalysis.confidence_adjustment,
    },
  };
}

function convertToBackendResponse(result: ReturnType<typeof convertDuprToDmr>) {
  return {
    source: result?.source ?? "dupr_conversion",
    singles: result?.singles_rating ?? BASE_RATING,
    doubles: result?.doubles_rating ?? BASE_RATING,
    rd: result?.rating_deviation ?? MEDIUM_CONFIDENCE_RD,
    confidence: result?.confidence ?? "medium",
    detail: {
      originalDuprSingles: result?.original_dupr_singles,
      originalDuprDoubles: result?.original_dupr_doubles,
      singlesReliability: result?.singles_reliability,
      doublesReliability: result?.doubles_reliability,
      patternAnalysis: result?.pattern_analysis,
      sourceDetail: result?.adjustment_detail?.dupr_source,
    },
  };
}

function duprToDmr(dupr: number): number {
  const rating = Math.max(2.0, Math.min(8.0, dupr));
  if (rating <= 3.0) {
    return Math.round(1000 + (rating - 2.0) * 900);
  } else if (rating <= 4.0) {
    return Math.round(1900 + (rating - 3.0) * 1000);
  } else if (rating <= 5.0) {
    return Math.round(2900 + (rating - 4.0) * 1000);
  } else if (rating <= 6.0) {
    return Math.round(3900 + (rating - 5.0) * 800);
  }
  return Math.round(4700 + (rating - 6.0) * 650);
}

function sanitizeNumberInput(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function sanitizeIntegerInput(value: unknown): number | null {
  if (typeof value === "number") return Math.round(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function validateDuprInput(value: number, ratingType: "singles" | "doubles") {
  if (value < 2.0) {
    return {
      value: null,
      error: `DUPR ${ratingType} ratings start at 2.0.`,
    };
  }
  if (value > 8.0) {
    return {
      value: null,
      error: `DUPR ${ratingType} ratings rarely exceed 8.0.`,
    };
  }
  return { value, error: null };
}

function validateReliabilityInput(value: number) {
  if (value < 0) {
    return { value: null, error: "Reliability score cannot be negative" };
  }
  if (value > 100) {
    return { value: null, error: "Reliability score cannot exceed 100%" };
  }
  return { value, error: null };
}

function detectDuprReliabilityPattern(
  duprSingles: number | null,
  duprDoubles: number | null,
  singlesReliability: number | null,
  doublesReliability: number | null
) {
  const analysis = {
    more_reliable_format: null as "singles" | "doubles" | null,
    confidence_adjustment: 1.0,
    notes: [] as string[],
  };

  if (duprSingles && duprDoubles) {
    const difference = Math.abs(duprSingles - duprDoubles);
    const singlesHigher = duprSingles > duprDoubles;

    if (singlesHigher && difference > 0.15) {
      analysis.more_reliable_format = "doubles";
      analysis.notes.push("Singles higher than doubles - common pattern");
      analysis.notes.push("Doubles likely more accurate due to higher play volume");
      if (doublesReliability && doublesReliability > 50) {
        analysis.confidence_adjustment = 1.2;
        analysis.notes.push("High doubles reliability confirms pattern");
      }
      if (singlesReliability && singlesReliability < 40) {
        analysis.confidence_adjustment = 1.3;
        analysis.notes.push("Low singles reliability supports doubles as more accurate");
      }
    } else if (!singlesHigher && difference > 0.2) {
      analysis.more_reliable_format = "singles";
      analysis.notes.push("Doubles higher than singles - less common pattern");
      analysis.notes.push("May indicate specialized doubles player");
      analysis.confidence_adjustment = 0.9;
    }
  }

  return analysis;
}

function skillAwareEstimation(
  knownDupr: number,
  knownFormat: "singles" | "doubles",
  reliabilityScore: number | null = null
): number {
  if (knownFormat === "doubles") {
    const baseOffsets: Array<[number, number]> = [
      [2.5, 0.05],
      [3.5, 0.15],
      [4.5, 0.25],
      [6.0, 0.15],
      [8.0, 0.05],
    ];

    let offset = 0.15;
    for (const [threshold, off] of baseOffsets) {
      if (knownDupr <= threshold) {
        offset = off;
        break;
      }
    }

    if (reliabilityScore && reliabilityScore > 70) {
      offset *= 1.2;
    } else if (reliabilityScore && reliabilityScore < 30) {
      offset *= 0.7;
    }

    return Math.min(8.0, knownDupr + offset);
  }

  const baseOffsets: Array<[number, number]> = [
    [2.5, 0.05],
    [3.5, 0.1],
    [4.5, 0.2],
    [6.0, 0.15],
    [8.0, 0.05],
  ];

  let offset = 0.15;
  for (const [threshold, off] of baseOffsets) {
    if (knownDupr <= threshold) {
      offset = off;
      break;
    }
  }

  if (reliabilityScore && reliabilityScore < 40) {
    offset *= 1.3;
  } else if (reliabilityScore && reliabilityScore > 80) {
    offset *= 0.8;
  }

  return Math.max(2.0, knownDupr - offset);
}

function calculateReliabilityAdjustedRd(
  baseRd: number,
  reliabilityScore: number | null,
  formatType: "singles" | "doubles" | "both",
  hasBothRatings = false
) {
  let reliability = reliabilityScore;
  if (reliability === null) {
    reliability =
      formatType === "singles"
        ? RELIABILITY_ASSUMPTIONS.singles_default
        : RELIABILITY_ASSUMPTIONS.doubles_default;
  }

  let multiplier: number;
  if (reliability >= 85) {
    multiplier = 0.6;
  } else if (reliability >= 70) {
    multiplier = 0.8;
  } else if (reliability >= 50) {
    multiplier = 1.0;
  } else if (reliability >= 30) {
    multiplier = 1.4;
  } else {
    multiplier = 1.8;
  }

  if (formatType === "singles") {
    multiplier *= RELIABILITY_ASSUMPTIONS.singles_penalty;
  } else if (formatType === "doubles") {
    multiplier *= RELIABILITY_ASSUMPTIONS.doubles_bonus;
  }

  if (!hasBothRatings) {
    multiplier *= 1.1;
  }

  return Math.min(350, Math.round(baseRd * multiplier));
}
