/**
 * Translation Result Repository Interface
 * 
 * 번역 결과(다국어 번역) 관리를 위한 Repository 인터페이스
 * 
 * @example
 * ```typescript
 * // 구현 예시
 * class TranslationResultRepository implements ITranslationResultRepository {
 *   async findByTranslationId(id) { ... }
 *   async create(data) { ... }
 *   // ... other methods
 * }
 * 
 * // 사용 예시
 * const repo: ITranslationResultRepository = new TranslationResultRepository(supabase);
 * const results = await repo.findByTranslationId('trans-1');
 * ```
 */

import type { TranslationResult, LanguageCode } from '@/types';

// ============================================================================
// Translation Result Entity Types
// ============================================================================

/**
 * 번역 결과 생성 데이터
 */
export interface TranslationResultCreateData {
  /** 번역 ID */
  translation_id: string;
  /** 언어 코드 */
  language_code: LanguageCode;
  /** 번역된 텍스트 */
  translated_text: string;
  /** 검수자 ID */
  reviewer_id: string;
  /** 검수 일시 */
  reviewed_at: string;
  /** 소스 유형 */
  source_type?: 'glossary' | 'ai' | 'manual' | 'imported' | null;
  /** 용어집 항목 ID */
  glossary_term_id?: string | null;
}

/**
 * 번역 결과 업데이트 데이터
 */
export type TranslationResultUpdateData = Partial<TranslationResult>;

// ============================================================================
// Translation Result Repository Interface
// ============================================================================

/**
 * 번역 결과 Repository 인터페이스
 * 
 * 번역 결과의 CRUD 및 Upsert 작업을 지원합니다.
 */
export interface ITranslationResultRepository {
  /**
   * 번역 ID로 번역 결과 목록 조회
   * 
   * @param translationId - 번역 ID
   * @returns 번역 결과 목록
   */
  findByTranslationId(translationId: string): Promise<TranslationResult[]>;

  /**
   * 단일 번역 결과 조회
   * 
   * @param translationId - 번역 ID
   * @param languageCode - 언어 코드
   * @returns 번역 결과 또는 null
   */
  findOne(
    translationId: string,
    languageCode: LanguageCode
  ): Promise<TranslationResult | null>;

  /**
   * 번역 ID와 언어 코드로 번역 결과 조회 (findOne 별칭)
   * 
   * @param translationId - 번역 ID
   * @param languageCode - 언어 코드
   * @returns 번역 결과 또는 null
   */
  findByTranslationAndLanguage(
    translationId: string,
    languageCode: LanguageCode
  ): Promise<TranslationResult | null>;

  /**
   * 번역 결과 생성
   * 
   * @param result - 생성 데이터
   * @returns 생성된 번역 결과
   */
  create(result: TranslationResultCreateData): Promise<TranslationResult>;

  /**
   * 다중 번역 결과 생성
   * 
   * @param results - 생성 데이터 목록
   * @returns 생성된 번역 결과 목록
   */
  createMany(results: TranslationResultCreateData[]): Promise<TranslationResult[]>;

  /**
   * 번역 결과 업데이트
   * 
   * @param translationId - 번역 ID
   * @param languageCode - 언어 코드
   * @param updates - 업데이트 데이터
   * @returns 업데이트된 번역 결과
   */
  update(
    translationId: string,
    languageCode: LanguageCode,
    updates: TranslationResultUpdateData
  ): Promise<TranslationResult>;

  /**
   * 번역 ID로 번역 결과 삭제
   * 
   * @param translationId - 번역 ID
   */
  deleteByTranslationId(translationId: string): Promise<void>;

  /**
   * Upsert (있으면 업데이트, 없으면 생성)
   * 
   * @param result - Upsert 데이터
   * @returns Upsert된 번역 결과
   */
  upsert(result: TranslationResultCreateData): Promise<TranslationResult>;
}

// ============================================================================
// Translation Result Repository Provider Type
// ============================================================================

/**
 * Translation Result Repository Provider 함수 타입
 */
export type TranslationResultRepositoryProvider = () => ITranslationResultRepository;
