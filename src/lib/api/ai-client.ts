/**
 * AI API Client
 * Type-safe client for AI-related API endpoints (translation, context review)
 */

import { ApiClient } from './client';
import type { LanguageCode } from '@/types/languages';

export interface AiTranslateRequest {
  sourceText: string;
  targetLanguages: LanguageCode[];
  context?: string;
  glossaryTerms?: Array<{
    term: string;
    translation: string;
  }>;
}

export interface AiTranslateResponse {
  translations: Array<{
    language_code: LanguageCode;
    translated_text: string;
  }>;
  cost?: number;
  tokensUsed?: number;
}

export interface AiContextReviewRequest {
  text: string;
  additionalContext?: string;
}

export interface AiContextReviewResponse {
  suggestions: string[];
  improvedContext?: string;
  issues?: string[];
}

export class AiClient extends ApiClient {
  /**
   * Translate text using AI
   */
  async translate(data: AiTranslateRequest): Promise<AiTranslateResponse> {
    return this.post<AiTranslateResponse>('/ai/translate', data);
  }

  /**
   * Get context review suggestions using AI
   */
  async reviewContext(data: AiContextReviewRequest): Promise<AiContextReviewResponse> {
    return this.post<AiContextReviewResponse>('/ai/context-review', data);
  }

  /**
   * Batch translate multiple texts
   */
  async batchTranslate(
    requests: AiTranslateRequest[]
  ): Promise<AiTranslateResponse[]> {
    return this.post<AiTranslateResponse[]>('/ai/translate/batch', { requests });
  }
}

/**
 * Singleton instance of the AI API client
 */
export const aiApi = new AiClient();
