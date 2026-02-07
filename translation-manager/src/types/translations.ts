import type { LanguageCode } from './languages';
import type { ProductCode } from './products';

// Translation status
export type TranslationStatus = 'pending' | 'reviewed' | 'deployed';

export const STATUS_COLORS: Record<TranslationStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '번역 요청' },
  reviewed: { bg: 'bg-white', text: 'text-gray-800', label: '검수 완료' },
  deployed: { bg: 'bg-gray-100', text: 'text-gray-500', label: '반영 완료' },
};

// Database types
export interface Translation {
  id: string;
  source_text: string;
  context: string | null;
  status: TranslationStatus;
  version: string | null;
  version_updated_at: string | null;
  product_code: ProductCode | null; // Deprecated: use translation_products
  created_at: string;
  updated_at: string;
  user_id: string;
  team_id: string | null;
  translation_products?: TranslationProduct[];
  // New fields from Phase 1
  scope: 'SaaS' | 'Solution' | null;
  work_scope: string[];
  dev_code: string | null;
  notes: string | null;
  completion_rate: number;
  platform_completions: Record<string, {
    completed: boolean;
    completed_at?: string;
    completed_by?: string;
  }>;
}

export interface TranslationProduct {
  id: string;
  translation_id: string;
  product_code: ProductCode;
  version: string | null;
  version_updated_at: string | null;
  created_at: string;
}

export interface TranslationResult {
  id: string;
  translation_id: string;
  language_code: LanguageCode;
  translated_text: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Audit log types
export type AuditAction = 'create' | 'update' | 'delete' | 'ai_translate';

export interface TranslationAuditLog {
  id: string;
  translation_id: string | null;
  translation_result_id: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: AuditAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

// Form types
export interface TranslationCreateInput {
  source_text: string;
  context?: string;
  version?: string;
  product_code?: ProductCode; // Deprecated
  product_codes?: ProductCode[]; // Use this for multiple products
  translations?: {
    language_code: LanguageCode;
    translated_text: string;
  }[];
}

export interface TranslationUpdateInput {
  source_text?: string;
  context?: string;
  status?: TranslationStatus;
  version?: string;
  product_code?: ProductCode; // Deprecated
  product_codes?: ProductCode[]; // Use this for multiple products
}

// Dashboard stats
export interface DashboardStats {
  total: number;
  pending: number;
  reviewed: number;
  deployed: number;
  recentActivity: {
    id: string;
    action: string;
    text: string;
    created_at: string;
  }[];
}

// Version group
export interface VersionGroup {
  version: string;
  version_updated_at: string | null;
  translations: (Translation & { translation_results: TranslationResult[] })[];
}
