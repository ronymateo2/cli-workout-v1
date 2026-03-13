import { calculateEpley1RM, analyzeProgression, detectRegression, generateRecommendation } from '../src/analyzer.js';

describe('analyzer module tests', () => {
  describe('calculateEpley1RM', () => {
    test('should calculate correct e1RM for single rep', () => {
      expect(calculateEpley1RM(100, 1)).toBe(100);
    });

    test('should calculate correct e1RM for multiple reps', () => {
      // e1RM = 100 * (1 + 0.0333 * 10) = 100 * 1.333 = 133.3
      const result = calculateEpley1RM(100, 10);
      expect(result).toBeCloseTo(133.3);
    });

    test('should return 0 for invalid inputs', () => {
      expect(calculateEpley1RM(0, 10)).toBe(0);
      expect(calculateEpley1RM(100, 0)).toBe(0);
      expect(calculateEpley1RM(-10, 5)).toBe(0);
    });

    test('should handle null/undefined gracefully', () => {
      expect(calculateEpley1RM(null, 10)).toBe(0);
      expect(calculateEpley1RM(100, null)).toBe(0);
      expect(calculateEpley1RM(undefined, 5)).toBe(0);
    });
  });

  describe('analyzeProgression', () => {
    test('should group sets by date and calculate metrics', () => {
      const history = [
        { date: '2024-01-01', weight: 100, reps: 5 },
        { date: '2024-01-01', weight: 100, reps: 6 },
        { date: '2024-01-08', weight: 105, reps: 5 },
      ];

      const analyzed = analyzeProgression(history as any);

      expect(analyzed.length).toBe(2);
      
      // Session 1
      expect(analyzed[0].date).toBe('2024-01-01');
      expect(analyzed[0].maxE1rm).toBeCloseTo(100 * (1 + 0.0333 * 6)); // max of 5 and 6 reps
      expect(analyzed[0].volumeLoad).toBe(100 * 5 + 100 * 6);

      // Session 2
      expect(analyzed[1].date).toBe('2024-01-08');
      expect(analyzed[1].maxE1rm).toBeCloseTo(105 * (1 + 0.0333 * 5));
      expect(analyzed[1].volumeLoad).toBe(105 * 5);
    });

    test('should return empty array for empty input', () => {
      expect(analyzeProgression([])).toEqual([]);
    });

    test('should handle null input', () => {
      expect(analyzeProgression(null)).toEqual([]);
    });

    test('should sort sessions chronologically', () => {
      const history = [
        { date: '2024-02-01', weight: 100, reps: 8 },
        { date: '2024-01-01', weight: 100, reps: 8 },
      ];
      const analyzed = analyzeProgression(history as any);
      expect(analyzed[0].date).toBe('2024-01-01');
      expect(analyzed[1].date).toBe('2024-02-01');
    });
  });

  describe('detectRegression', () => {
    test('should return no regression for a single session', () => {
      const sessions = [
        { maxE1rm: 120, volumeLoad: 3000, sets: [] }
      ];
      const result = detectRegression(sessions as any);
      expect(result.detected).toBe(false);
      expect(result.sustained).toBe(false);
    });

    test('should detect e1RM drop >= 10%', () => {
      const sessions = [
        { maxE1rm: 100, volumeLoad: 3000, sets: [] },
        { maxE1rm: 88, volumeLoad: 2900, sets: [] },  // -12% e1RM
      ];
      const result = detectRegression(sessions as any);
      expect(result.detected).toBe(true);
      expect(result.e1rmDrop).toBe(true);
      expect(result.e1rmChange).toBe(-12);
    });

    test('should detect volume drop >= 20%', () => {
      const sessions = [
        { maxE1rm: 100, volumeLoad: 3000, sets: [] },
        { maxE1rm: 98, volumeLoad: 2300, sets: [] },  // -23.3% volume
      ];
      const result = detectRegression(sessions as any);
      expect(result.detected).toBe(true);
      expect(result.volumeDrop).toBe(true);
    });

    test('should NOT detect regression for minor performance dip', () => {
      const sessions = [
        { maxE1rm: 100, volumeLoad: 3000, sets: [] },
        { maxE1rm: 95, volumeLoad: 2700, sets: [] },  // -5% e1RM, -10% volume (both under threshold)
      ];
      const result = detectRegression(sessions as any);
      expect(result.detected).toBe(false);
    });

    test('should detect sustained regression across 3+ sessions', () => {
      const sessions = [
        { maxE1rm: 120, volumeLoad: 4000, sets: [] },
        { maxE1rm: 105, volumeLoad: 3200, sets: [] },  // -12.5% e1RM drop
        { maxE1rm: 90, volumeLoad: 2500, sets: [] },   // -14.3% e1RM drop again
      ];
      const result = detectRegression(sessions as any);
      expect(result.detected).toBe(true);
      expect(result.sustained).toBe(true);
    });

    test('should NOT flag sustained if only the last session dropped', () => {
      const sessions = [
        { maxE1rm: 100, volumeLoad: 3000, sets: [] },
        { maxE1rm: 110, volumeLoad: 3500, sets: [] },  // improved
        { maxE1rm: 95, volumeLoad: 2700, sets: [] },   // dropped from 110 (-13.6%), but session 1→2 was fine
      ];
      const result = detectRegression(sessions as any);
      expect(result.detected).toBe(true);
      expect(result.sustained).toBe(false);
    });

    test('should handle improvement (no regression)', () => {
      const sessions = [
        { maxE1rm: 100, volumeLoad: 3000, sets: [] },
        { maxE1rm: 115, volumeLoad: 3600, sets: [] },
      ];
      const result = detectRegression(sessions as any);
      expect(result.detected).toBe(false);
      expect(result.e1rmChange).toBeGreaterThan(0);
      expect(result.volumeChange).toBeGreaterThan(0);
    });
  });

  describe('generateRecommendation', () => {
    test('should recommend weight increase if reps >= 12', () => {
      const analyzed = [{
        maxE1rm: 130, volumeLoad: 3600,
        sets: [{ weight: 100, reps: 12 }]
      }];
      const rec = generateRecommendation(analyzed as any);
      expect(rec).toContain('Increase the weight to 102.5kg');
    });

    test('should recommend building volume if reps < 8', () => {
      const analyzed = [{
        maxE1rm: 120, volumeLoad: 2800,
        sets: [{ weight: 100, reps: 7 }]
      }];
      const rec = generateRecommendation(analyzed as any);
      expect(rec).toContain('Keep the weight exactly the same');
      expect(rec).toContain('push for 8-9 reps');
    });

    test('should recommend staying in sweet spot for 8-11 reps', () => {
      const analyzed = [{
        maxE1rm: 133, volumeLoad: 3000,
        sets: [{ weight: 100, reps: 10 }]
      }];
      const rec = generateRecommendation(analyzed as any);
      expect(rec).toContain('You are in the sweet spot');
      expect(rec).toContain('push closer to 12 reps');
    });

    test('should return null for empty data', () => {
      expect(generateRecommendation([] as any)).toBeNull();
    });

    // ── Injury / Regression Scenarios ──────────────────────────

    test('should warn about regression when e1RM drops significantly', () => {
      const analyzed = [
        { maxE1rm: 130, volumeLoad: 3600, sets: [{ weight: 100, reps: 10 }] },
        { maxE1rm: 110, volumeLoad: 3000, sets: [{ weight: 85, reps: 10 }] },  // -15.4% e1RM
      ];
      const rec = generateRecommendation(analyzed as any);
      expect(rec).toContain('Performance regression detected');
      expect(rec).toContain('Do NOT push for progressive overload');
    });

    test('should warn about regression when volume drops sharply', () => {
      const analyzed = [
        { maxE1rm: 130, volumeLoad: 4000, sets: [{ weight: 100, reps: 12 }] },
        { maxE1rm: 128, volumeLoad: 3000, sets: [{ weight: 100, reps: 10 }] },  // -25% volume
      ];
      const rec = generateRecommendation(analyzed as any);
      expect(rec).toContain('Performance regression detected');
      expect(rec).toContain('volume dropped');
    });

    test('should strongly warn about sustained multi-session decline (injury signal)', () => {
      const analyzed = [
        { maxE1rm: 140, volumeLoad: 4200, sets: [{ weight: 105, reps: 10 }] },
        { maxE1rm: 120, volumeLoad: 3400, sets: [{ weight: 90, reps: 10 }] },  // -14.3%
        { maxE1rm: 100, volumeLoad: 2600, sets: [{ weight: 75, reps: 10 }] },  // -16.7%
      ];
      const rec = generateRecommendation(analyzed as any);
      expect(rec).toContain('Sustained performance decline');
      expect(rec).toContain('deload week');
      expect(rec).toContain('consult a professional');
    });

    test('should apply normal double progression if performance is stable', () => {
      const analyzed = [
        { maxE1rm: 130, volumeLoad: 3600, sets: [{ weight: 100, reps: 10 }] },
        { maxE1rm: 133, volumeLoad: 3800, sets: [{ weight: 100, reps: 12 }] },  // improved
      ];
      const rec = generateRecommendation(analyzed as any);
      // Should NOT mention regression
      expect(rec).not.toContain('regression');
      expect(rec).not.toContain('Sustained');
      // Should recommend progressive overload
      expect(rec).toContain('Increase the weight to 102.5kg');
    });

    test('should handle coming back from injury with reduced weight', () => {
      // Simulates a user who was doing 100kg, got injured, and came back at 60kg
      const analyzed = [
        { maxE1rm: 133, volumeLoad: 3600, sets: [{ weight: 100, reps: 10 }] },
        { maxE1rm: 80, volumeLoad: 1440, sets: [{ weight: 60, reps: 8 }] },  // massive drop
      ];
      const rec = generateRecommendation(analyzed as any);
      expect(rec).toContain('Performance regression detected');
      expect(rec).toContain('reduce by 10-20%');
      expect(rec).toContain('monitor how your body feels');
    });
  });
});
