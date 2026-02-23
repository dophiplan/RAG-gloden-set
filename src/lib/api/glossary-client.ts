/**
 * Glossary API Client
 * Type-safe client for glossary-related API endpoints
 */

import { ApiClient } from './client';
import type { GlossaryTerm, GlossaryCreateInput } from '@/types/glossary';
import type { ProductCode } from '@/types/products';
import type { LanguageCode } from '@/types/languages';

export interface GlossaryListParams {
  language_code?: LanguageCode;
  product_code?: ProductCode;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GlossaryListResponse {
  terms: GlossaryTerm[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GlossaryUpdateInput {
  term?: string;
  translation?: string;
  language_code?: LanguageCode;
  context?: string | null;
  product_code?: ProductCode;
  product_codes?: ProductCode[];
}

export class GlossaryClient extends ApiClient {
  /**
   * Get list of glossary terms with optional filters
   */
  async list(params?: GlossaryListParams): Promise<GlossaryListResponse> {
    const query = new URLSearchParams();

    if (params?.language_code) query.set('language_code', params.language_code);
    if (params?.product_code) query.set('product_code', params.product_code);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());

    const queryString = query.toString();
    const path = queryString ? `/glossary?${queryString}` : '/glossary';

    return this.get<GlossaryListResponse>(path);
  }

  /**
   * Get a single glossary term by ID
   */
  async getById(id: string): Promise<GlossaryTerm> {
    return this.get<GlossaryTerm>(`/glossary/${id}`);
  }

  /**
   * Create a new glossary term
   */
  async create(data: GlossaryCreateInput): Promise<GlossaryTerm> {
    return this.post<GlossaryTerm>('/glossary', data);
  }

  /**
   * Update a glossary term
   */
  async update(id: string, data: GlossaryUpdateInput): Promise<GlossaryTerm> {
    return this.patch<GlossaryTerm>(`/glossary/${id}`, data);
  }

  /**
   * Delete a glossary term
   */
  async deleteById(id: string): Promise<void> {
    return this.delete<void>(`/glossary/${id}`);
  }

  /**
   * Search for glossary matches in text
   */
  async searchInText(text: string, languageCode: LanguageCode): Promise<{
    matches: Array<{
      term: string;
      translation: string;
      context?: string | null;
    }>;
  }> {
    return this.post('/glossary/search', { text, language_code: languageCode });
  }
}

/**
 * Singleton instance of the glossary API client
 */
export const glossaryApi = new GlossaryClient();
