import { describe, it, expect } from 'vitest';
import {
  calculateSimilarity,
  findSimilarTexts,
  isExactMatch,
} from '@/lib/similarity';

describe('Similarity Functions', () => {
  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      const result = calculateSimilarity('hello', 'hello');
      expect(result).toBe(1);
    });

    it('should return 1 for case-insensitive identical strings', () => {
      const result = calculateSimilarity('Hello', 'hello');
      expect(result).toBe(1);
    });

    it('should return 1 for identical strings with whitespace differences', () => {
      const result = calculateSimilarity('  hello  ', 'hello');
      expect(result).toBe(1);
    });

    it('should return 0 for empty strings', () => {
      const result1 = calculateSimilarity('', 'hello');
      const result2 = calculateSimilarity('hello', '');
      const result3 = calculateSimilarity('', '');

      expect(result1).toBe(0);
      expect(result2).toBe(0);
      expect(result3).toBe(1); // Both empty strings are considered identical
    });

    it('should return high similarity for similar strings', () => {
      const result = calculateSimilarity('hello', 'hallo');
      expect(result).toBeGreaterThan(0.7);
      expect(result).toBeLessThan(1);
    });

    it('should return low similarity for very different strings', () => {
      const result = calculateSimilarity('hello', 'world');
      expect(result).toBeLessThan(0.5);
    });

    it('should handle Korean text', () => {
      const result1 = calculateSimilarity('안녕하세요', '안녕하세요');
      expect(result1).toBe(1);

      const result2 = calculateSimilarity('안녕하세요', '안녕하십니까');
      expect(result2).toBeGreaterThan(0);
      expect(result2).toBeLessThan(1);
    });

    it('should handle single character difference', () => {
      const result = calculateSimilarity('test', 'text');
      expect(result).toBeGreaterThan(0.7);
    });

    it('should handle length differences', () => {
      const result = calculateSimilarity('hello', 'hello world');
      expect(result).toBeGreaterThan(0.4);
      expect(result).toBeLessThan(0.8);
    });

    it('should be symmetric', () => {
      const result1 = calculateSimilarity('hello', 'world');
      const result2 = calculateSimilarity('world', 'hello');
      expect(result1).toBe(result2);
    });
  });

  describe('findSimilarTexts', () => {
    const candidates = [
      { id: '1', text: 'Hello World' },
      { id: '2', text: 'Hello Everyone' },
      { id: '3', text: 'Hi World' },
      { id: '4', text: 'Goodbye' },
      { id: '5', text: 'hello world' }, // Case variation
    ];

    it('should find exact matches', () => {
      const results = findSimilarTexts('Hello World', candidates, 0.8);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBe(1);
      expect(results[0].text).toMatch(/Hello World/i);
    });

    it('should find similar texts above threshold', () => {
      const results = findSimilarTexts('Hello World', candidates, 0.7);

      expect(results.length).toBeGreaterThan(1);
      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should sort by similarity descending', () => {
      const results = findSimilarTexts('Hello World', candidates, 0.5);

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
      }
    });

    it('should return empty array when no matches above threshold', () => {
      const results = findSimilarTexts('Completely Different Text', candidates, 0.9);

      expect(results.length).toBe(0);
    });

    it('should handle empty candidates array', () => {
      const results = findSimilarTexts('Hello', [], 0.8);

      expect(results).toEqual([]);
    });

    it('should use default threshold of 0.8', () => {
      const results = findSimilarTexts('Hello World', candidates);

      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should find case-insensitive matches', () => {
      const results = findSimilarTexts('hello world', candidates, 0.9);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBe(1);
    });

    it('should include all required properties in results', () => {
      const results = findSimilarTexts('Hello', candidates, 0.5);

      results.forEach(result => {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('similarity');
        expect(typeof result.similarity).toBe('number');
      });
    });
  });

  describe('isExactMatch', () => {
    it('should return true for identical strings', () => {
      const result = isExactMatch('hello', 'hello');
      expect(result).toBe(true);
    });

    it('should return true for case-insensitive identical strings', () => {
      const result1 = isExactMatch('Hello', 'hello');
      const result2 = isExactMatch('HELLO', 'hello');
      const result3 = isExactMatch('HeLLo', 'hELlo');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it('should return true for strings with whitespace differences', () => {
      const result1 = isExactMatch('  hello  ', 'hello');
      const result2 = isExactMatch('hello', '  hello  ');
      const result3 = isExactMatch('  hello  ', '  hello  ');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it('should return false for different strings', () => {
      const result = isExactMatch('hello', 'world');
      expect(result).toBe(false);
    });

    it('should return false for similar but not identical strings', () => {
      const result1 = isExactMatch('hello', 'hallo');
      const result2 = isExactMatch('test', 'text');

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    it('should handle Korean text', () => {
      const result1 = isExactMatch('안녕하세요', '안녕하세요');
      const result2 = isExactMatch('안녕하세요', '안녕하십니까');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should handle empty strings', () => {
      const result1 = isExactMatch('', '');
      const result2 = isExactMatch('hello', '');
      const result3 = isExactMatch('', 'hello');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });

    it('should handle mixed case and whitespace', () => {
      const result = isExactMatch('  Hello World  ', 'hello world');
      expect(result).toBe(true);
    });
  });
});
