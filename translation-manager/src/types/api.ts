import type { Translation, TranslationResult } from './translations';

// API types
export interface ExtractedText {
  text: string;
  lineNumber: number;
  matchType: 'single_quote' | 'double_quote';
}

export interface DuplicateCheckResult {
  text: string;
  status: 'exact_match' | 'similar' | 'new';
  similarity?: number;
  existingTranslation?: Translation & { results: TranslationResult[] };
}

export interface AIContextReviewResult {
  text: string;
  issues: {
    type: 'terminology' | 'tone' | 'brand';
    description: string;
    suggestion: string;
    severity: 'warning' | 'error';
  }[];
  isConsistent: boolean;
}

// Holiday types
export interface Holiday {
  id: string;
  country_code: 'KR' | 'JP';
  holiday_date: string;
  name: string;
  recurring: boolean;
  created_at: string;
}

// Organization settings
export interface OrganizationSettings {
  id: string;
  domain: string;
  openai_api_key: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
