/**
 * API Clients Index
 * Central export point for all API clients
 */

export { ApiClient, ApiError, type ApiResponse } from './client';
export { translationsApi, TranslationsClient } from './translations-client';
export { glossaryApi, GlossaryClient } from './glossary-client';
export { aiApi, AiClient } from './ai-client';

export type { TranslationListParams, TranslationListResponse } from './translations-client';
export type { GlossaryListParams, GlossaryListResponse } from './glossary-client';
export type { AiTranslateRequest, AiTranslateResponse } from './ai-client';
