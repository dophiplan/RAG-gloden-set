import { describe, it, expect } from 'vitest';
import {
  isSupportedFileType,
  isImageFile,
  isPDFFile,
  validateFileType,
  getUnsupportedFileTypeError,
  getSupportedExtensions,
  getSupportedTypes,
  SUPPORTED_FILE_TYPES,
  SUPPORTED_IMAGE_TYPES,
} from '@/lib/validation/file_type_validator';

describe('File Type Validator', () => {
  describe('isSupportedFileType', () => {
    it('should return true for PDF files', () => {
      expect(isSupportedFileType('application/pdf')).toBe(true);
    });

    it('should return true for image files', () => {
      expect(isSupportedFileType('image/png')).toBe(true);
      expect(isSupportedFileType('image/jpeg')).toBe(true);
      expect(isSupportedFileType('image/jpg')).toBe(true);
      expect(isSupportedFileType('image/gif')).toBe(true);
      expect(isSupportedFileType('image/webp')).toBe(true);
    });

    it('should return false for unsupported file types', () => {
      expect(isSupportedFileType('text/plain')).toBe(false);
      expect(isSupportedFileType('application/msword')).toBe(false);
      expect(isSupportedFileType('application/zip')).toBe(false);
      expect(isSupportedFileType('video/mp4')).toBe(false);
    });
  });

  describe('isImageFile', () => {
    it('should return true for supported image types', () => {
      SUPPORTED_IMAGE_TYPES.forEach(type => {
        expect(isImageFile(type)).toBe(true);
      });
    });

    it('should return false for non-image types', () => {
      expect(isImageFile('application/pdf')).toBe(false);
      expect(isImageFile('text/plain')).toBe(false);
    });
  });

  describe('isPDFFile', () => {
    it('should return true for PDF type', () => {
      expect(isPDFFile('application/pdf')).toBe(true);
    });

    it('should return false for non-PDF types', () => {
      expect(isPDFFile('image/png')).toBe(false);
      expect(isPDFFile('text/plain')).toBe(false);
    });
  });

  describe('validateFileType', () => {
    it('should return valid result for PDF', () => {
      const result = validateFileType('application/pdf');
      
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('application/pdf');
      expect(result.isPDF).toBe(true);
      expect(result.isImage).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should return valid result for image', () => {
      const result = validateFileType('image/png');
      
      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('image/png');
      expect(result.isPDF).toBe(false);
      expect(result.isImage).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid result with error for unsupported type', () => {
      const result = validateFileType('text/plain');
      
      expect(result.valid).toBe(false);
      expect(result.fileType).toBe('text/plain');
      expect(result.isPDF).toBe(false);
      expect(result.isImage).toBe(false);
      expect(result.error).toBe(getUnsupportedFileTypeError());
    });
  });

  describe('getUnsupportedFileTypeError', () => {
    it('should return error message with supported formats', () => {
      const error = getUnsupportedFileTypeError();
      
      expect(error).toContain('PDF');
      expect(error).toContain('PNG');
      expect(error).toContain('JPG');
      expect(error).toContain('GIF');
      expect(error).toContain('WEBP');
    });
  });

  describe('getSupportedExtensions', () => {
    it('should return all supported extensions', () => {
      const extensions = getSupportedExtensions();
      
      expect(extensions).toContain('.pdf');
      expect(extensions).toContain('.png');
      expect(extensions).toContain('.jpg');
      expect(extensions).toContain('.jpeg');
      expect(extensions).toContain('.gif');
      expect(extensions).toContain('.webp');
      expect(extensions).toHaveLength(6);
    });
  });

  describe('getSupportedTypes', () => {
    it('should return all types when category is "all"', () => {
      const types = getSupportedTypes('all');
      
      expect(types).toHaveLength(SUPPORTED_FILE_TYPES.length);
      expect(types).toContain('application/pdf');
      expect(types).toContain('image/png');
    });

    it('should return only image types when category is "images"', () => {
      const types = getSupportedTypes('images');
      
      expect(types).toHaveLength(SUPPORTED_IMAGE_TYPES.length);
      expect(types).toContain('image/png');
      expect(types).not.toContain('application/pdf');
    });

    it('should return only PDF type when category is "pdf"', () => {
      const types = getSupportedTypes('pdf');
      
      expect(types).toHaveLength(1);
      expect(types).toContain('application/pdf');
    });
  });
});
