import { describe, it, expect } from 'vitest';
import { formatDateKR, formatDateTimeKR } from '@/shared/date_time/date_formatter';

describe('Format Functions', () => {
  describe('formatDateKR', () => {
    it('should format valid date string', () => {
      const dateStr = '2024-01-15T10:30:00.000Z';
      const result = formatDateKR(dateStr);

      // Result should contain year, month, and day in Korean format
      expect(result).toMatch(/2024/);
      expect(result).toMatch(/1월/);
      expect(result).toMatch(/15일/);
    });

    it('should return "-" for null input', () => {
      const result = formatDateKR(null);
      expect(result).toBe('-');
    });

    it('should handle different date formats', () => {
      const dates = [
        '2024-12-31',
        '2024-12-31T00:00:00Z',
        '2024-12-31T12:00:00.000Z',
      ];

      dates.forEach(date => {
        const result = formatDateKR(date);
        expect(result).toMatch(/2024|2025/); // May vary by timezone
        expect(result).toMatch(/12월|1월/);
        expect(result).toMatch(/31일|1일/);
      });
    });

    it('should format beginning of year', () => {
      const dateStr = '2024-01-01T00:00:00.000Z';
      const result = formatDateKR(dateStr);

      expect(result).toMatch(/2024/);
      expect(result).toMatch(/1월/);
      expect(result).toMatch(/1일/);
    });

    it('should format end of year', () => {
      const dateStr = '2024-12-31T12:00:00.000Z';
      const result = formatDateKR(dateStr);

      expect(result).toMatch(/2024|2025/); // May vary by timezone
      expect(result).toMatch(/12월|1월/);
      expect(result).toMatch(/31일|1일/);
    });
  });

  describe('formatDateTimeKR', () => {
    it('should format valid datetime string with time', () => {
      const dateStr = '2024-01-15T10:30:00.000Z';
      const result = formatDateTimeKR(dateStr);

      // Result should contain date and time
      expect(result).toMatch(/2024/);
      expect(result).toMatch(/1월/);
      expect(result).toMatch(/15일/);
      // Time formatting may vary based on timezone, so we just check it exists
      expect(result.length).toBeGreaterThan(10);
    });

    it('should return "-" for null input', () => {
      const result = formatDateTimeKR(null);
      expect(result).toBe('-');
    });

    it('should include time components', () => {
      const dateStr = '2024-06-15T14:30:00.000Z';
      const result = formatDateTimeKR(dateStr);

      // Should have both date and time
      expect(result).toMatch(/2024/);
      expect(result).toMatch(/6월/);
      expect(result).toMatch(/15일/);
      // Time should be present (format varies by timezone)
      expect(result).toContain(':');
    });

    it('should handle midnight time', () => {
      const dateStr = '2024-01-01T00:00:00.000Z';
      const result = formatDateTimeKR(dateStr);

      expect(result).toMatch(/2024/);
      expect(result).toContain(':');
    });

    it('should handle end of day time', () => {
      const dateStr = '2024-12-31T12:00:00.000Z';
      const result = formatDateTimeKR(dateStr);

      expect(result).toMatch(/2024|2025/); // May vary by timezone
      expect(result).toContain(':');
    });
  });
});
