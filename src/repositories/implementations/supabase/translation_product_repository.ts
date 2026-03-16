/**
 * Supabase Translation Product Repository Implementation
 * 
 * 번역-제품 간 다대다 관계 관리를 위한 Supabase 기반 Repository 구현체
 * 
 * @example
 * ```typescript
 * const repo = new SupabaseTranslationProductRepository(supabase);
 * await repo.updateForTranslation('trans-1', ['RC', 'RV']);
 * ```
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  ITranslationProductRepository,
  TranslationProductCreateData,
} from '@/repositories/interfaces/translation_product_repository';
import type { TranslationProduct, ProductCode } from '@/types';

export class SupabaseTranslationProductRepository implements ITranslationProductRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 다중 번역-제품 연결 생성
   */
  async createMany(links: TranslationProductCreateData[]): Promise<TranslationProduct[]> {
    if ((links || []).length === 0) return [];

    const { data, error } = await this.supabase
      .from('translation_products')
      .insert(links)
      .select();

    if (error) {
      throw new Error(`Failed to create translation-product links: ${error.message}`);
    }

    return (data || []) as TranslationProduct[];
  }

  /**
   * 번역 ID로 연결 목록 조회
   */
  async findByTranslationId(translationId: string): Promise<TranslationProduct[]> {
    const { data, error } = await this.supabase
      .from('translation_products')
      .select('*')
      .eq('translation_id', translationId);

    if (error) {
      throw new Error(`Failed to find translation-product links: ${error.message}`);
    }

    return (data || []) as TranslationProduct[];
  }

  /**
   * 번역 ID로 연결 삭제
   */
  async deleteByTranslationId(translationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('translation_products')
      .delete()
      .eq('translation_id', translationId);

    if (error) {
      throw new Error(`Failed to delete translation-product links: ${error.message}`);
    }
  }

  /**
   * 번역의 제품 연결 업데이트 (삭제 후 생성)
   */
  async updateForTranslation(
    translationId: string,
    productCodes: ProductCode[]
  ): Promise<TranslationProduct[]> {
    // 기존 연결 삭제
    await this.deleteByTranslationId(translationId);

    // 새 연결 생성
    if ((productCodes || []).length === 0) return [];

    const links = (productCodes || []).map((code) => ({
      translation_id: translationId,
      product_code: code,
    }));

    return this.createMany(links);
  }
}
