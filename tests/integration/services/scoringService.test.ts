/**
 * Scoring Service Tests
 * Tests for pickleball, tennis, and padel scoring algorithms
 */

import { scorePickleball } from '../../../src/services/scoring/pickleball';
import { scoreTennis } from '../../../src/services/scoring/tennis';
import { scorePadel } from '../../../src/services/scoring/padel';

describe('Scoring Services', () => {
  // ============================================================================
  // PICKLEBALL SCORING TESTS
  // ============================================================================
  describe('Pickleball Scoring', () => {
    describe('Questionnaire Scoring', () => {
      it('should return base rating for empty answers', () => {
        const result = scorePickleball({});

        expect(result.source).toBe('questionnaire');
        expect(result.singles).toBe(1500);
        expect(result.doubles).toBe(1500);
        expect(result.confidence).toBe('low');
        expect(result.rd).toBe(350);
      });

      it('should calculate beginner rating correctly', () => {
        const answers = {
          experience: 'Less than 3 month',
          sports_background: 'No prior experience with racquet sports',
          frequency: 'Less than once a month',
          competitive_level: 'Recreational/social games',
          self_rating: '1.0-1.5 (Beginner)',
          tournament: 'Never',
        };

        const result = scorePickleball(answers);

        expect(result.source).toBe('questionnaire');
        expect(result.singles).toBeLessThan(1500);
        expect(result.singles).toBeGreaterThanOrEqual(1000);
      });

      it('should calculate advanced rating correctly', () => {
        const answers = {
          experience: 'More than 2 years',
          sports_background: 'Advanced/competitive player in other racquet sports',
          frequency: '4+ times a week',
          competitive_level: 'High-level competitive tournaments',
          self_rating: '5.0+ (Expert/Pro)',
          tournament: 'Professional tournaments',
        };

        const result = scorePickleball(answers);

        expect(result.source).toBe('questionnaire');
        expect(result.singles).toBeGreaterThan(1500);
        expect(result.confidence).toBe('high');
        expect(result.rd).toBe(150);
      });

      it('should include skill assessments in calculation', () => {
        const baseAnswers = {
          experience: '1-2 years',
          frequency: 'Once a week',
        };

        const resultWithoutSkills = scorePickleball(baseAnswers);

        const answersWithSkills = {
          ...baseAnswers,
          skills: {
            serve: 'Advanced (variety of controlled serves)',
            dinking: 'Advanced (excellent control and strategy)',
            volleys: 'Advanced (excellent reflexes and strategy)',
            court_positioning: 'Advanced (excellent strategy and adaptability)',
          },
        };

        const resultWithSkills = scorePickleball(answersWithSkills);

        expect(resultWithSkills.singles).toBeGreaterThan(resultWithoutSkills.singles);
      });

      it('should clamp rating within valid range', () => {
        const beginnerAnswers = {
          experience: 'Less than 3 month',
          sports_background: 'No prior experience with racquet sports',
          frequency: 'Less than once a month',
          competitive_level: 'Recreational/social games',
          self_rating: '1.0-1.5 (Beginner)',
          tournament: 'Never',
          skills: {
            serve: 'Beginner (learning basic serves)',
            dinking: 'Beginner (learning to dink)',
            volleys: 'Beginner (learning basic volleys)',
            court_positioning: 'Beginner (learning basic positioning)',
          },
        };

        const result = scorePickleball(beginnerAnswers);

        expect(result.singles).toBeGreaterThanOrEqual(1000);
        expect(result.singles).toBeLessThanOrEqual(8000);
      });
    });

    describe('DUPR Conversion', () => {
      it('should use DUPR rating when available and valid', () => {
        const answers = {
          has_dupr: 'Yes',
          dupr_singles: 4.5,
          dupr_doubles: 4.2,
          dupr_singles_reliability: 60,
          dupr_doubles_reliability: 80,
        };

        const result = scorePickleball(answers);

        expect(result.source).toBe('dupr_conversion');
        expect(result.singles).toBeGreaterThan(2000);
        expect(result.doubles).toBeGreaterThan(2000);
      });

      it('should fall back to questionnaire when DUPR is missing', () => {
        const answers = {
          has_dupr: 'No',
          experience: 'More than 2 years',
        };

        const result = scorePickleball(answers);

        expect(result.source).toBe('questionnaire');
      });

      it('should convert DUPR singles only', () => {
        const answers = {
          has_dupr: 'Yes',
          dupr_singles: 4.0,
          dupr_singles_reliability: 50,
        };

        const result = scorePickleball(answers);

        expect(result.source).toBe('dupr_conversion');
        expect(result.confidence).toBe('medium');
      });

      it('should fall back to questionnaire for invalid DUPR ratings below minimum', () => {
        const answers = {
          has_dupr: 'Yes',
          dupr_singles: 1.0,
        };

        // Invalid DUPR (below 2.0) causes fallback to questionnaire scoring
        const result = scorePickleball(answers);
        expect(result.source).toBe('questionnaire');
      });

      it('should fall back to questionnaire for DUPR above maximum', () => {
        const answers = {
          has_dupr: 'Yes',
          dupr_singles: 9.0,
        };

        // Invalid DUPR (above 8.0) causes fallback to questionnaire scoring
        const result = scorePickleball(answers);
        expect(result.source).toBe('questionnaire');
      });

      it('should convert DUPR values to DMR correctly', () => {
        const answers = {
          has_dupr: 'Yes',
          dupr_singles: 4.0,
          dupr_doubles: 4.0,
        };

        const result = scorePickleball(answers);

        // 4.0 DUPR should map to around 2900 DMR
        expect(result.singles).toBeGreaterThanOrEqual(2500);
        expect(result.singles).toBeLessThanOrEqual(3500);
      });

      it('should adjust RD based on reliability', () => {
        const highReliability = {
          has_dupr: 'Yes',
          dupr_singles: 4.0,
          dupr_doubles: 4.0,
          dupr_singles_reliability: 90,
          dupr_doubles_reliability: 90,
        };

        const lowReliability = {
          has_dupr: 'Yes',
          dupr_singles: 4.0,
          dupr_doubles: 4.0,
          dupr_singles_reliability: 20,
          dupr_doubles_reliability: 20,
        };

        const highRelResult = scorePickleball(highReliability);
        const lowRelResult = scorePickleball(lowReliability);

        expect(highRelResult.rd).toBeLessThan(lowRelResult.rd);
      });
    });
  });

  // ============================================================================
  // TENNIS SCORING TESTS
  // ============================================================================
  describe('Tennis Scoring', () => {
    it('should return base rating for empty answers', () => {
      const result = scoreTennis({});

      expect(result.source).toBe('questionnaire');
      expect(result.singles).toBe(1500);
      expect(result.doubles).toBe(1500);
      expect(result.confidence).toBe('low');
      expect(result.rd).toBe(350);
    });

    it('should calculate beginner rating correctly', () => {
      const answers = {
        experience: 'Less than 6 months',
        frequency: 'Rarely (less than once a month)',
        competitive_level: 'Recreational/social play with friends',
        coaching_background: 'Self-taught/no formal instruction',
        tournament: 'Never played tournaments',
        self_rating: '1.0-2.0 (Beginner)',
      };

      const result = scoreTennis(answers);

      expect(result.source).toBe('questionnaire');
      expect(result.singles).toBeLessThan(1500);
      expect(result.singles).toBeGreaterThanOrEqual(800);
    });

    it('should calculate advanced rating correctly', () => {
      const answers = {
        experience: 'More than 5 years',
        frequency: 'Daily (5+ times per week)',
        competitive_level: 'National tournaments',
        coaching_background: 'Professional/academy training',
        tournament: 'National tournaments',
        self_rating: '5.0-6.0 (Professional)',
      };

      const result = scoreTennis(answers);

      expect(result.source).toBe('questionnaire');
      expect(result.singles).toBeGreaterThan(1500);
      expect(result.confidence).toBe('high');
      expect(result.rd).toBe(150);
    });

    it('should include skill assessments in calculation', () => {
      const baseAnswers = {
        experience: '2-5 years',
        frequency: 'Weekly (1-2 times per week)',
      };

      const resultWithoutSkills = scoreTennis(baseAnswers);

      const answersWithSkills = {
        ...baseAnswers,
        skills: {
          serving: 'Advanced (variety with strong placement and power)',
          forehand: 'Advanced (excellent control, variety, and tactical awareness)',
          backhand: 'Advanced (excellent control, variety, and tactical awareness)',
          net_play: 'Advanced (excellent net game and transition play)',
          movement: 'Advanced (excellent anticipation and court positioning)',
          mental_game: 'Advanced (excellent tactical awareness and mental toughness)',
        },
      };

      const resultWithSkills = scoreTennis(answersWithSkills);

      expect(resultWithSkills.singles).toBeGreaterThan(resultWithoutSkills.singles);
    });

    it('should set singles and doubles ratings equal', () => {
      const answers = {
        experience: '2-5 years',
        frequency: 'Regular (3-4 times per week)',
      };

      const result = scoreTennis(answers);

      expect(result.singles).toBe(result.doubles);
    });
  });

  // ============================================================================
  // PADEL SCORING TESTS
  // ============================================================================
  describe('Padel Scoring', () => {
    it('should return base rating for empty answers', () => {
      const result = scorePadel({});

      expect(result.source).toBe('questionnaire');
      expect(result.singles).toBe(1500);
      expect(result.doubles).toBe(1500);
      expect(result.confidence).toBe('low');
      expect(result.rd).toBe(350);
    });

    it('should calculate beginner rating correctly', () => {
      const answers = {
        experience: 'Less than 3 months',
        sports_background: 'No experience with racquet sports',
        frequency: 'Rarely (less than once a month)',
        competitive_level: 'Social/recreational games only',
        coaching_background: 'Self-taught/no formal instruction',
        tournament: 'Never played tournaments',
        self_rating: 'Beginner: Just starting, learning the basic rules and strokes.',
      };

      const result = scorePadel(answers);

      expect(result.source).toBe('questionnaire');
      expect(result.singles).toBeLessThan(1500);
      expect(result.singles).toBeGreaterThanOrEqual(800);
    });

    it('should calculate advanced rating correctly', () => {
      const answers = {
        experience: 'More than 2 years',
        sports_background: 'Professional athlete in racquet sports',
        frequency: 'Daily (5+ times per week)',
        competitive_level: 'Professional tournaments',
        coaching_background: 'Professional/academy training',
        tournament: 'Intermediate/Advanced tournaments',
        self_rating: 'Expert/Competitive: Plays at a high level in competitive tournaments.',
      };

      const result = scorePadel(answers);

      expect(result.source).toBe('questionnaire');
      expect(result.singles).toBeGreaterThan(1500);
      expect(result.confidence).toBe('high');
      expect(result.rd).toBe(150);
    });

    it('should include padel-specific skills in calculation', () => {
      const baseAnswers = {
        experience: '1-2 years',
        frequency: 'Weekly (1-2 times per week)',
      };

      const resultWithoutSkills = scorePadel(baseAnswers);

      const answersWithSkills = {
        ...baseAnswers,
        skills: {
          wall_play: 'Advanced (excellent wall play and court geometry understanding)',
          glass_play: 'Advanced (master glass wall angles and spins)',
          positioning: 'Advanced (excellent tactical positioning and anticipation)',
        },
      };

      const resultWithSkills = scorePadel(answersWithSkills);

      expect(resultWithSkills.singles).toBeGreaterThan(resultWithoutSkills.singles);
    });

    it('should include note about padel being doubles only', () => {
      const answers = {
        experience: '1-2 years',
      };

      const result = scorePadel(answers);

      expect(result.detail.note).toBe('Padel is exclusively doubles - singles rating provided for system compatibility');
    });

    it('should give bonus for tennis/squash background', () => {
      const noBackground = {
        experience: '6 months - 1 year',
        sports_background: 'No experience with racquet sports',
      };

      const tennisBackground = {
        experience: '6 months - 1 year',
        sports_background: 'Intermediate level in tennis or squash',
      };

      const noBackgroundResult = scorePadel(noBackground);
      const tennisBackgroundResult = scorePadel(tennisBackground);

      expect(tennisBackgroundResult.singles).toBeGreaterThan(noBackgroundResult.singles);
    });
  });

  // ============================================================================
  // CROSS-SPORT COMPARISON TESTS
  // ============================================================================
  describe('Cross-Sport Comparisons', () => {
    it('should produce similar base ratings across sports', () => {
      const pickleballResult = scorePickleball({});
      const tennisResult = scoreTennis({});
      const padelResult = scorePadel({});

      expect(pickleballResult.singles).toBe(1500);
      expect(tennisResult.singles).toBe(1500);
      expect(padelResult.singles).toBe(1500);
    });

    it('should produce consistent confidence levels for empty answers', () => {
      const pickleballResult = scorePickleball({});
      const tennisResult = scoreTennis({});
      const padelResult = scorePadel({});

      expect(pickleballResult.confidence).toBe('low');
      expect(tennisResult.confidence).toBe('low');
      expect(padelResult.confidence).toBe('low');
    });

    it('should produce consistent RD for low confidence', () => {
      const pickleballResult = scorePickleball({});
      const tennisResult = scoreTennis({});
      const padelResult = scorePadel({});

      expect(pickleballResult.rd).toBe(350);
      expect(tennisResult.rd).toBe(350);
      expect(padelResult.rd).toBe(350);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================
  describe('Edge Cases', () => {
    it('should handle unknown answer values gracefully', () => {
      const pickleballResult = scorePickleball({ experience: 'Unknown value' });
      const tennisResult = scoreTennis({ experience: 'Unknown value' });
      const padelResult = scorePadel({ experience: 'Unknown value' });

      expect(pickleballResult.singles).toBe(1500);
      expect(tennisResult.singles).toBe(1500);
      expect(padelResult.singles).toBe(1500);
    });

    it('should handle null values gracefully', () => {
      const result = scorePickleball({ experience: null } as any);
      expect(result.singles).toBeDefined();
    });

    it('should handle empty skills object', () => {
      const pickleballResult = scorePickleball({ skills: {} });
      const tennisResult = scoreTennis({ skills: {} });
      const padelResult = scorePadel({ skills: {} });

      expect(pickleballResult.singles).toBeDefined();
      expect(tennisResult.singles).toBeDefined();
      expect(padelResult.singles).toBeDefined();
    });
  });
});
