-- ============================================================================
-- Migration: Add Audit Logs and Additional Tables
-- Version: 002
-- Description: 감사 로그, 번역 교정, 이슈 관리 등 추가 테이블 생성
-- ============================================================================

-- ============================================================================
-- Translation Audit Logs 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS translation_audit_logs (
  id TEXT PRIMARY KEY,
  translation_id TEXT REFERENCES translations(id) ON DELETE CASCADE,
  translation_result_id TEXT REFERENCES translation_results(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'ai_translate', 'bulk_create', 'bulk_update', 'bulk_delete', 'import', 'export')),
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  metadata TEXT DEFAULT '{}', -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_translation_audit_logs_translation_id ON translation_audit_logs(translation_id);
CREATE INDEX IF NOT EXISTS idx_translation_audit_logs_translation_result_id ON translation_audit_logs(translation_result_id);
CREATE INDEX IF NOT EXISTS idx_translation_audit_logs_user_id ON translation_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_translation_audit_logs_action ON translation_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_translation_audit_logs_created_at ON translation_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_translation_audit_logs_translation_created 
  ON translation_audit_logs(translation_id, created_at DESC);

-- ============================================================================
-- Glossary Audit Logs 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS glossary_audit_logs (
  id TEXT PRIMARY KEY,
  glossary_term_id TEXT REFERENCES glossary(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'create', 'update', 'delete', 'approve', 'reject', 
    'bulk_create', 'bulk_update', 'bulk_delete', 'bulk_approve', 'bulk_reject', 'import'
  )),
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  metadata TEXT DEFAULT '{}', -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_glossary_audit_logs_term_id ON glossary_audit_logs(glossary_term_id);
CREATE INDEX IF NOT EXISTS idx_glossary_audit_logs_user_id ON glossary_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_glossary_audit_logs_action ON glossary_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_glossary_audit_logs_created_at ON glossary_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_glossary_audit_logs_term_created 
  ON glossary_audit_logs(glossary_term_id, created_at DESC);

-- ============================================================================
-- User Settings Audit Logs 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_settings_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT,
  user_email TEXT,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_settings_audit_logs_user_id ON user_settings_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_audit_logs_created_at ON user_settings_audit_logs(created_at DESC);

-- ============================================================================
-- Translation Corrections 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS translation_corrections (
  id TEXT PRIMARY KEY,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  source_text TEXT NOT NULL,
  language_code TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_applied BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_translation_corrections_language_code ON translation_corrections(language_code);
CREATE INDEX IF NOT EXISTS idx_translation_corrections_source_text ON translation_corrections(source_text);
CREATE INDEX IF NOT EXISTS idx_translation_corrections_created_at ON translation_corrections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_translation_corrections_user_id ON translation_corrections(user_id);

-- ============================================================================
-- Translation Logs 테이블 (번역 히스토리)
-- ============================================================================
CREATE TABLE IF NOT EXISTS translation_logs (
  id TEXT PRIMARY KEY,
  translation_result_id TEXT NOT NULL REFERENCES translation_results(id) ON DELETE CASCADE,
  previous_text TEXT NOT NULL,
  new_text TEXT NOT NULL,
  changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  change_reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_translation_logs_result_id ON translation_logs(translation_result_id);
CREATE INDEX IF NOT EXISTS idx_translation_logs_created_at ON translation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_translation_logs_changed_by ON translation_logs(changed_by);

-- ============================================================================
-- Issues 테이블 (번역 관련 이슈 관리)
-- ============================================================================
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  product_code TEXT REFERENCES products(code) ON DELETE SET NULL,
  issue_type TEXT NOT NULL CHECK (
    issue_type IN ('pdf_parse_error', 'image_parse_error', 'duplicate_text', 'validation_error', 'other')
  ),
  description TEXT NOT NULL,
  file_names TEXT DEFAULT '[]', -- JSON array
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_issues_product_code ON issues(product_code);
CREATE INDEX IF NOT EXISTS idx_issues_issue_type ON issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_issues_resolved ON issues(resolved);
CREATE INDEX IF NOT EXISTS idx_issues_user_id ON issues(user_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_issues_updated_at
  AFTER UPDATE ON issues
  FOR EACH ROW
  BEGIN
    UPDATE issues SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

-- ============================================================================
-- Translator Languages 테이블 (번역가별 언어 설정)
-- ============================================================================
CREATE TABLE IF NOT EXISTS translator_languages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  proficiency_level TEXT DEFAULT 'native' CHECK (proficiency_level IN ('native', 'fluent', 'intermediate', 'beginner')),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_translator_languages_user_id ON translator_languages(user_id);
CREATE INDEX IF NOT EXISTS idx_translator_languages_language_code ON translator_languages(language_code);

CREATE TRIGGER IF NOT EXISTS trg_translator_languages_updated_at
  AFTER UPDATE ON translator_languages
  FOR EACH ROW
  BEGIN
    UPDATE translator_languages SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

-- ============================================================================
-- Translation Platforms 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS translation_platforms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  deploy_status TEXT DEFAULT 'pending' CHECK (deploy_status IN ('pending', 'in_progress', 'completed', 'failed')),
  last_deployed_at TEXT,
  last_deployed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  settings TEXT DEFAULT '{}', -- JSON
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_translation_platforms_code ON translation_platforms(code);
CREATE INDEX IF NOT EXISTS idx_translation_platforms_deploy_status ON translation_platforms(deploy_status);

CREATE TRIGGER IF NOT EXISTS trg_translation_platforms_updated_at
  AFTER UPDATE ON translation_platforms
  FOR EACH ROW
  BEGIN
    UPDATE translation_platforms SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

-- ============================================================================
-- Glossary Transactions 테이블 (용어집 변경 트랜잭션)
-- ============================================================================
CREATE TABLE IF NOT EXISTS glossary_transactions (
  id TEXT PRIMARY KEY,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('import', 'bulk_update', 'bulk_delete', 'bulk_approve')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'rolled_back')),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT,
  affected_count INTEGER DEFAULT 0,
  metadata TEXT DEFAULT '{}', -- JSON
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  rolled_back_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_glossary_transactions_user_id ON glossary_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_glossary_transactions_status ON glossary_transactions(status);
CREATE INDEX IF NOT EXISTS idx_glossary_transactions_created_at ON glossary_transactions(created_at DESC);

-- ============================================================================
-- Glossary Rollback History 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS glossary_rollback_history (
  id TEXT PRIMARY KEY,
  transaction_id TEXT REFERENCES glossary_transactions(id) ON DELETE CASCADE,
  glossary_term_id TEXT NOT NULL,
  previous_data TEXT NOT NULL, -- JSON (이전 상태 저장)
  rolled_back_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  rolled_back_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_glossary_rollback_history_transaction_id ON glossary_rollback_history(transaction_id);
CREATE INDEX IF NOT EXISTS idx_glossary_rollback_history_term_id ON glossary_rollback_history(glossary_term_id);

-- ============================================================================
-- Rate Limiting 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key TEXT,
  request_count INTEGER DEFAULT 0,
  window_start TEXT NOT NULL, -- ISO 8601 timestamp
  window_end TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start, window_end);

-- ============================================================================
-- API Key Access Logs 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_key_access_logs (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  api_key_type TEXT NOT NULL CHECK (api_key_type IN ('user', 'organization')),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  status_code INTEGER,
  response_time_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_key_access_logs_api_key_id ON api_key_access_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_access_logs_user_id ON api_key_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_key_access_logs_created_at ON api_key_access_logs(created_at DESC);

-- ============================================================================
-- Comments/Notes 테이블 (번역에 대한 코멘트)
-- ============================================================================
CREATE TABLE IF NOT EXISTS translation_comments (
  id TEXT PRIMARY KEY,
  translation_id TEXT NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  translation_result_id TEXT REFERENCES translation_results(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id TEXT REFERENCES translation_comments(id) ON DELETE CASCADE,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_translation_comments_translation_id ON translation_comments(translation_id);
CREATE INDEX IF NOT EXISTS idx_translation_comments_result_id ON translation_comments(translation_result_id);
CREATE INDEX IF NOT EXISTS idx_translation_comments_user_id ON translation_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_translation_comments_parent_id ON translation_comments(parent_id);

CREATE TRIGGER IF NOT EXISTS trg_translation_comments_updated_at
  AFTER UPDATE ON translation_comments
  FOR EACH ROW
  BEGIN
    UPDATE translation_comments SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

-- ============================================================================
-- Migration complete
-- ============================================================================
