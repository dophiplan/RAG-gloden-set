import { describe, it, expect } from 'vitest';
import {
  bytesToMB,
  formatFileSize,
  isValidFileSize,
  validateFileSize,
  getOversizedFileError,
  getMaxFileSize,
  getMaxFileSizeInMB,
} from '@/lib/validation/file_size_validator';
import { MAX_FILE_SIZE } from '@/lib/constants';

describe('File Size Validator', () => {
  describe('bytesToMB', () => {
    it('should convert bytes to MB correctly', () => {
      expect(bytesToMB(1024 * 1024)).toBe('1.00');
      expect(bytesToMB(4.5 * 1024 * 1024)).toBe('4.50');
      expect(bytesToMB(0)).toBe('0.00');
    });

    it('should respect decimal places parameter', () => {
      expect(bytesToMB(1024 * 1024, 0)).toBe('1');
      expect(bytesToMB(1024 * 1024, 3)).toBe('1.000');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(512)).toBe('512 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    });

    it('should handle large files', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('isValidFileSize', () => {
    it('should return true for files within limit', () => {
      expect(isValidFileSize(1024)).toBe(true);
      expect(isValidFileSize(MAX_FILE_SIZE)).toBe(true);
      expect(isValidFileSize(MAX_FILE_SIZE - 1)).toBe(true);
    });

    it('should return false for files exceeding limit', () => {
      expect(isValidFileSize(MAX_FILE_SIZE + 1)).toBe(false);
      expect(isValidFileSize(MAX_FILE_SIZE * 2)).toBe(false);
    });

    it('should use custom max size when provided', () => {
      expect(isValidFileSize(2048, 1024)).toBe(false);
      expect(isValidFileSize(512, 1024)).toBe(true);
    });
  });

  describe('validateFileSize', () => {
    it('should return valid result for files within limit', () => {
      const result = validateFileSize(1024 * 1024);

      expect(result.valid).toBe(true);
      expect(result.size).toBe(1024 * 1024);
      expect(result.maxSize).toBe(MAX_FILE_SIZE);
      expect(result.sizeInMB).toBe(1);
      expect(result.sizeExceeded).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid result for oversized files', () => {
      const oversized = MAX_FILE_SIZE + 1024;
      const result = validateFileSize(oversized);

      expect(result.valid).toBe(false);
      expect(result.size).toBe(oversized);
      expect(result.sizeExceeded).toBe(true);
      expect(result.error).toContain('4.50MB');
    });
  });

  describe('getOversizedFileError', () => {
    it('should return error message with file size info', () => {
      const error = getOversizedFileError(5.5, 4.5);

      expect(error).toContain('4.50MB');
      expect(error).toContain('5.50MB');
    });

    it('should use default max size when not provided', () => {
      const error = getOversizedFileError(10);

      expect(error).toContain('4.50MB');
      expect(error).toContain('10.00MB');
    });
  });

  describe('getMaxFileSize', () => {
    it('should return MAX_FILE_SIZE from constants', () => {
      expect(getMaxFileSize()).toBe(MAX_FILE_SIZE);
      expect(getMaxFileSize()).toBe(4.5 * 1024 * 1024);
    });
  });

  describe('getMaxFileSizeInMB', () => {
    it('should return 4.5', () => {
      expect(getMaxFileSizeInMB()).toBe(4.5);
    });
  });
});
