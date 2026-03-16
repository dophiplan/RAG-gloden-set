/**
 * Test Data Factory
 * 
 * 통합 테스트용 데이터 생성 헬퍼
 * 일관된 테스트 데이터를 쉽게 생성할 수 있는 팩토리 함수 제공
 */

import { randomUUID } from 'crypto';
import type { SqliteDatabase } from '@/lib/database/sqlite';

// ============================================================================
// Types
// ============================================================================

export interface TestUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  password_hash: string | null;
  account_level: 'user' | 'master' | '1st_master';
  roles: string; // JSON array string
  work_fields: string; // JSON array string
  password_reset_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface TestProduct {
  id: string;
  code: string;
  name: string;
  description: string | null;
  default_source_language: string;
  default_target_languages: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TestLanguage {
  id: string;
  code: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TestTranslation {
  id: string;
  source_text: string;
  context: string | null;
  status: 'pending' | 'in_progress' | 'reviewed' | 'deployed';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  priority_order: number;
  scope: 'saas' | 'solution' | 'government' | 'other';
  user_id: string;
  team_id: string | null;
  version: string | null;
  product_code: string | null;
  version_updated_at: string | null;
  completion_date: string | null;
  request_group_id: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestTranslationResult {
  id: string;
  translation_id: string;
  language_code: string;
  translated_text: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  translation_source: 'manual' | 'ai' | 'cache';
  ai_provider: string | null;
  confidence_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface TestGlossary {
  id: string;
  term: string;
  translation: string;
  language_code: string;
  context: string | null;
  domain: string | null;
  product_code: string | null;
  user_id: string;
  team_id: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  hit_count: number;
  last_used_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// User Factory
// ============================================================================

export interface CreateUserOptions {
  email?: string;
  name?: string;
  accountLevel?: TestUser['account_level'];
  roles?: string[];
  avatarUrl?: string;
  passwordHash?: string;
}

let userCounter = 0;

export function createUserData(options: CreateUserOptions = {}): Omit<TestUser, 'id' | 'created_at' | 'updated_at'> {
  userCounter++;
  return {
    email: options.email ?? `test-user-${userCounter}@example.com`,
    name: options.name ?? `Test User ${userCounter}`,
    account_level: options.accountLevel ?? 'user',
    roles: JSON.stringify(options.roles ?? ['user']),
    work_fields: JSON.stringify([]),
    avatar_url: options.avatarUrl ?? null,
    password_hash: options.passwordHash ?? null,
    password_reset_required: false,
  };
}

export async function insertUser(
  db: SqliteDatabase,
  options: CreateUserOptions = {}
): Promise<TestUser> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const data = createUserData(options);

  db.run(
    `INSERT INTO users (id, email, name, avatar_url, password_hash, account_level, roles, work_fields, password_reset_required, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.email, data.name, data.avatar_url, data.password_hash, data.account_level, data.roles, data.work_fields, data.password_reset_required, now, now]
  );

  return {
    id,
    ...data,
    created_at: now,
    updated_at: now,
  };
}

export async function insertUsers(
  db: SqliteDatabase,
  count: number,
  options: CreateUserOptions = {}
): Promise<TestUser[]> {
  const users: TestUser[] = [];
  for (let i = 0; i < count; i++) {
    users.push(await insertUser(db, options));
  }
  return users;
}

// ============================================================================
// Product Factory
// ============================================================================

export interface CreateProductOptions {
  code?: string;
  name?: string;
  description?: string;
  defaultSourceLanguage?: string;
  defaultTargetLanguages?: string[];
  displayOrder?: number;
  isActive?: boolean;
}

let productCounter = 0;

export function createProductData(options: CreateProductOptions = {}): Omit<TestProduct, 'id' | 'created_at' | 'updated_at'> {
  productCounter++;
  return {
    code: options.code ?? `PROD${productCounter}`,
    name: options.name ?? `Product ${productCounter}`,
    description: options.description ?? null,
    default_source_language: options.defaultSourceLanguage ?? 'ko',
    default_target_languages: JSON.stringify(options.defaultTargetLanguages ?? ['en', 'ja']),
    display_order: options.displayOrder ?? productCounter,
    is_active: options.isActive ?? true,
  };
}

export async function insertProduct(
  db: SqliteDatabase,
  options: CreateProductOptions = {}
): Promise<TestProduct> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const data = createProductData(options);

  db.run(
    `INSERT INTO products (id, code, name, description, default_source_language, default_target_languages, display_order, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.code, data.name, data.description, data.default_source_language, data.default_target_languages, data.display_order, data.is_active, now, now]
  );

  return {
    id,
    ...data,
    created_at: now,
    updated_at: now,
  };
}

// ============================================================================
// Language Factory
// ============================================================================

export interface CreateLanguageOptions {
  code?: string;
  name?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

let languageCounter = 0;

export function createLanguageData(options: CreateLanguageOptions = {}): Omit<TestLanguage, 'id' | 'created_at' | 'updated_at'> {
  languageCounter++;
  const codes = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'de', 'es', 'pt'];
  const names = ['한국어', 'English', '日本語', '简体中文', '繁體中文', 'Deutsch', 'Español', 'Português'];
  
  return {
    code: options.code ?? codes[languageCounter % codes.length],
    name: options.name ?? names[languageCounter % names.length],
    description: options.description ?? null,
    display_order: options.displayOrder ?? languageCounter,
    is_active: options.isActive ?? true,
  };
}

export async function insertLanguage(
  db: SqliteDatabase,
  options: CreateLanguageOptions = {}
): Promise<TestLanguage> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const data = createLanguageData(options);

  db.run(
    `INSERT INTO languages (id, code, name, description, display_order, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.code, data.name, data.description, data.display_order, data.is_active, now, now]
  );

  return {
    id,
    ...data,
    created_at: now,
    updated_at: now,
  };
}

// ============================================================================
// Translation Factory
// ============================================================================

export interface CreateTranslationOptions {
  sourceText?: string;
  context?: string;
  status?: TestTranslation['status'];
  priority?: TestTranslation['priority'];
  scope?: TestTranslation['scope'];
  userId: string;
  teamId?: string;
  productCode?: string;
  version?: string;
}

let translationCounter = 0;

export function createTranslationData(options: CreateTranslationOptions): Omit<TestTranslation, 'id' | 'created_at' | 'updated_at'> {
  translationCounter++;
  return {
    source_text: options.sourceText ?? `Test source text ${translationCounter}`,
    context: options.context ?? null,
    status: options.status ?? 'pending',
    priority: options.priority ?? 'medium',
    priority_order: 0,
    scope: options.scope ?? 'saas',
    user_id: options.userId,
    team_id: options.teamId ?? null,
    version: options.version ?? null,
    product_code: options.productCode ?? null,
    version_updated_at: null,
    completion_date: null,
    request_group_id: null,
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
  };
}

export async function insertTranslation(
  db: SqliteDatabase,
  options: CreateTranslationOptions
): Promise<TestTranslation> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const data = createTranslationData(options);

  db.run(
    `INSERT INTO translations (id, source_text, context, status, priority, priority_order, scope, user_id, team_id, version, product_code, version_updated_at, completion_date, request_group_id, is_deleted, deleted_at, deleted_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.source_text, data.context, data.status, data.priority, data.priority_order, data.scope, data.user_id, data.team_id, data.version, data.product_code, data.version_updated_at, data.completion_date, data.request_group_id, data.is_deleted, data.deleted_at, data.deleted_by, now, now]
  );

  return {
    id,
    ...data,
    created_at: now,
    updated_at: now,
  };
}

export async function insertTranslations(
  db: SqliteDatabase,
  count: number,
  options: CreateTranslationOptions
): Promise<TestTranslation[]> {
  const translations: TestTranslation[] = [];
  for (let i = 0; i < count; i++) {
    translations.push(await insertTranslation(db, options));
  }
  return translations;
}

// ============================================================================
// Translation Result Factory
// ============================================================================

export interface CreateTranslationResultOptions {
  translationId: string;
  languageCode?: string;
  translatedText?: string;
  reviewerId?: string;
  translationSource?: TestTranslationResult['translation_source'];
  aiProvider?: string;
  confidenceScore?: number;
}

let resultCounter = 0;

export function createTranslationResultData(options: CreateTranslationResultOptions): Omit<TestTranslationResult, 'id' | 'created_at' | 'updated_at' | 'reviewed_at'> {
  resultCounter++;
  return {
    translation_id: options.translationId,
    language_code: options.languageCode ?? 'en',
    translated_text: options.translatedText ?? `Translated text ${resultCounter}`,
    reviewer_id: options.reviewerId ?? null,
    translation_source: options.translationSource ?? 'manual',
    ai_provider: options.aiProvider ?? null,
    confidence_score: options.confidenceScore ?? null,
  };
}

export async function insertTranslationResult(
  db: SqliteDatabase,
  options: CreateTranslationResultOptions
): Promise<TestTranslationResult> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const data = createTranslationResultData(options);

  db.run(
    `INSERT INTO translation_results (id, translation_id, language_code, translated_text, reviewer_id, reviewed_at, translation_source, ai_provider, confidence_score, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.translation_id, data.language_code, data.translated_text, data.reviewer_id, null, data.translation_source, data.ai_provider, data.confidence_score, now, now]
  );

  return {
    id,
    ...data,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
  };
}

// ============================================================================
// Glossary Factory
// ============================================================================

export interface CreateGlossaryOptions {
  term?: string;
  translation?: string;
  languageCode?: string;
  context?: string;
  domain?: string;
  productCode?: string;
  userId: string;
  teamId?: string;
  approvalStatus?: TestGlossary['approval_status'];
}

let glossaryCounter = 0;

export function createGlossaryData(options: CreateGlossaryOptions): Omit<TestGlossary, 'id' | 'created_at' | 'updated_at'> {
  glossaryCounter++;
  return {
    term: options.term ?? `Term ${glossaryCounter}`,
    translation: options.translation ?? `용어 ${glossaryCounter}`,
    language_code: options.languageCode ?? 'ko',
    context: options.context ?? null,
    domain: options.domain ?? null,
    product_code: options.productCode ?? null,
    user_id: options.userId,
    team_id: options.teamId ?? null,
    approval_status: options.approvalStatus ?? 'pending',
    approved_by: null,
    approved_at: null,
    hit_count: 0,
    last_used_at: null,
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
  };
}

export async function insertGlossary(
  db: SqliteDatabase,
  options: CreateGlossaryOptions
): Promise<TestGlossary> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const data = createGlossaryData(options);

  db.run(
    `INSERT INTO glossary (id, term, translation, language_code, context, domain, product_code, user_id, team_id, approval_status, approved_by, approved_at, hit_count, last_used_at, is_deleted, deleted_at, deleted_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.term, data.translation, data.language_code, data.context, data.domain, data.product_code, data.user_id, data.team_id, data.approval_status, data.approved_by, data.approved_at, data.hit_count, data.last_used_at, data.is_deleted, data.deleted_at, data.deleted_by, now, now]
  );

  return {
    id,
    ...data,
    created_at: now,
    updated_at: now,
  };
}

// ============================================================================
// Bulk Operations
// ============================================================================

export async function createCompleteTranslationScenario(
  db: SqliteDatabase,
  options: {
    userCount?: number;
    translationCount?: number;
    languages?: string[];
  } = {}
): Promise<{
  users: TestUser[];
  product: TestProduct;
  languages: TestLanguage[];
  translations: TestTranslation[];
  results: TestTranslationResult[];
}> {
  const { userCount = 2, translationCount = 5, languages = ['en', 'ja'] } = options;

  // Create users
  const users = await insertUsers(db, userCount);
  const mainUser = users[0];

  // Create product
  const product = await insertProduct(db);

  // Create languages
  const languageEntities: TestLanguage[] = [];
  for (const code of languages) {
    languageEntities.push(await insertLanguage(db, { code }));
  }

  // Create translations with results
  const translations: TestTranslation[] = [];
  const results: TestTranslationResult[] = [];

  for (let i = 0; i < translationCount; i++) {
    const translation = await insertTranslation(db, {
      userId: mainUser.id,
      productCode: product.code,
    });
    translations.push(translation);

    // Create results for each language
    for (const lang of languages) {
      const result = await insertTranslationResult(db, {
        translationId: translation.id,
        languageCode: lang,
        translatedText: `${translation.source_text} (${lang})`,
      });
      results.push(result);
    }
  }

  return {
    users,
    product,
    languages: languageEntities,
    translations,
    results,
  };
}

// ============================================================================
// Counter Reset
// ============================================================================

export function resetCounters(): void {
  userCounter = 0;
  productCounter = 0;
  languageCounter = 0;
  translationCounter = 0;
  resultCounter = 0;
  glossaryCounter = 0;
}
