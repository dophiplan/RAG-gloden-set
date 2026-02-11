import type { LanguageCode } from './languages';
import type { ProductCode } from './products';

// Translation status
export type TranslationStatus = 'pending' | 'in_progress' | 'reviewed' | 'deployed';

// Scope types (제품 분류)
export type Scope = 'SaaS' | 'Solution' | '정부과제' | '기타';

export const STATUS_COLORS: Record<TranslationStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '번역 요청' },
  in_progress: { bg: 'bg-[#E0E7FF]', text: 'text-[#4F46E5]', label: '진행 중' },
  reviewed: { bg: 'bg-white', text: 'text-gray-800', label: '검수 완료' },
  deployed: { bg: 'bg-gray-100', text: 'text-gray-500', label: '반영 완료' },
};

// Priority levels
export type PriorityLevel = '긴급' | '상' | '중' | '하';

export const PRIORITY_LABELS: Record<PriorityLevel, {
  label: string;
  color: string;
  sortOrder: number;
}> = {
  '긴급': { label: '긴급', color: 'bg-red-100 text-red-800', sortOrder: 4 },
  '상': { label: '상', color: 'bg-orange-100 text-orange-800', sortOrder: 3 },
  '중': { label: '중', color: 'bg-yellow-100 text-yellow-800', sortOrder: 2 },
  '하': { label: '하', color: 'bg-gray-100 text-gray-800', sortOrder: 1 },
};

// Database types
export interface Translation {
  id: string;
  source_text: string;
  context: string | null;
  status: TranslationStatus;
  priority: PriorityLevel;
  version: string | null;
  version_updated_at: string | null;
  product_code: ProductCode | null; // Deprecated: use translation_products
  created_at: string;
  updated_at: string;
  user_id: string;
  team_id: string | null;
  translation_products?: TranslationProduct[];
  // New fields from Phase 1
  scope: Scope | null;
  work_scope: string[];
  dev_code: string | null;
  notes: string | null;
  completion_rate: number;
  platform_completions: Record<string, {
    completed: boolean;
    completed_at?: string;
    completed_by?: string;
  }>;
  completion_date?: string | null; // ISO date format (YYYY-MM-DD)
  is_migrated?: boolean;
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
  source_type?: 'glossary' | 'ai' | 'manual' | 'imported' | null;
  glossary_term_id?: string | null;
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
  scope?: Scope;
  priority?: PriorityLevel;
  translations?: {
    language_code: LanguageCode;
    translated_text: string;
  }[];
  completion_date?: string;
}

export interface TranslationUpdateInput {
  source_text?: string;
  context?: string;
  status?: TranslationStatus;
  version?: string;
  product_code?: ProductCode; // Deprecated
  product_codes?: ProductCode[]; // Use this for multiple products
  scope?: 'SaaS' | 'Solution' | null;
  priority?: PriorityLevel;
  notes?: string | null;
  updated_at?: string; // For optimistic locking - send current timestamp to detect conflicts
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

// Dashboard request types
export interface DashboardRequest {
  id: string; // request_id (for grouped) or translation_id (for individual)
  translation_ids: string[]; // Array of translation IDs in this request
  translation_count: number; // Number of translations in this request
  status: TranslationStatus;
  priority: PriorityLevel;
  request_date: string; // ISO timestamp
  deployed_at: string | null; // ISO timestamp or null
  requester: {
    id: string;
    name: string | null;
    email: string;
  };
  products: {
    code: ProductCode;
    name: string;
    version: string | null;
    category: Scope | null;
  }[];
}

export interface DashboardRequestsResponse {
  requests: DashboardRequest[];
}
