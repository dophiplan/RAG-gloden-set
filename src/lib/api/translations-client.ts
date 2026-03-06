/**
 * Translations API Client
 * Type-safe client for translation-related API endpoints
 */

import { ApiClient } from './client';
import type {
  Translation,
  TranslationCreateInput,
  TranslationUpdateInput,
  TranslationStatus,
} from '@/types/translations';
import type { ProductCode } from '@/types/products';
import type { LanguageCode } from '@/types/languages';
import type { ScopeType } from '@/types/common';

export interface TranslationListParams {
  status?: TranslationStatus;
  product_code?: ProductCode;
  search?: string;
  scope?: 'SaaS' | 'Solution';
  page?: number;
  limit?: number;
}

export interface TranslationListResponse {
  translations: Translation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TranslationBulkUpdateInput {
  ids: string[];
  updates: {
    status?: TranslationStatus;
    scope?: 'SaaS' | 'Solution' | null;
  };
}

export interface TranslationResultUpdateInput {
  translationId: string;
  languageCode: LanguageCode;
  translatedText: string;
}

export class TranslationsClient extends ApiClient {
  /**
   * Get list of translations with optional filters
   */
  async list(params?: TranslationListParams): Promise<TranslationListResponse> {
    const query = new URLSearchParams();

    if (params?.status) query.set('status', params.status);
    if (params?.product_code) query.set('product_code', params.product_code);
    if (params?.search) query.set('search', params.search);
    if (params?.scope) query.set('scope', params.scope);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());

    const queryString = query.toString();
    const path = queryString ? `/translations?${queryString}` : '/translations';

    return this.get<TranslationListResponse>(path);
  }

  /**
   * Get a single translation by ID
   */
  async getById(id: string): Promise<Translation> {
    return this.get<Translation>(`/translations/${id}`);
  }

  /**
   * Create a new translation
   */
  async create(data: TranslationCreateInput): Promise<Translation> {
    return this.post<Translation>('/translations', data);
  }

  /**
   * Update a translation
   */
  async update(id: string, data: TranslationUpdateInput): Promise<Translation> {
    return this.patch<Translation>(`/translations/${id}`, data);
  }

  /**
   * Update translation status
   */
  async updateStatus(id: string, status: TranslationStatus): Promise<Translation> {
    return this.update(id, { status });
  }

  /**
   * Update source text
   */
  async updateSourceText(id: string, sourceText: string): Promise<Translation> {
    return this.update(id, { source_text: sourceText });
  }

  /**
   * Update scope
   */
  async updateScope(id: string, scope: ScopeType | null): Promise<Translation> {
    return this.update(id, { scope });
  }

  /**
   * Delete a translation
   */
  async deleteById(id: string): Promise<void> {
    return this.delete<void>(`/translations/${id}`);
  }

  /**
   * Bulk update translations
   */
  async bulkUpdate(data: TranslationBulkUpdateInput): Promise<{ updated: number }> {
    return this.post<{ updated: number }>('/translations/bulk', data);
  }

  /**
   * Update a translation result (translated text for a specific language)
   */
  async updateResult(data: TranslationResultUpdateInput): Promise<Translation> {
    return this.patch<Translation>(
      `/translations/${data.translationId}/results/${data.languageCode}`,
      { translated_text: data.translatedText }
    );
  }

  /**
   * Request AI translation
   */
  async requestAiTranslation(id: string): Promise<Translation> {
    return this.post<Translation>(`/translations/${id}/ai-translate`);
  }

  /**
   * Update platform completion status
   */
  async updatePlatformCompletion(
    id: string,
    platform: string,
    completed: boolean
  ): Promise<Translation> {
    return this.patch<Translation>(`/translations/${id}/platform/${platform}`, {
      completed,
    });
  }
}

/**
 * Singleton instance of the translations API client
 */
export const translationsApi = new TranslationsClient();
