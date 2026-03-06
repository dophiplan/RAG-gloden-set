/**
 * Audit log types for tracking changes across the system
 */

// ============================================================================
// Glossary Audit Logs
// ============================================================================

export type GlossaryAuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'bulk_create'
  | 'bulk_update'
  | 'bulk_delete'
  | 'bulk_approve'
  | 'bulk_reject'
  | 'import';

export interface GlossaryAuditLog {
  id: string;
  glossary_term_id: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: GlossaryAuditAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown> | null;
  batch_operation_id?: string | null;
  is_rolled_back?: boolean;
  rolled_back_at?: string | null;
  created_at: string;
}

// ============================================================================
// User Audit Logs
// ============================================================================

export type UserAuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'bulk_update'
  | 'bulk_delete'
  | 'permission_change';

export interface UserAuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: UserAuditAction;
  target_user_id: string | null;
  target_user_email: string | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Settings Audit Logs
// ============================================================================

export type SettingsAuditAction =
  | 'update_openai_key'
  | 'update_org_settings'
  | 'update_system_settings'
  | 'update_user_settings';

export type SettingCategory = 'openai' | 'organization' | 'system' | 'user';

export interface SettingsAuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: SettingsAuditAction;
  setting_category: SettingCategory;
  setting_key: string | null;
  old_value: string | null;
  new_value: string | null;
  is_sensitive: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Translation Logs (different from TranslationAuditLog)
// ============================================================================

export type TranslationLogAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'translate'
  | 'review'
  | 'deploy'
  | 'status_change';

export interface TranslationLog {
  id: string;
  translation_id: string | null;
  user_id: string | null;
  action: TranslationLogAction;
  details: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// Translator Languages
// ============================================================================

export interface TranslatorLanguage {
  id: string;
  user_id: string;
  language_code: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}
