/**
 * Supabase Translation Repository Implementation
 * 
 * 번역 데이터 관리를 위한 Supabase 기반 Repository 구현체
 * - 필터링 (product, status, language, search 등)
 * - 페이지네이션
 * - 정렬
 * - 관계 조인 (products, results)
 * - 배치 작업
 * - 감사 로그 연동
 * 
 * @example
 * ```typescript
 * const repo = new SupabaseTranslationRepository(supabase);
 * const result = await repo.findMany(
 *   { status: 'pending', productCode: 'RC' },
 *   { page: 1, limit: 20 }
 * );
 * ```
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  ITranslationRepository,
  TranslationFilters,
  TranslationCreateData,
  TranslationUpdateData,
} from '@/repositories/interfaces/translation_repository';
import type {
  PaginatedResult,
  PaginationParams,
  OptimisticLockOptions,
} from '@/repositories/interfaces/base_repository';
import type { Translation, TranslationStatus } from '@/types';
import { OptimisticLockService } from '@/services/optimistic_lock_service';
import { LockCheckResult } from '@/types/optimistic_lock';

// Debug logging helper - only in development
const isDev = process.env.NODE_ENV === 'development';
const debug = isDev ? console.log.bind(console) : () => {};
const debugError = isDev ? console.error.bind(console) : () => {};

export class SupabaseTranslationRepository implements ITranslationRepository {
  private lockService: OptimisticLockService;

  constructor(private supabase: SupabaseClient) {
    this.lockService = new OptimisticLockService(supabase);
  }

  /**
   * ID로 번역 조회 (관계 데이터 포함)
   */
  async findById(id: string): Promise<Translation | null> {
    // 번역 기본 데이터 조회
    const { data: translation, error: translationError } = await this.supabase
      .from('translations')
      .select('*')
      .eq('id', id)
      .single();

    if (translationError) {
      if (translationError.code === 'PGRST116') return null;
      throw new Error(`Failed to find translation: ${translationError.message}`);
    }

    // 관계 데이터 병렬 조회
    const [resultsData, productsData, platformsData] = await Promise.all([
      this.supabase.from('translation_results').select('*').eq('translation_id', id),
      this.supabase.from('translation_products').select('*').eq('translation_id', id),
      this.supabase.from('translation_platforms').select('*').eq('translation_id', id),
    ]);

    return {
      ...translation,
      translation_results: resultsData.data || [],
      translation_products: productsData.data || [],
      translation_platforms: platformsData.data || [],
    } as Translation;
  }

  /**
   * 필터와 페이지네이션으로 번역 목록 조회
   * 
   * 지원 필터:
   * - status: 번역 상태
   * - language: 언어 코드 (translation_results 조인)
   * - search: source_text/translated_text 검색
   * - productCode: 제품 코드 (translation_products 조인)
   * - requestId: 요청 ID
   * - scope: 스코프
   * - version: 버전 (부분 일치)
   * - createdAfter/createdBefore: 생성일 범위
   */
  async findMany(
    filters: TranslationFilters = {},
    pagination: Partial<PaginationParams> = {}
  ): Promise<PaginatedResult<Translation>> {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    // 제품 필터 사용 시 inner join 필요
    const selectStatement = filters.productCode
      ? `
        *,
        translation_results (*),
        translation_products!inner (*),
        translation_platforms (*)
      `
      : `
        *,
        translation_results (*),
        translation_products (*),
        translation_platforms (*)
      `;

    let query = this.supabase
      .from('translations')
      .select(selectStatement, { count: 'exact' })
      .order('completion_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 필터 적용
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.language) {
      query = query.eq('translation_results.language_code', filters.language);
    }

    if (filters.productCode) {
      query = query.eq('translation_products.product_code', filters.productCode);
    }

    if (filters.requestId) {
      query = query.eq('request_id', filters.requestId);
    }

    if (filters.scope) {
      query = query.eq('scope', filters.scope);
    }

    if (filters.version) {
      query = query.ilike('version', `%${filters.version}%`);
    }

    if (filters.createdAfter) {
      query = query.gte('created_at', filters.createdAfter);
    }

    if (filters.createdBefore) {
      query = query.lte('created_at', filters.createdBefore);
    }

    if (filters.search) {
      // source_text와 translated_text에서 검색
      query = query.or(
        `source_text.ilike.%${filters.search}%,translation_results.translated_text.ilike.%${filters.search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      debugError('[SupabaseTranslationRepository] Query error:', error);
      throw new Error(`Failed to find translations: ${error.message}`);
    }

    debug('[SupabaseTranslationRepository] Query results:', {
      count,
      dataLength: data?.length || 0,
      hasProductFilter: !!filters.productCode,
      productCode: filters.productCode,
    });

    return { data: data || [], count };
  }

  /**
   * 번역 생성
   */
  async create(data: TranslationCreateData): Promise<Translation> {
    const { data: translation, error } = await this.supabase
      .from('translations')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create translation: ${error.message}`);
    }

    return translation as Translation;
  }

  /**
   * 번역 업데이트
   */
  async update(id: string, updates: TranslationUpdateData): Promise<Translation> {
    const { data, error } = await this.supabase
      .from('translations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update translation: ${error.message}`);
    }

    return data as Translation;
  }

  /**
   * 낙관적 잠금으로 번역 업데이트
   */
  async updateWithLock(
    id: string,
    updates: TranslationUpdateData,
    options: OptimisticLockOptions = {}
  ): Promise<Translation> {
    const { expectedVersion, expectedTimestamp, skipLockCheck } = options;

    // 잠금 검사 (스킵되지 않은 경우)
    if (!skipLockCheck && (expectedVersion !== undefined || expectedTimestamp)) {
      const lockResult = await this.lockService.checkVersion({
        id,
        entityType: 'translation',
        expectedVersion,
        expectedTimestamp,
      });

      if (!lockResult.success) {
        const error = this.lockService.formatConflictError(lockResult);
        const err = new Error(error.message);
        (err as any).code = error.code;
        (err as any).details = error.details;
        throw err;
      }
    }

    // 업데이트 진행
    return this.update(id, updates);
  }

  /**
   * 버전 충돌 여부 확인
   */
  async checkVersion(
    id: string,
    expectedVersion?: number,
    expectedTimestamp?: string
  ): Promise<LockCheckResult> {
    return this.lockService.checkVersion({
      id,
      entityType: 'translation',
      expectedVersion,
      expectedTimestamp,
    });
  }

  /**
   * 번역 삭제
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('translations').delete().eq('id', id);

    if (error) {
      throw new Error(`Failed to delete translation: ${error.message}`);
    }
  }

  /**
   * 다중 상태 일괄 업데이트
   */
  async bulkUpdateStatus(ids: string[], status: TranslationStatus): Promise<void> {
    const { error } = await this.supabase
      .from('translations')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids);

    if (error) {
      throw new Error(`Failed to bulk update translations: ${error.message}`);
    }
  }

  /**
   * 필터로 번역 ID 목록 조회
   */
  async getIdsByFilter(filters: TranslationFilters): Promise<string[]> {
    let query = this.supabase.from('translations').select('id');

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.productCode) {
      query = query.eq('product_code', filters.productCode);
    }

    if (filters.language) {
      query = query.eq('language_code', filters.language);
    }

    if (filters.scope) {
      query = query.eq('scope', filters.scope);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get translation IDs: ${error.message}`);
    }

    return (data || []).map((t) => t.id);
  }

  /**
   * OptimisticLockService 접근자
   */
  getLockService(): OptimisticLockService {
    return this.lockService;
  }
}
