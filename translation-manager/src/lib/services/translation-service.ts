/**
 * Translation Service
 * Business logic layer for translation operations
 *
 * This is a template/example showing the recommended service layer pattern.
 * Use this as a reference when refactoring existing API routes.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Translation,
  TranslationCreateInput,
  TranslationUpdateInput,
  TranslationStatus,
  TranslationResult,
} from '@/types/translations';
import type { LanguageCode } from '@/types/languages';
import type { ProductCode } from '@/types/products';
import {
  DatabaseError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';

/**
 * Translation Service Class
 * Encapsulates all translation-related business logic
 */
export class TranslationService {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  /**
   * Create a new translation
   */
  async create(input: TranslationCreateInput): Promise<Translation> {
    // Validate input
    if (!input.source_text?.trim()) {
      throw new ValidationError('원문은 필수입니다.');
    }

    try {
      // 1. Create translation record
      const { data: translation, error } = await this.supabase
        .from('translations')
        .insert({
          source_text: input.source_text,
          context: input.context || null,
          scope: input.scope || null,
          status: 'pending' as TranslationStatus,
          user_id: this.userId,
        })
        .select()
        .single();

      if (error) throw new DatabaseError('번역 생성 실패', error);
      if (!translation) throw new DatabaseError('번역 생성 실패: 데이터 없음');

      // 2. Create product links if specified
      if (input.product_codes && input.product_codes.length > 0) {
        await this.linkProducts(translation.id, input.product_codes);
      } else if (input.product_code) {
        // Support deprecated single product_code
        await this.linkProducts(translation.id, [input.product_code]);
      }

      // 3. Create translation results if provided
      if (input.translations && input.translations.length > 0) {
        await this.createResults(translation.id, input.translations);
      }

      // 4. Create audit log
      await this.createAuditLog(translation.id, 'create', null, input.source_text);

      // 5. Fetch complete translation with relations
      return this.getById(translation.id);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('번역 생성 중 오류 발생');
    }
  }

  /**
   * Update an existing translation
   */
  async update(id: string, input: TranslationUpdateInput): Promise<Translation> {
    try {
      // Fetch existing translation
      const existing = await this.getById(id);

      // Build update object
      const updates: Partial<Translation> = {};
      if (input.source_text !== undefined) updates.source_text = input.source_text;
      if (input.context !== undefined) updates.context = input.context;
      if (input.status !== undefined) updates.status = input.status;
      if (input.scope !== undefined) updates.scope = input.scope;

      // Update translation
      const { data: translation, error } = await this.supabase
        .from('translations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new DatabaseError('번역 수정 실패', error);
      if (!translation) throw new NotFoundError('번역');

      // Update product links if specified
      if (input.product_codes) {
        await this.updateProductLinks(id, input.product_codes);
      } else if (input.product_code) {
        await this.updateProductLinks(id, [input.product_code]);
      }

      // Create audit logs for changed fields
      for (const [key, value] of Object.entries(updates)) {
        const oldValue = existing[key as keyof Translation];
        if (oldValue !== value) {
          await this.createAuditLog(
            id,
            'update',
            String(oldValue),
            String(value),
            key
          );
        }
      }

      return this.getById(id);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('번역 수정 중 오류 발생');
    }
  }

  /**
   * Delete a translation
   */
  async delete(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('translations')
        .delete()
        .eq('id', id);

      if (error) throw new DatabaseError('번역 삭제 실패', error);

      await this.createAuditLog(id, 'delete', null, null);
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError('번역 삭제 중 오류 발생');
    }
  }

  /**
   * Get translation by ID with all relations
   */
  async getById(id: string): Promise<Translation> {
    const { data, error } = await this.supabase
      .from('translations')
      .select(`
        *,
        translation_products (
          id,
          product_code,
          version,
          version_updated_at,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw new DatabaseError('번역 조회 실패', error);
    if (!data) throw new NotFoundError('번역');

    return data as Translation;
  }

  /**
   * Get translation results for a translation
   */
  async getResults(translationId: string): Promise<TranslationResult[]> {
    const { data, error } = await this.supabase
      .from('translation_results')
      .select('*')
      .eq('translation_id', translationId)
      .order('language_code');

    if (error) throw new DatabaseError('번역 결과 조회 실패', error);
    return data || [];
  }

  /**
   * Update translation result (translated text for a specific language)
   */
  async updateResult(
    translationId: string,
    languageCode: LanguageCode,
    translatedText: string
  ): Promise<Translation> {
    try {
      // Upsert translation result
      const { error } = await this.supabase
        .from('translation_results')
        .upsert({
          translation_id: translationId,
          language_code: languageCode,
          translated_text: translatedText,
        });

      if (error) throw new DatabaseError('번역 결과 수정 실패', error);

      await this.createAuditLog(
        translationId,
        'update',
        null,
        translatedText,
        `result_${languageCode}`
      );

      return this.getById(translationId);
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError('번역 결과 수정 중 오류 발생');
    }
  }

  // ===== Private Helper Methods =====

  /**
   * Create translation results
   */
  private async createResults(
    translationId: string,
    translations: Array<{ language_code: LanguageCode; translated_text: string }>
  ): Promise<void> {
    const results = translations.map((t) => ({
      translation_id: translationId,
      language_code: t.language_code,
      translated_text: t.translated_text,
    }));

    const { error } = await this.supabase
      .from('translation_results')
      .insert(results);

    if (error) throw new DatabaseError('번역 결과 생성 실패', error);
  }

  /**
   * Link products to translation
   */
  private async linkProducts(
    translationId: string,
    productCodes: ProductCode[]
  ): Promise<void> {
    const links = productCodes.map((code) => ({
      translation_id: translationId,
      product_code: code,
    }));

    const { error } = await this.supabase
      .from('translation_products')
      .insert(links);

    if (error) throw new DatabaseError('제품 연결 실패', error);
  }

  /**
   * Update product links
   */
  private async updateProductLinks(
    translationId: string,
    productCodes: ProductCode[]
  ): Promise<void> {
    // Delete existing links
    await this.supabase
      .from('translation_products')
      .delete()
      .eq('translation_id', translationId);

    // Create new links
    if (productCodes.length > 0) {
      await this.linkProducts(translationId, productCodes);
    }
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    translationId: string,
    action: 'create' | 'update' | 'delete' | 'ai_translate',
    oldValue: string | null,
    newValue: string | null,
    fieldName?: string
  ): Promise<void> {
    // Get user info
    const { data: user } = await this.supabase
      .from('users')
      .select('name, email')
      .eq('id', this.userId)
      .single();

    this.supabase.from('translation_audit_logs').insert({
      translation_id: translationId,
      user_id: this.userId,
      user_name: user?.name || null,
      user_email: user?.email || null,
      action,
      field_name: fieldName || null,
      old_value: oldValue,
      new_value: newValue,
    }).catch(err => {
      console.error('[Audit Log] Failed to log translation audit:', err);
      // Don't throw - audit log failure should not break the main operation
    });
  }
}
