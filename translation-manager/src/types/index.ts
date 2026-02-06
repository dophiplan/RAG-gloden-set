// Supported languages
export const SUPPORTED_LANGUAGES = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  'zh-CN': '中文(简体)',
  'zh-TW': '中文(繁體)',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

// Products
export const PRODUCTS = {
  RC: 'RC',
  RV: 'RV',
  RM: 'RM',
  Rfice: 'rfice',
  repoto: 'repoto',
  RVS: 'RVS',
  mobizen: '모비즌',
  agent: '에이전트',
  marketing: '마케팅',
} as const;

// Work scope options for translation table
export const WORK_SCOPE_OPTIONS = [
  'Win',
  'Mac',
  'Front',
  'Back',
  'Android',
  'iOS',
  'flutter',
  '기타',
] as const;

// User work scope options (broader scope for user settings)
export const USER_WORK_SCOPE_OPTIONS = [
  '기획',
  '디자인',
  'PM',
  'PL',
  'Win',
  'Mac',
  'Front',
  'Back',
  'Android',
  'iOS',
  'flutter',
  '번역',
  '검수',
] as const;

// User role labels for display
export const USER_ROLE_LABELS: Record<string, string> = {
  master: '마스터',
  translator_ja: '일본어 번역',
  translator_zh: '중국어 번역',
  translator_en: '영어 번역',
  reviewer_ja: '일본어 검수',
  reviewer_zh: '중국어 검수',
  reviewer_en: '영어 검수',
  requester: '요청',
  deployer: '반영',
  pm: 'PM',
  pl: 'PL',
};

// Work language options
export const WORK_LANGUAGE_OPTIONS = [
  '전체',
  '영어',
  '일본어',
  '중국어',
  '프랑스어',
  '포르투갈어',
  '독일어',
] as const;

export type ProductCode = keyof typeof PRODUCTS;

export interface Product {
  id: string;
  code: ProductCode;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
}

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

export type UserRole =
  | 'master'
  | 'translator_ja' | 'translator_zh' | 'translator_en'
  | 'reviewer_ja' | 'reviewer_zh' | 'reviewer_en'
  | 'requester'
  | 'deployer'
  | 'pm'
  | 'pl';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  // New fields from Phase 1
  roles: UserRole[];
  work_products: ProductCode[];
  work_scope: string[];
  work_languages: string[];
}

export interface Team {
  id: string;
  name: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
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

// User settings
export interface UserSettings {
  id: string;
  user_id: string;
  openai_api_key: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

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

export interface GlossaryCreateInput {
  term: string;
  translation: string;
  language_code: LanguageCode;
  context?: string;
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

// Email types
export type EmailTemplateType =
  | 'translation_request'
  | 'review_request'
  | 'translation_complete'
  | 'deployment_complete';

export interface EmailTemplate {
  id: string;
  template_type: EmailTemplateType;
  subject: string;
  body_html: string;
  body_text: string;
  default_deadline_days: number;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  template_type: EmailTemplateType;
  translation_ids: string[];
  sender_id: string | null;
  recipients: {
    to: string[];
    cc: string[];
  };
  subject: string;
  body_html: string | null;
  custom_message: string | null;
  deadline: string | null;
  sent_at: string | null;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  created_at: string;
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

// Issue types
export type IssueType = 'pdf_parse_error' | 'image_parse_error' | 'duplicate_text' | 'validation_error';

export interface Issue {
  id: string;
  product_code: ProductCode | null;
  issue_type: IssueType;
  description: string;
  file_names: string[];
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// Organization settings
export interface OrganizationSettings {
  id: string;
  domain: string;
  openai_api_key: string | null;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}
