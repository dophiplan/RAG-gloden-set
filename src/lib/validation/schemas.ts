import { z } from 'zod';
import { LanguageCode, ProductCode, TranslationStatus, Scope } from '@/types';

// Common field validations
const MAX_TEXT_LENGTH = 5000;
const MAX_CONTEXT_LENGTH = 1000;
const MAX_VERSION_LENGTH = 50;
const MAX_TERM_LENGTH = 500;

// Translation validation schemas
export const translationCreateSchema = z.object({
  source_text: z.string()
    .trim()
    .min(1, '원문 텍스트는 필수입니다.')
    .max(MAX_TEXT_LENGTH, `텍스트는 최대 ${MAX_TEXT_LENGTH}자까지 입력할 수 있습니다.`),
  context: z.string()
    .max(MAX_CONTEXT_LENGTH, `컨텍스트는 최대 ${MAX_CONTEXT_LENGTH}자까지 입력할 수 있습니다.`)
    .optional(),
  version: z.string()
    .max(MAX_VERSION_LENGTH, `버전은 최대 ${MAX_VERSION_LENGTH}자까지 입력할 수 있습니다.`)
    .optional(),
  product_code: z.string().optional(),
  scope: z.enum(['SaaS', 'Solution', 'saas', 'solution', 'government', 'other']).optional(),
  priority: z.enum(['긴급', '상', '중', '하', 'urgent', 'high', 'medium', 'low']).optional(),
  translations: z.array(
    z.object({
      language_code: z.string(),
      translated_text: z.string()
        .max(MAX_TEXT_LENGTH, `번역 텍스트는 최대 ${MAX_TEXT_LENGTH}자까지 입력할 수 있습니다.`),
    })
  ).optional(),
  product_codes: z.array(z.string()).optional(),
  platform_codes: z.array(z.string()).optional(),
  completion_date: z.string().optional(),
});

export const bulkCreateSchema = z.object({
  texts: z.array(z.string().trim().min(1).max(MAX_TEXT_LENGTH))
    .min(1, '최소 1개 이상의 텍스트가 필요합니다.')
    .max(100, '최대 100개까지 일괄 생성할 수 있습니다.'),
  context: z.string()
    .max(MAX_CONTEXT_LENGTH)
    .optional(),
  version: z.string()
    .max(MAX_VERSION_LENGTH)
    .optional(),
  product_code: z.string().optional(),
  product_codes: z.array(z.string()).optional(),
  platform_codes: z.array(z.string()).optional(),
  scope: z.enum(['SaaS', 'Solution', 'saas', 'solution']).optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
  languages: z.array(z.string()).optional(),
  completion_date: z.string().optional(),
});

export const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid())
    .min(1, '최소 1개 이상의 ID가 필요합니다.')
    .max(100, '최대 100개까지 일괄 수정할 수 있습니다.'),
  status: z.enum(['pending', 'reviewed', 'deployed']),
});

// Glossary validation schemas
export const glossaryCreateSchema = z.object({
  term: z.string()
    .trim()
    .min(1, '용어는 필수입니다.')
    .max(MAX_TERM_LENGTH, `용어는 최대 ${MAX_TERM_LENGTH}자까지 입력할 수 있습니다.`),
  translation: z.string()
    .trim()
    .min(1, '번역은 필수입니다.')
    .max(MAX_TERM_LENGTH, `번역은 최대 ${MAX_TERM_LENGTH}자까지 입력할 수 있습니다.`),
  language_code: z.string().min(2).max(5),
  context: z.string()
    .max(MAX_CONTEXT_LENGTH)
    .optional(),
  product_code: z.string().optional(),
  product_codes: z.array(z.string()).optional(),
});

export const glossaryBulkApproveSchema = z.object({
  ids: z.array(z.string().uuid())
    .min(1, '최소 1개 이상의 ID가 필요합니다.')
    .max(100, '최대 100개까지 일괄 처리할 수 있습니다.'),
  action: z.enum(['approve', 'reject']),
});

// AI Translation validation schemas
export const aiTranslateSchema = z.object({
  translationId: z.string().uuid().optional(),
  sourceText: z.string()
    .trim()
    .min(1, '원문 텍스트는 필수입니다.')
    .max(MAX_TEXT_LENGTH, `텍스트는 최대 ${MAX_TEXT_LENGTH}자까지 입력할 수 있습니다.`),
  context: z.string()
    .max(MAX_CONTEXT_LENGTH)
    .optional(),
  targetLanguages: z.array(z.string())
    .min(1, '최소 1개 이상의 대상 언어가 필요합니다.')
    .max(20, '최대 20개까지 번역할 수 있습니다.'),
});

// Settings validation schemas
export const openaiKeySchema = z.object({
  apiKey: z.string()
    .trim()
    .min(1, 'API 키는 필수입니다.')
    .regex(/^sk-/, 'OpenAI API 키는 "sk-"로 시작해야 합니다.')
    .max(200, 'API 키가 너무 깁니다.'),
});

// User validation schemas
export const userProfileUpdateSchema = z.object({
  name: z.string()
    .trim()
    .min(1, '이름은 필수입니다.')
    .max(100, '이름은 최대 100자까지 입력할 수 있습니다.'),
  department: z.string()
    .max(100)
    .optional(),
  contact: z.string()
    .max(50)
    .optional(),
});

// Query parameter validation
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// Admin API validation schemas - Master data management
export const languageCreateSchema = z.object({
  code: z.string()
    .trim()
    .min(2, '언어 코드는 최소 2자 이상이어야 합니다.')
    .max(10, '언어 코드는 최대 10자까지 입력할 수 있습니다.')
    .regex(/^[a-zA-Z0-9-]+$/, '언어 코드는 알파벳, 숫자, 하이픈(-)만 사용할 수 있습니다.'),
  name: z.string()
    .trim()
    .min(1, '언어 이름은 필수입니다.')
    .max(100, '언어 이름은 최대 100자까지 입력할 수 있습니다.'),
  description: z.string()
    .max(500, '설명은 최대 500자까지 입력할 수 있습니다.')
    .optional()
    .nullable(),
  display_order: z.number()
    .int()
    .min(0, '정렬 순서는 0 이상이어야 합니다.')
    .default(0),
});

export const productCreateSchema = z.object({
  code: z.string()
    .trim()
    .min(1, '제품 코드는 필수입니다.')
    .max(50, '제품 코드는 최대 50자까지 입력할 수 있습니다.')
    .regex(/^[A-Z0-9_-]+$/, '제품 코드는 대문자, 숫자, 언더스코어, 하이픈만 사용할 수 있습니다.'),
  name: z.string()
    .trim()
    .min(1, '제품 이름은 필수입니다.')
    .max(100, '제품 이름은 최대 100자까지 입력할 수 있습니다.'),
  description: z.string()
    .max(500, '설명은 최대 500자까지 입력할 수 있습니다.')
    .optional()
    .nullable(),
  display_order: z.number()
    .int()
    .min(0, '정렬 순서는 0 이상이어야 합니다.')
    .default(0),
});

export const platformCreateSchema = z.object({
  code: z.string()
    .trim()
    .min(1, '플랫폼 코드는 필수입니다.')
    .max(50, '플랫폼 코드는 최대 50자까지 입력할 수 있습니다.')
    .regex(/^[A-Za-z0-9_-]+$/, '플랫폼 코드는 알파벳, 숫자, 언더스코어, 하이픈만 사용할 수 있습니다.'),
  name: z.string()
    .trim()
    .min(1, '플랫폼 이름은 필수입니다.')
    .max(100, '플랫폼 이름은 최대 100자까지 입력할 수 있습니다.'),
  description: z.string()
    .max(500, '설명은 최대 500자까지 입력할 수 있습니다.')
    .optional()
    .nullable(),
  display_order: z.number()
    .int()
    .min(0, '정렬 순서는 0 이상이어야 합니다.')
    .default(0),
});

export const statusCreateSchema = z.object({
  code: z.string()
    .trim()
    .min(1, '상태 코드는 필수입니다.')
    .max(50, '상태 코드는 최대 50자까지 입력할 수 있습니다.')
    .regex(/^[a-z_]+$/, '상태 코드는 소문자와 언더스코어만 사용할 수 있습니다.'),
  label_ko: z.string()
    .trim()
    .min(1, '한글 라벨은 필수입니다.')
    .max(100, '한글 라벨은 최대 100자까지 입력할 수 있습니다.'),
  label_en: z.string()
    .trim()
    .min(1, '영문 라벨은 필수입니다.')
    .max(100, '영문 라벨은 최대 100자까지 입력할 수 있습니다.'),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, '색상은 hex 코드 형식이어야 합니다. (예: #FF0000)')
    .optional(),
  bg_color: z.string()
    .min(1, '배경 색상은 필수입니다.')
    .max(50, '배경 색상은 최대 50자까지 입력할 수 있습니다.'),
  text_color: z.string()
    .min(1, '텍스트 색상은 필수입니다.')
    .max(50, '텍스트 색상은 최대 50자까지 입력할 수 있습니다.'),
  sort_order: z.number()
    .int()
    .min(0, '정렬 순서는 0 이상이어야 합니다.')
    .default(0),
});

export const priorityCreateSchema = z.object({
  code: z.string()
    .trim()
    .min(1, '우선순위 코드는 필수입니다.')
    .max(50, '우선순위 코드는 최대 50자까지 입력할 수 있습니다.'),
  label: z.string()
    .trim()
    .min(1, '라벨은 필수입니다.')
    .max(100, '라벨은 최대 100자까지 입력할 수 있습니다.'),
  color: z.string()
    .min(1, '색상은 필수입니다.')
    .max(50, '색상은 최대 50자까지 입력할 수 있습니다.'),
  sort_order: z.number()
    .int()
    .min(0, '정렬 순서는 0 이상이어야 합니다.')
    .default(0),
});

export const scopeCreateSchema = z.object({
  code: z.string()
    .trim()
    .min(1, '분류 코드는 필수입니다.')
    .max(50, '분류 코드는 최대 50자까지 입력할 수 있습니다.'),
  name: z.string()
    .trim()
    .min(1, '분류 이름은 필수입니다.')
    .max(100, '분류 이름은 최대 100자까지 입력할 수 있습니다.'),
  description: z.string()
    .max(500, '설명은 최대 500자까지 입력할 수 있습니다.')
    .optional()
    .nullable(),
  sort_order: z.number()
    .int()
    .min(0, '정렬 순서는 0 이상이어야 합니다.')
    .default(0),
});

// Sanitization helper
export function sanitizeText(text: string): string {
  // Remove null bytes and control characters
  return text
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

// Validation helper function
export function validateAndSanitize<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return {
        success: false,
        error: firstError?.message || '유효하지 않은 입력입니다.',
      };
    }
    return { success: false, error: '유효하지 않은 입력입니다.' };
  }
}
