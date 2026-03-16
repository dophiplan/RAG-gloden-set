-- ============================================================================
-- Migration: Initial Schema
-- Version: 001
-- Description: Supabase PostgreSQL 스키마를 SQLite로 변환
-- 변환 규칙:
--   - UUID → TEXT
--   - TIMESTAMP WITH TIME ZONE → TEXT (ISO 8601)
--   - JSONB → TEXT (JSON)
--   - ARRAY → TEXT (JSON)
--   - RLS/POLICY → 주석 처리 (SQLite 미지원)
-- ============================================================================

-- ============================================================================
-- _migrations 테이블 (마이그레이션 버전 관리)
-- ============================================================================
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  checksum TEXT
);

-- ============================================================================
-- Users 테이블
-- Note: Supabase auth.users 확장 - 로컬에서는 독립 테이블로 관리
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- UUID
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  password_hash TEXT, -- 로컬 인증용 (Supabase에서는 auth.users에 저장)
  account_level TEXT DEFAULT 'user', -- 'user', 'master', '1st_master'
  roles TEXT DEFAULT '["user"]', -- JSON array
  work_fields TEXT DEFAULT '[]', -- JSON array: saas, solution, government, other
  password_reset_required BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_account_level ON users(account_level);

-- ============================================================================
-- Teams 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY, -- UUID
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- Team Members 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY, -- UUID
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- ============================================================================
-- Products 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, -- UUID
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  default_source_language TEXT DEFAULT 'ko',
  default_target_languages TEXT DEFAULT '["en","ja","zh-CN","zh-TW","de","es","pt"]', -- JSON array
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_display_order ON products(display_order);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);

-- 기본 제품 데이터 삽입
INSERT OR IGNORE INTO products (id, code, name, display_order) VALUES
  (lower(hex(randomblob(16))), 'RC', 'RC', 1),
  (lower(hex(randomblob(16))), 'RV', 'RV', 2),
  (lower(hex(randomblob(16))), 'RM', 'RM', 3),
  (lower(hex(randomblob(16))), 'Rfice', 'rfice', 4),
  (lower(hex(randomblob(16))), 'repoto', 'repoto', 5),
  (lower(hex(randomblob(16))), 'RVS', 'RVS', 6),
  (lower(hex(randomblob(16))), 'mobizen', '모비즌', 7),
  (lower(hex(randomblob(16))), 'agent', '에이전트', 8),
  (lower(hex(randomblob(16))), 'marketing', '마케팅', 9);

-- ============================================================================
-- Languages 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS languages (
  id TEXT PRIMARY KEY, -- UUID
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_languages_display_order ON languages(display_order);
CREATE INDEX IF NOT EXISTS idx_languages_code ON languages(code);

-- 기본 언어 데이터 삽입
INSERT OR IGNORE INTO languages (id, code, name, display_order) VALUES
  (lower(hex(randomblob(16))), 'ko', '한국어', 1),
  (lower(hex(randomblob(16))), 'en', '영어', 2),
  (lower(hex(randomblob(16))), 'ja', '일본어', 3),
  (lower(hex(randomblob(16))), 'zh-CN', '중국어 간체', 4),
  (lower(hex(randomblob(16))), 'zh-TW', '중국어 번체', 5),
  (lower(hex(randomblob(16))), 'de', '독일어', 6),
  (lower(hex(randomblob(16))), 'es', '스페인어', 7),
  (lower(hex(randomblob(16))), 'pt', '포르투갈어', 8);

-- ============================================================================
-- Reference Tables (Translation Statuses, Priority Levels, Scopes)
-- ============================================================================

-- Translation Statuses
CREATE TABLE IF NOT EXISTS translation_statuses (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label_ko TEXT NOT NULL,
  label_en TEXT NOT NULL,
  color TEXT NOT NULL,
  bg_color TEXT NOT NULL,
  text_color TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_translation_statuses_sort_order ON translation_statuses(sort_order);

INSERT OR IGNORE INTO translation_statuses (id, code, label_ko, label_en, color, bg_color, text_color, sort_order) VALUES
  (lower(hex(randomblob(16))), 'pending', '번역 요청', 'Pending', 'yellow', 'bg-yellow-100', 'text-yellow-800', 1),
  (lower(hex(randomblob(16))), 'in_progress', '진행 중', 'In Progress', 'purple', 'bg-[#E0E7FF]', 'text-[#4F46E5]', 2),
  (lower(hex(randomblob(16))), 'reviewed', '검수 완료', 'Reviewed', 'gray', 'bg-white', 'text-gray-800', 3),
  (lower(hex(randomblob(16))), 'deployed', '반영 완료', 'Deployed', 'gray', 'bg-gray-100', 'text-gray-500', 4);

-- Priority Levels
CREATE TABLE IF NOT EXISTS priority_levels (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_priority_levels_sort_order ON priority_levels(sort_order);

INSERT OR IGNORE INTO priority_levels (id, code, label, color, sort_order) VALUES
  (lower(hex(randomblob(16))), 'urgent', '긴급', 'bg-red-100 text-red-800', 4),
  (lower(hex(randomblob(16))), 'high', '상', 'bg-orange-100 text-orange-800', 3),
  (lower(hex(randomblob(16))), 'medium', '중', 'bg-yellow-100 text-yellow-800', 2),
  (lower(hex(randomblob(16))), 'low', '하', 'bg-gray-100 text-gray-800', 1);

-- Scopes
CREATE TABLE IF NOT EXISTS scopes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scopes_sort_order ON scopes(sort_order);

INSERT OR IGNORE INTO scopes (id, code, name, sort_order) VALUES
  (lower(hex(randomblob(16))), 'saas', 'SaaS', 1),
  (lower(hex(randomblob(16))), 'solution', 'Solution', 2),
  (lower(hex(randomblob(16))), 'government', '정부과제', 3),
  (lower(hex(randomblob(16))), 'other', '기타', 4);

-- ============================================================================
-- Translations 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS translations (
  id TEXT PRIMARY KEY, -- UUID
  source_text TEXT NOT NULL,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'reviewed', 'deployed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  priority_order INTEGER DEFAULT 0,
  scope TEXT DEFAULT 'saas' CHECK (scope IN ('saas', 'solution', 'government', 'other')),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  version TEXT,
  product_code TEXT REFERENCES products(code) ON DELETE SET NULL,
  version_updated_at TEXT,
  completion_date TEXT,
  request_group_id TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_translations_user_id ON translations(user_id);
CREATE INDEX IF NOT EXISTS idx_translations_team_id ON translations(team_id);
CREATE INDEX IF NOT EXISTS idx_translations_status ON translations(status);
CREATE INDEX IF NOT EXISTS idx_translations_priority ON translations(priority);
CREATE INDEX IF NOT EXISTS idx_translations_product_code ON translations(product_code);
CREATE INDEX IF NOT EXISTS idx_translations_version ON translations(version);
CREATE INDEX IF NOT EXISTS idx_translations_source_text ON translations(source_text);
CREATE INDEX IF NOT EXISTS idx_translations_request_group_id ON translations(request_group_id);
CREATE INDEX IF NOT EXISTS idx_translations_is_deleted ON translations(is_deleted);
CREATE INDEX IF NOT EXISTS idx_translations_completion_date ON translations(completion_date);

-- ============================================================================
-- Translation Results 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS translation_results (
  id TEXT PRIMARY KEY, -- UUID
  translation_id TEXT NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  reviewer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  translation_source TEXT DEFAULT 'manual' CHECK (translation_source IN ('manual', 'ai', 'cache')),
  ai_provider TEXT,
  confidence_score REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(translation_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_translation_results_translation_id ON translation_results(translation_id);
CREATE INDEX IF NOT EXISTS idx_translation_results_language_code ON translation_results(language_code);
CREATE INDEX IF NOT EXISTS idx_translation_results_reviewer_id ON translation_results(reviewer_id);

-- ============================================================================
-- Glossary 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS glossary (
  id TEXT PRIMARY KEY, -- UUID
  term TEXT NOT NULL,
  translation TEXT NOT NULL,
  language_code TEXT NOT NULL,
  context TEXT,
  domain TEXT,
  product_code TEXT REFERENCES products(code) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  hit_count INTEGER DEFAULT 0,
  last_used_at TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_glossary_term ON glossary(term);
CREATE INDEX IF NOT EXISTS idx_glossary_language_code ON glossary(language_code);
CREATE INDEX IF NOT EXISTS idx_glossary_product_code ON glossary(product_code);
CREATE INDEX IF NOT EXISTS idx_glossary_user_id ON glossary(user_id);
CREATE INDEX IF NOT EXISTS idx_glossary_approval_status ON glossary(approval_status);
CREATE INDEX IF NOT EXISTS idx_glossary_is_deleted ON glossary(is_deleted);

-- ============================================================================
-- Translation Products (Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS translation_products (
  id TEXT PRIMARY KEY,
  translation_id TEXT NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL REFERENCES products(code) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(translation_id, product_code)
);

CREATE INDEX IF NOT EXISTS idx_translation_products_translation_id ON translation_products(translation_id);
CREATE INDEX IF NOT EXISTS idx_translation_products_product_code ON translation_products(product_code);

-- ============================================================================
-- Glossary Products (Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS glossary_products (
  id TEXT PRIMARY KEY,
  glossary_id TEXT NOT NULL REFERENCES glossary(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL REFERENCES products(code) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(glossary_id, product_code)
);

CREATE INDEX IF NOT EXISTS idx_glossary_products_glossary_id ON glossary_products(glossary_id);
CREATE INDEX IF NOT EXISTS idx_glossary_products_product_code ON glossary_products(product_code);

-- ============================================================================
-- User Settings 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  openai_api_key TEXT,
  gemini_api_key TEXT,
  claude_api_key TEXT,
  ai_provider TEXT DEFAULT 'openai',
  settings TEXT DEFAULT '{}', -- JSON
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- ============================================================================
-- Organization Settings 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS organization_settings (
  id TEXT PRIMARY KEY,
  org_name TEXT,
  openai_api_key TEXT,
  gemini_api_key TEXT,
  claude_api_key TEXT,
  default_ai_provider TEXT DEFAULT 'openai',
  settings TEXT DEFAULT '{}', -- JSON
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- AI Provider Keys 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_provider_keys (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'gemini', 'claude')),
  api_key TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  is_org_key BOOLEAN DEFAULT FALSE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(provider, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_keys_user_id ON ai_provider_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_keys_provider ON ai_provider_keys(provider);

-- ============================================================================
-- SQLite Triggers for updated_at
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
  AFTER UPDATE ON users
  FOR EACH ROW
  BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_teams_updated_at
  AFTER UPDATE ON teams
  FOR EACH ROW
  BEGIN
    UPDATE teams SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_translations_updated_at
  AFTER UPDATE ON translations
  FOR EACH ROW
  BEGIN
    UPDATE translations SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_translation_results_updated_at
  AFTER UPDATE ON translation_results
  FOR EACH ROW
  BEGIN
    UPDATE translation_results SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_glossary_updated_at
  AFTER UPDATE ON glossary
  FOR EACH ROW
  BEGIN
    UPDATE glossary SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_products_updated_at
  AFTER UPDATE ON products
  FOR EACH ROW
  BEGIN
    UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_languages_updated_at
  AFTER UPDATE ON languages
  FOR EACH ROW
  BEGIN
    UPDATE languages SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_user_settings_updated_at
  AFTER UPDATE ON user_settings
  FOR EACH ROW
  BEGIN
    UPDATE user_settings SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_org_settings_updated_at
  AFTER UPDATE ON organization_settings
  FOR EACH ROW
  BEGIN
    UPDATE organization_settings SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

-- ============================================================================
-- Migration complete
-- ============================================================================
