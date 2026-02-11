import type { LanguageCode } from './languages';
import type { ProductCode } from './products';

export interface GlossaryTerm {
  id: string;
  term: string;
  translation: string;
  language_code: LanguageCode;
  context: string | null;
  product_code: ProductCode | null; // Deprecated: use glossary_products
  user_id: string;
  team_id: string | null;
  created_at: string;
  updated_at: string;
  source_type: 'manual' | 'excel_import' | 'ai_generated';
  imported_at: string | null;
  hit_count: number;
  glossary_products?: GlossaryProduct[];
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  approved_at?: string | null;
}

export interface GlossaryProduct {
  id: string;
  glossary_id: string;
  product_code: ProductCode;
  version: string | null;
  version_updated_at: string | null;
  created_at: string;
}

export interface GlossaryCreateInput {
  term: string;
  translation: string;
  language_code: LanguageCode;
  context?: string;
  product_code?: ProductCode; // Deprecated
  product_codes?: ProductCode[]; // Use this for multiple products
}

export interface GlossaryImportResponse {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}

export interface GlossaryImportRow {
  term: string;
  translation: string;
  language_code: string;
  product_code?: string;
  context?: string;
}
