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
  glossary_products?: GlossaryProduct[];
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
