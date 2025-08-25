// Comprehensive test suite to verify questionnaire scoring matches Python reference files exactly
import { scorePickleball, scoreTennis, scorePadel } from '../src/services/scoring';

describe('Questionnaire Scoring Verification Against Python Reference', () => {
  
  // Test Tennis questionnaire using exact example from Python file
  describe('Tennis Scoring', () => {
    test('Beginner Tennis Player - Should match Python calculation', () => {
      const beginnerTennisAnswers = {
        "experience": "Less than 6 months",
        "frequency": "Monthly (1-2 times per month)",
        "competitive_level": "Recreational/social tennis with friends",
        "coaching_background": "Self-taught/no formal instruction",
        "tournament": "Never played tournaments",
        "skills": {
          "serving": "Beginner (learning basic serve motion)",
          "forehand": "Developing (can rally consistently from baseline)",
          "backhand": "Beginner (learning basic strokes)",
          "net_play": "Beginner (rarely come to net, basic volley technique)",
          "movement": "Beginner (learning basic court positioning)",
          "mental_game": "Beginner (focus mainly on hitting the ball back)"
        },
        "self_rating": "1.0-2.0 (Beginner)"
      };

      const result = scoreTennis(beginnerTennisAnswers);
      
      // Expected from Python: around 975-1025 rating for beginner
      expect(result.singles).toBeGreaterThan(950);
      expect(result.singles).toBeLessThan(1100);
      expect(result.confidence).toBe('low');
      expect(result.source).toBe('questionnaire');
    });

    test('Intermediate Tennis Player - Should match Python calculation', () => {
      const intermediateTennisAnswers = {
        "experience": "2-5 years",
        "frequency": "Weekly (1-2 times per week)",
        "competitive_level": "Local/small tournaments",
        "coaching_background": "Regular coaching in the past or ongoing group lessons",
        "tournament": "Club level tournaments",
        "skills": {
          "serving": "Intermediate (good first serve placement, reliable second serve)",
          "forehand": "Intermediate (good power and placement from baseline)",
          "backhand": "Developing (can rally consistently from baseline)",
          "net_play": "Developing (comfortable with basic volleys)",
          "movement": "Intermediate (good court movement and recovery)",
          "mental_game": "Intermediate (good match strategy and point construction)"
        },
        "self_rating": "3.0-4.0 (Intermediate)"
      };

      const result = scoreTennis(intermediateTennisAnswers);
      
      // Expected from Python: around 1650-1750 rating for intermediate
      expect(result.singles).toBeGreaterThan(1600);
      expect(result.singles).toBeLessThan(1800);
      expect(result.confidence).toBe('medium');
    });

    test('Advanced Tennis Player - Should match Python calculation', () => {
      const advancedTennisAnswers = {
        "experience": "More than 5 years",
        "frequency": "Regular (3-4 times per week)",
        "competitive_level": "Regional/state tournaments",
        "coaching_background": "Extensive private coaching experience",
        "tournament": "State level tournaments",
        "skills": {
          "serving": "Advanced (variety of serves with good placement and power)",
          "forehand": "Advanced (excellent control, variety, and tactical awareness)",
          "backhand": "Advanced (excellent control, variety, and tactical awareness)",
          "net_play": "Advanced (excellent net game and transition play)",
          "movement": "Advanced (excellent anticipation and court positioning)",
          "mental_game": "Advanced (excellent tactical awareness and mental toughness)"
        },
        "self_rating": "4.0-5.0 (Advanced)"
      };

      const result = scoreTennis(advancedTennisAnswers);
      
      // Expected from Python: around 2200-2400 rating for advanced
      expect(result.singles).toBeGreaterThan(2100);
      expect(result.singles).toBeLessThan(2500);
      expect(result.confidence).toBe('high');
    });
  });

  // Test Padel questionnaire using exact example from Python file
  describe('Padel Scoring', () => {
    test('Intermediate Padel Player - Should match Python calculation', () => {
      const intermediatePadelAnswers = {
        "experience": "1-2 years",
        "sports_background": "Intermediate level in tennis or squash",
        "frequency": "Weekly (1-2 times per week)",
        "competitive_level": "Club-level matches",
        "coaching_background": "Regular group lessons",
        "tournament": "Club level beginner/novice tournaments",
        "skills": {
          "serving": "Intermediate (good placement and variety)",
          "wall_play": "Developing (can play basic shots off back wall)",
          "net_play": "Intermediate (good net coverage and volley placement)",
          "lob_smash": "Intermediate (good lob placement and overhead power)",
          "glass_play": "Developing (can return balls off glass walls)",
          "positioning": "Intermediate (good court coverage with partner)"
        },
        "self_rating": "Intermediate: Can play consistently, understands basic tactics, and uses a variety of shots."
      };

      const result = scorePadel(intermediatePadelAnswers);
      
      // Expected from Python: around 1650-1750 rating
      expect(result.singles).toBeGreaterThan(1600);
      expect(result.singles).toBeLessThan(1800);
      expect(result.doubles).toBe(result.singles); // Padel is doubles-only
      expect(result.confidence).toBe('medium');
    });
  });

  // Test Pickleball questionnaire including DUPR conversion
  describe('Pickleball Scoring', () => {
    test('DUPR Conversion - Typical Pattern (Singles > Doubles)', () => {
      const duprAnswers = {
        "has_dupr": true,
        "dupr_singles": "4.2",
        "dupr_doubles": "3.9", 
        "dupr_singles_reliability": "35",
        "dupr_doubles_reliability": "78"
      };

      const result = scorePickleball(duprAnswers);
      
      // Expected DUPR 4.2 singles = ~3180 rating, 3.9 doubles = ~3060 rating
      expect(result.singles).toBeGreaterThan(3150);
      expect(result.singles).toBeLessThan(3220);
      expect(result.doubles).toBeGreaterThan(3030);
      expect(result.doubles).toBeLessThan(3090);
      expect(result.source).toBe('dupr_conversion');
      expect(result.confidence).toBe('high');
    });

    test('Doubles-Only DUPR Player', () => {
      const doublesOnlyAnswers = {
        "has_dupr": true,
        "dupr_singles": "",
        "dupr_doubles": "4.1",
        "dupr_doubles_reliability": "85"
      };

      const result = scorePickleball(doublesOnlyAnswers);
      
      // Expected: Doubles from DUPR 4.1 = ~3140, Singles estimated higher
      expect(result.doubles).toBeGreaterThan(3110);
      expect(result.doubles).toBeLessThan(3170);
      expect(result.singles).toBeGreaterThan(result.doubles); // Singles estimated higher
      expect(result.source).toBe('dupr_conversion');
      expect(result.confidence).toBe('medium-high');
    });

    test('Questionnaire-Based Pickleball Player', () => {
      const questionnaireAnswers = {
        "has_dupr": false,
        "experience": "1-2 years",
        "sports_background": "Advanced/competitive player in other racquet sports",
        "frequency": "3-4 times per week", 
        "competitive_level": "Local competitive events",
        "skills": {
          "serving": "Intermediate (can place serves)",
          "dinking": "Advanced (excellent control and strategy)",
          "volleys": "Intermediate (good reflexes and placement)",
          "positioning": "Intermediate (good positioning and awareness)"
        },
        "self_rating": "Intermediate: Can play consistently, understands basic tactics, and uses a variety of shots.",
        "tournament": "Local tournaments"
      };

      const result = scorePickleball(questionnaireAnswers);
      
      // Expected: Strong intermediate player around 1700-1900
      expect(result.singles).toBeGreaterThan(1650);
      expect(result.singles).toBeLessThan(1950);
      expect(result.source).toBe('questionnaire');
    });
  });

  // Edge cases and error handling
  describe('Edge Cases', () => {
    test('Empty responses should return default rating', () => {
      const emptyTennis = scoreTennis({});
      const emptyPadel = scorePadel({});
      const emptyPickleball = scorePickleball({});

      expect(emptyTennis.singles).toBe(1500); // Base rating
      expect(emptyPadel.singles).toBe(1500);
      expect(emptyPickleball.singles).toBe(1500);
    });

    test('Invalid DUPR values should fallback gracefully', () => {
      const invalidDuprAnswers = {
        "has_dupr": true,
        "dupr_singles": "invalid",
        "dupr_doubles": "99.9", // Too high
        "dupr_singles_reliability": "-50" // Invalid
      };

      const result = scorePickleball(invalidDuprAnswers);
      
      // Should not crash and should fallback to questionnaire mode
      expect(result).toBeDefined();
      expect(result.singles).toBeDefined();
    });
  });

  // Confidence level verification
  describe('Confidence Levels', () => {
    test('High confidence requires comprehensive answers', () => {
      const comprehensiveAnswers = {
        "experience": "More than 5 years",
        "frequency": "Regular (3-4 times per week)",
        "competitive_level": "Regional/state tournaments",
        "coaching_background": "Professional/academy training background",
        "tournament": "National tournaments",
        "skills": {
          "serving": "Advanced (variety of serves with good placement and power)",
          "forehand": "Advanced (excellent control, variety, and tactical awareness)",
          "backhand": "Advanced (excellent control, variety, and tactical awareness)",
          "net_play": "Advanced (excellent net game and transition play)",
          "movement": "Advanced (excellent anticipation and court positioning)",
          "mental_game": "Advanced (excellent tactical awareness and mental toughness)"
        },
        "self_rating": "5.0-6.0 (Professional)"
      };

      const result = scoreTennis(comprehensiveAnswers);
      expect(result.confidence).toBe('high');
    });

    test('Low confidence for minimal answers', () => {
      const minimalAnswers = {
        "experience": "Less than 6 months",
        "self_rating": "1.0-2.0 (Beginner)"
      };

      const result = scoreTennis(minimalAnswers);
      expect(result.confidence).toBe('low');
    });
  });
});