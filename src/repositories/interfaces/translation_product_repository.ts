/**
 * Translation Product Repository Interface
 * 
 * 번역-제품 간 다대다 관계 관리를 위한 Repository 인터페이스
 * 
 * @example
 * ```typescript
 * // 구현 예시
 * class TranslationProductRepository implements ITranslationProductRepository {
 *   async createMany(links) { ... }
 *   async findByTranslationId(id) { ... }
 *   // ... other methods
 * }
 * 
 * // 사용 예시
 * const repo: ITranslationProductRepository = new TranslationProductRepository(supabase);
 * await repo.updateForTranslation('trans-1', ['RC', 'RV']);
 * ```
 */

import type { TranslationProduct, ProductCode } from '@/types';

// ============================================================================
// Translation Product Entity Types
// ============================================================================

/**
 * 번역-제품 연결 생성 데이터
 */
export interface TranslationProductCreateData {
  /** 번역 ID */
  translation_id: string;
  /** 제품 코드 */
  product_code: ProductCode;
  /** 버전 */
  version?: string | null;
  /** 버전 업데이트 일시 */
  version_updated_at?: string | null;
}

// ============================================================================
// Translation Product Repository Interface
// ============================================================================

/**
 * 번역-제품 Repository 인터페이스
 * 
 * 번역과 제품 간의 다대다 관계를 관리합니다.
 */
export interface ITranslationProductRepository {
  /**
   * 다중 번역-제품 연결 생성
   * 
   * @param links - 생성할 연결 목록
   * @returns 생성된 연결 목록
   */
  createMany(links: TranslationProductCreateData[]): Promise<TranslationProduct[]>;

  /**
   * 번역 ID로 연결 목록 조회
   * 
   * @param translationId - 번역 ID
   * @returns 연결 목록
   */
  findByTranslationId(translationId: string): Promise<TranslationProduct[]>;

  /**
   * 번역 ID로 연결 삭제
   * 
   * @param translationId - 번역 ID
   */
  deleteByTranslationId(translationId: string): Promise<void>;

  /**
   * 번역의 제품 연결 업데이트 (삭제 후 생성)
   * 
   * @param translationId - 번역 ID
   * @param productCodes - 새 제품 코드 목록
   * @returns 생성된 연결 목록
   */
  updateForTranslation(
    translationId: string,
    productCodes: ProductCode[]
  ): Promise<TranslationProduct[]>;
}

// ============================================================================
// Translation Product Repository Provider Type
// ============================================================================

/**
 * Translation Product Repository Provider 함수 타입
 */
export type TranslationProductRepositoryProvider = () => ITranslationProductRepository;
