import { describe, it, expect } from 'vitest';
import {
  translationCreateSchema,
  bulkCreateSchema,
  bulkUpdateSchema,
  glossaryCreateSchema,
  aiTranslateSchema,
  openaiKeySchema,
  sanitizeText,
  validateAndSanitize,
} from '@/lib/validation/schemas';

describe('Translation Validation Schemas', () => {
  describe('translationCreateSchema', () => {
    it('should validate valid translation data', () => {
      const validData = {
        source_text: 'Hello World',
        context: 'Greeting message',
        version: '1.0.0',
        product_code: 'PROD-001',
        scope: 'SaaS',
        priority: '중',
        translations: [
          { language_code: 'ko', translated_text: '안녕하세요' },
        ],
        product_codes: ['PROD-001'],
        completion_date: '2024-12-31',
      };

      const result = validateAndSanitize(translationCreateSchema, validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.source_text).toBe('Hello World');
      }
    });

    it('should reject empty source_text', () => {
      const invalidData = {
        source_text: '',
      };

      const result = validateAndSanitize(translationCreateSchema, invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('필수');
      }
    });

    it('should reject source_text exceeding max length', () => {
      const invalidData = {
        source_text: 'a'.repeat(5001),
      };

      const result = validateAndSanitize(translationCreateSchema, invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('5000자');
      }
    });

    it('should trim source_text whitespace', () => {
      const data = {
        source_text: '  Hello World  ',
      };

      const result = validateAndSanitize(translationCreateSchema, data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.source_text).toBe('Hello World');
      }
    });

    it('should validate optional fields', () => {
      const minimalData = {
        source_text: 'Hello',
      };

      const result = validateAndSanitize(translationCreateSchema, minimalData);
      expect(result.success).toBe(true);
    });

    it('should validate scope enum values', () => {
      const validScopes = ['SaaS', 'Solution', 'saas', 'solution'];

      validScopes.forEach(scope => {
        const data = {
          source_text: 'Hello',
          scope,
        };
        const result = validateAndSanitize(translationCreateSchema, data);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid scope values', () => {
      const data = {
        source_text: 'Hello',
        scope: 'InvalidScope',
      };

      const result = validateAndSanitize(translationCreateSchema, data);
      expect(result.success).toBe(false);
    });

    it('should validate priority enum values', () => {
      const validPriorities = ['긴급', '상', '중', '하'];

      validPriorities.forEach(priority => {
        const data = {
          source_text: 'Hello',
          priority,
        };
        const result = validateAndSanitize(translationCreateSchema, data);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('bulkCreateSchema', () => {
    it('should validate valid bulk creation data', () => {
      const validData = {
        texts: ['Hello', 'World', 'Test'],
        context: 'Bulk import',
        product_code: 'PROD-001',
      };

      const result = validateAndSanitize(bulkCreateSchema, validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty texts array', () => {
      const invalidData = {
        texts: [],
      };

      const result = validateAndSanitize(bulkCreateSchema, invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('최소 1개');
      }
    });

    it('should reject more than 100 texts', () => {
      const invalidData = {
        texts: Array(101).fill('Test'),
      };

      const result = validateAndSanitize(bulkCreateSchema, invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('100개');
      }
    });

    it('should trim text values', () => {
      const data = {
        texts: ['  Hello  ', '  World  '],
      };

      const result = validateAndSanitize(bulkCreateSchema, data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.texts).toEqual(['Hello', 'World']);
      }
    });
  });

  describe('bulkUpdateSchema', () => {
    it('should validate valid bulk update data', () => {
      const validData = {
        ids: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'],
        status: 'reviewed',
      };

      const result = validateAndSanitize(bulkUpdateSchema, validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      const invalidData = {
        ids: ['not-a-uuid', 'also-not-uuid'],
        status: 'reviewed',
      };

      const result = validateAndSanitize(bulkUpdateSchema, invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid status values', () => {
      const invalidData = {
        ids: ['550e8400-e29b-41d4-a716-446655440000'],
        status: 'invalid-status',
      };

      const result = validateAndSanitize(bulkUpdateSchema, invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('glossaryCreateSchema', () => {
    it('should validate valid glossary data', () => {
      const validData = {
        term: 'Hello',
        translation: '안녕하세요',
        language_code: 'ko',
        context: 'Greeting',
        product_code: 'PROD-001',
      };

      const result = validateAndSanitize(glossaryCreateSchema, validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty term', () => {
      const invalidData = {
        term: '',
        translation: '안녕하세요',
        language_code: 'ko',
      };

      const result = validateAndSanitize(glossaryCreateSchema, invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty translation', () => {
      const invalidData = {
        term: 'Hello',
        translation: '',
        language_code: 'ko',
      };

      const result = validateAndSanitize(glossaryCreateSchema, invalidData);
      expect(result.success).toBe(false);
    });

    it('should trim term and translation', () => {
      const data = {
        term: '  Hello  ',
        translation: '  안녕하세요  ',
        language_code: 'ko',
      };

      const result = validateAndSanitize(glossaryCreateSchema, data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.term).toBe('Hello');
        expect(result.data.translation).toBe('안녕하세요');
      }
    });
  });

  describe('aiTranslateSchema', () => {
    it('should validate valid AI translation request', () => {
      const validData = {
        sourceText: 'Hello World',
        context: 'Greeting',
        targetLanguages: ['ko', 'ja'],
        translationId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = validateAndSanitize(aiTranslateSchema, validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty targetLanguages', () => {
      const invalidData = {
        sourceText: 'Hello',
        targetLanguages: [],
      };

      const result = validateAndSanitize(aiTranslateSchema, invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('최소 1개');
      }
    });

    it('should reject more than 20 target languages', () => {
      const invalidData = {
        sourceText: 'Hello',
        targetLanguages: Array(21).fill('ko'),
      };

      const result = validateAndSanitize(aiTranslateSchema, invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('20개');
      }
    });

    it('should validate without optional translationId', () => {
      const data = {
        sourceText: 'Hello',
        targetLanguages: ['ko'],
      };

      const result = validateAndSanitize(aiTranslateSchema, data);
      expect(result.success).toBe(true);
    });
  });

  describe('openaiKeySchema', () => {
    it('should validate valid OpenAI API key', () => {
      const validData = {
        apiKey: 'sk-1234567890abcdef1234567890abcdef',
      };

      const result = validateAndSanitize(openaiKeySchema, validData);
      expect(result.success).toBe(true);
    });

    it('should reject key not starting with sk-', () => {
      const invalidData = {
        apiKey: 'invalid-key-format',
      };

      const result = validateAndSanitize(openaiKeySchema, invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('sk-');
      }
    });

    it('should reject empty API key', () => {
      const invalidData = {
        apiKey: '',
      };

      const result = validateAndSanitize(openaiKeySchema, invalidData);
      expect(result.success).toBe(false);
    });

    it('should trim API key whitespace', () => {
      const data = {
        apiKey: '  sk-1234567890abcdef  ',
      };

      const result = validateAndSanitize(openaiKeySchema, data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.apiKey).toBe('sk-1234567890abcdef');
      }
    });
  });
});

describe('Sanitization Functions', () => {
  describe('sanitizeText', () => {
    it('should remove null bytes', () => {
      const input = 'Hello\0World';
      const result = sanitizeText(input);
      expect(result).toBe('HelloWorld');
    });

    it('should remove control characters', () => {
      const input = 'Hello\x01\x02\x03World';
      const result = sanitizeText(input);
      expect(result).toBe('HelloWorld');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeText(input);
      expect(result).toBe('Hello World');
    });

    it('should handle normal text without changes', () => {
      const input = 'Hello World';
      const result = sanitizeText(input);
      expect(result).toBe('Hello World');
    });

    it('should handle Unicode characters', () => {
      const input = '안녕하세요 世界';
      const result = sanitizeText(input);
      expect(result).toBe('안녕하세요 世界');
    });

    it('should handle empty string', () => {
      const input = '';
      const result = sanitizeText(input);
      expect(result).toBe('');
    });

    it('should handle string with only whitespace', () => {
      const input = '   \t\n   ';
      const result = sanitizeText(input);
      expect(result).toBe('');
    });
  });

  describe('validateAndSanitize', () => {
    it('should return success for valid data', () => {
      const schema = translationCreateSchema;
      const data = { source_text: 'Hello' };

      const result = validateAndSanitize(schema, data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
      }
    });

    it('should return error for invalid data', () => {
      const schema = translationCreateSchema;
      const data = { source_text: '' };

      const result = validateAndSanitize(schema, data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    it('should return first validation error message', () => {
      const schema = translationCreateSchema;
      const data = {
        source_text: '',
        priority: 'invalid',
      };

      const result = validateAndSanitize(schema, data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
    });
  });
});
