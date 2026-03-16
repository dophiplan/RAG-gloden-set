/**
 * Supabase Translation Result Repository Implementation
 * 
 * 번역 결과(다국어 번역) 관리를 위한 Supabase 기반 Repository 구현체
 * 
 * @example
 * ```typescript
 * const repo = new SupabaseTranslationResultRepository(supabase);
 * const results = await repo.findByTranslationId('trans-1');
 * await repo.upsert({ translation_id: 'id', language_code: 'ko', translated_text: '안녕' });
 * ```
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  ITranslationResultRepository,
  TranslationResultCreateData,
  TranslationResultUpdateData,
} from '@/repositories/interfaces/translation_result_repository';
import type { TranslationResult, LanguageCode } from '@/types';

export class SupabaseTranslationResultRepository implements ITranslationResultRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 번역 ID로 번역 결과 목록 조회
   */
  async findByTranslationId(translationId: string): Promise<TranslationResult[]> {
    const { data, error } = await this.supabase
      .from('translation_results')
      .select('*')
      .eq('translation_id', translationId);

    if (error) {
      throw new Error(`Failed to find translation results: ${error.message}`);
    }

    return (data || []) as TranslationResult[];
  }

  /**
   * 단일 번역 결과 조회
   */
  async findOne(
    translationId: string,
    languageCode: LanguageCode
  ): Promise<TranslationResult | null> {
    const { data, error } = await this.supabase
      .from('translation_results')
      .select('*')
      .eq('translation_id', translationId)
      .eq('language_code', languageCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find translation result: ${error.message}`);
    }

    return data as TranslationResult;
  }

  /**
   * 번역 ID와 언어 코드로 번역 결과 조회 (findOne 별칭)
   */
  async findByTranslationAndLanguage(
    translationId: string,
    languageCode: LanguageCode
  ): Promise<TranslationResult | null> {
    return this.findOne(translationId, languageCode);
  }

  /**
   * 번역 결과 생성
   */
  async create(result: TranslationResultCreateData): Promise<TranslationResult> {
    const { data, error } = await this.supabase
      .from('translation_results')
      .insert(result)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create translation result: ${error.message}`);
    }

    return data as TranslationResult;
  }

  /**
   * 다중 번역 결과 생성
   */
  async createMany(results: TranslationResultCreateData[]): Promise<TranslationResult[]> {
    if (results.length === 0) return [];

    const { data, error } = await this.supabase
      .from('translation_results')
      .insert(results)
      .select();

    if (error) {
      throw new Error(`Failed to create translation results: ${error.message}`);
    }

    return (data || []) as TranslationResult[];
  }

  /**
   * 번역 결과 업데이트
   */
  async update(
    translationId: string,
    languageCode: LanguageCode,
    updates: TranslationResultUpdateData
  ): Promise<TranslationResult> {
    const { data, error } = await this.supabase
      .from('translation_results')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('translation_id', translationId)
      .eq('language_code', languageCode)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update translation result: ${error.message}`);
    }

    return data as TranslationResult;
  }

  /**
   * 번역 ID로 번역 결과 삭제
   */
  async deleteByTranslationId(translationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('translation_results')
      .delete()
      .eq('translation_id', translationId);

    if (error) {
      throw new Error(`Failed to delete translation results: ${error.message}`);
    }
  }

  /**
   * Upsert (있으면 업데이트, 없으면 생성)
   */
  async upsert(result: TranslationResultCreateData): Promise<TranslationResult> {
    const { data, error } = await this.supabase
      .from('translation_results')
      .upsert(
        {
          ...result,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'translation_id,language_code',
        }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert translation result: ${error.message}`);
    }

    return data as TranslationResult;
  }
}
