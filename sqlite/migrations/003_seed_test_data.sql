-- ============================================================================
-- Migration: Seed Test Data
-- Version: 003
-- Description: 개발 및 테스트용 샘플 데이터
-- 주의: 프로덕션 환경에서는 실행하지 마세요!
-- ============================================================================

-- ============================================================================
-- 테스트 사용자 생성
-- ============================================================================

-- 마스터 계정
INSERT OR IGNORE INTO users (id, email, name, account_level, roles, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'master@example.com', 'Master Admin', '1st_master', '["master","1st_master"]', datetime('now'));

-- 일반 관리자
INSERT OR IGNORE INTO users (id, email, name, account_level, roles, created_at) VALUES
  ('22222222-2222-2222-2222-222222222222', 'admin@example.com', 'Admin User', 'master', '["master"]', datetime('now'));

-- 번역가 1
INSERT OR IGNORE INTO users (id, email, name, account_level, roles, work_fields, created_at) VALUES
  ('33333333-3333-3333-3333-333333333333', 'translator1@example.com', 'Translator One', 'user', '["translator"]', '["saas","solution"]', datetime('now'));

-- 번역가 2
INSERT OR IGNORE INTO users (id, email, name, account_level, roles, work_fields, created_at) VALUES
  ('44444444-4444-4444-4444-444444444444', 'translator2@example.com', 'Translator Two', 'user', '["translator"]', '["government","other"]', datetime('now'));

-- 일반 사용자
INSERT OR IGNORE INTO users (id, email, name, account_level, roles, created_at) VALUES
  ('55555555-5555-5555-5555-555555555555', 'user@example.com', 'Regular User', 'user', '["user"]', datetime('now'));

-- ============================================================================
-- 테스트 팀 생성
-- ============================================================================
INSERT OR IGNORE INTO teams (id, name, description, created_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SaaS Team', 'SaaS 제품 번역팀', datetime('now')),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Solution Team', '솔루션 제품 번역팀', datetime('now')),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Global Team', '글로벌 번역팀', datetime('now'));

-- ============================================================================
-- 팀 멤버십 설정
-- ============================================================================
INSERT OR IGNORE INTO team_members (id, team_id, user_id, role, created_at) VALUES
  -- SaaS Team
  (lower(hex(randomblob(16))), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'owner', datetime('now')),
  (lower(hex(randomblob(16))), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member', datetime('now')),
  
  -- Solution Team
  (lower(hex(randomblob(16))), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'admin', datetime('now')),
  (lower(hex(randomblob(16))), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'member', datetime('now')),
  
  -- Global Team
  (lower(hex(randomblob(16))), 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'owner', datetime('now')),
  (lower(hex(randomblob(16))), 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'admin', datetime('now')),
  (lower(hex(randomblob(16))), 'cccccccc-cccc-cccc-cccc-cccccccccccc', '44444444-4444-4444-4444-444444444444', 'member', datetime('now'));

-- ============================================================================
-- 번역가 언어 설정
-- ============================================================================
INSERT OR IGNORE INTO translator_languages (id, user_id, language_code, proficiency_level, is_primary) VALUES
  (lower(hex(randomblob(16))), '33333333-3333-3333-3333-333333333333', 'en', 'fluent', TRUE),
  (lower(hex(randomblob(16))), '33333333-3333-3333-3333-333333333333', 'ja', 'native', FALSE),
  (lower(hex(randomblob(16))), '44444444-4444-4444-4444-444444444444', 'zh-CN', 'fluent', TRUE),
  (lower(hex(randomblob(16))), '44444444-4444-4444-4444-444444444444', 'de', 'intermediate', FALSE);

-- ============================================================================
-- 테스트 번역 데이터
-- ============================================================================

-- 번역 요청 1: RC 제품
INSERT OR IGNORE INTO translations (id, source_text, context, status, priority, scope, user_id, team_id, product_code, version, created_at, updated_at) VALUES
  ('trans-001-0000-0000-000000000001', 'Welcome to the application', '홈페이지 메인', 'pending', 'high', 'saas', '55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'RC', 'v1.0', datetime('now', '-5 days'), datetime('now', '-5 days'));

-- 번역 요청 2: RV 제품 (검수 완료)
INSERT OR IGNORE INTO translations (id, source_text, context, status, priority, scope, user_id, team_id, product_code, version, created_at, updated_at) VALUES
  ('trans-002-0000-0000-000000000002', 'Settings menu allows you to customize your experience', '설정 페이지', 'reviewed', 'medium', 'saas', '55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'RV', 'v2.1', datetime('now', '-3 days'), datetime('now', '-1 day'));

-- 번역 요청 3: RM 제품 (반영 완료)
INSERT OR IGNORE INTO translations (id, source_text, context, status, priority, scope, user_id, team_id, product_code, version, completion_date, created_at, updated_at) VALUES
  ('trans-003-0000-0000-000000000003', 'Click here to start recording', '녹화 기능', 'deployed', 'urgent', 'solution', '55555555-5555-5555-5555-555555555555', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'RM', 'v3.0', datetime('now', '-1 day'), datetime('now', '-7 days'), datetime('now', '-1 day'));

-- 번역 요청 4: 여러 제품에 적용
INSERT OR IGNORE INTO translations (id, source_text, context, status, priority, scope, user_id, team_id, version, created_at, updated_at) VALUES
  ('trans-004-0000-0000-000000000004', 'Error: Connection timeout', '공통 오류 메시지', 'in_progress', 'high', 'saas', '55555555-5555-5555-5555-555555555555', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'v1.0', datetime('now', '-2 days'), datetime('now'));

-- 번역 요청 5: 정부과제
INSERT OR IGNORE INTO translations (id, source_text, context, status, priority, scope, user_id, team_id, version, created_at, updated_at) VALUES
  ('trans-005-0000-0000-000000000005', 'Confidential document access', '보안 페이지', 'pending', 'urgent', 'government', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'v1.0', datetime('now'), datetime('now'));

-- ============================================================================
-- 번역 결과 데이터
-- ============================================================================

-- trans-001 결과들
INSERT OR IGNORE INTO translation_results (id, translation_id, language_code, translated_text, translation_source, created_at, updated_at) VALUES
  (lower(hex(randomblob(16))), 'trans-001-0000-0000-000000000001', 'ko', '애플리케이션에 오신 것을 환영합니다', 'ai', datetime('now', '-5 days'), datetime('now', '-5 days')),
  (lower(hex(randomblob(16))), 'trans-001-0000-0000-000000000001', 'ja', 'アプリケーションへようこそ', 'ai', datetime('now', '-5 days'), datetime('now', '-5 days')),
  (lower(hex(randomblob(16))), 'trans-001-0000-0000-000000000001', 'zh-CN', '欢迎使用应用程序', 'ai', datetime('now', '-5 days'), datetime('now', '-5 days'));

-- trans-002 결과들 (검수 완료)
INSERT OR IGNORE INTO translation_results (id, translation_id, language_code, translated_text, reviewer_id, reviewed_at, translation_source, created_at, updated_at) VALUES
  (lower(hex(randomblob(16))), 'trans-002-0000-0000-000000000002', 'ko', '설정 메뉴에서 사용자 경험을 사용자 지정할 수 있습니다', '33333333-3333-3333-3333-333333333333', datetime('now', '-1 day'), 'ai', datetime('now', '-3 days'), datetime('now', '-1 day')),
  (lower(hex(randomblob(16))), 'trans-002-0000-0000-000000000002', 'ja', '設定メニューでエクスペリエンスをカスタマイズできます', '33333333-3333-3333-3333-333333333333', datetime('now', '-1 day'), 'ai', datetime('now', '-3 days'), datetime('now', '-1 day'));

-- trans-003 결과들 (반영 완료)
INSERT OR IGNORE INTO translation_results (id, translation_id, language_code, translated_text, reviewer_id, reviewed_at, translation_source, created_at, updated_at) VALUES
  (lower(hex(randomblob(16))), 'trans-003-0000-0000-000000000003', 'ko', '여기를 클릭하여 녹화를 시작하세요', '44444444-4444-4444-4444-444444444444', datetime('now', '-2 days'), 'manual', datetime('now', '-7 days'), datetime('now', '-2 days')),
  (lower(hex(randomblob(16))), 'trans-003-0000-0000-000000000003', 'en', 'Click here to start recording', '44444444-4444-4444-4444-444444444444', datetime('now', '-2 days'), 'manual', datetime('now', '-7 days'), datetime('now', '-2 days'));

-- ============================================================================
-- 용어집 데이터
-- ============================================================================
INSERT OR IGNORE INTO glossary (id, term, translation, language_code, context, domain, product_code, user_id, approval_status, hit_count, created_at, updated_at) VALUES
  -- RC 제품 용어
  (lower(hex(randomblob(16))), 'recording', '녹화', 'ko', '동영상 촬영', 'video', 'RC', '33333333-3333-3333-3333-333333333333', 'approved', 15, datetime('now', '-30 days'), datetime('now', '-5 days')),
  (lower(hex(randomblob(16))), 'streaming', '스트리밍', 'ko', '실시간 방송', 'video', 'RC', '33333333-3333-3333-3333-333333333333', 'approved', 23, datetime('now', '-25 days'), datetime('now', '-3 days')),
  
  -- RV 제품 용어
  (lower(hex(randomblob(16))), 'remote control', '원격 제어', 'ko', 'PC 원격 조작', 'remote', 'RV', '44444444-4444-4444-4444-444444444444', 'approved', 42, datetime('now', '-20 days'), datetime('now', '-2 days')),
  (lower(hex(randomblob(16))), 'file transfer', '파일 전송', 'ko', '파일 주고받기', 'file', 'RV', '44444444-4444-4444-4444-444444444444', 'pending', 8, datetime('now', '-10 days'), datetime('now', '-1 day')),
  
  -- RM 제품 용어
  (lower(hex(randomblob(16))), 'meeting room', '회의실', 'ko', '화상회의 공간', 'meeting', 'RM', '33333333-3333-3333-3333-333333333333', 'approved', 31, datetime('now', '-15 days'), datetime('now', '-4 days')),
  
  -- 일본어 용어
  (lower(hex(randomblob(16))), 'recording', '録画', 'ja', '動画撮影', 'video', 'RC', '33333333-3333-3333-3333-333333333333', 'approved', 12, datetime('now', '-28 days'), datetime('now', '-6 days')),
  (lower(hex(randomblob(16))), 'streaming', '配信', 'ja', 'ライブ配信', 'video', 'RC', '33333333-3333-3333-3333-333333333333', 'approved', 18, datetime('now', '-22 days'), datetime('now', '-4 days'));

-- ============================================================================
-- 번역-제품 매핑 (다대다 관계)
-- ============================================================================
-- trans-004는 RC와 RV 모두에 적용
INSERT OR IGNORE INTO translation_products (id, translation_id, product_code, created_at) VALUES
  (lower(hex(randomblob(16))), 'trans-004-0000-0000-000000000004', 'RC', datetime('now')),
  (lower(hex(randomblob(16))), 'trans-004-0000-0000-000000000004', 'RV', datetime('now'));

-- ============================================================================
-- 번역 감사 로그 샘플
-- ============================================================================
INSERT OR IGNORE INTO translation_audit_logs (id, translation_id, user_id, user_name, action, field_name, old_value, new_value, created_at) VALUES
  (lower(hex(randomblob(16))), 'trans-001-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'Regular User', 'create', NULL, NULL, 'New translation request', datetime('now', '-5 days')),
  (lower(hex(randomblob(16))), 'trans-002-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Translator One', 'update', 'status', 'pending', 'reviewed', datetime('now', '-1 day')),
  (lower(hex(randomblob(16))), 'trans-003-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'Translator Two', 'update', 'status', 'reviewed', 'deployed', datetime('now', '-1 day'));

-- ============================================================================
-- 용어집 감사 로그 샘플
-- ============================================================================
INSERT OR IGNORE INTO glossary_audit_logs (id, glossary_term_id, user_id, user_name, action, field_name, old_value, new_value, created_at) VALUES
  (lower(hex(randomblob(16))), (SELECT id FROM glossary WHERE term = 'recording' AND language_code = 'ko' LIMIT 1), '33333333-3333-3333-3333-333333333333', 'Translator One', 'create', NULL, NULL, 'Added term: recording → 녹화', datetime('now', '-30 days')),
  (lower(hex(randomblob(16))), (SELECT id FROM glossary WHERE term = 'recording' AND language_code = 'ko' LIMIT 1), '22222222-2222-2222-2222-222222222222', 'Admin User', 'approve', 'approval_status', 'pending', 'approved', datetime('now', '-25 days'));

-- ============================================================================
-- 사용자 설정 샘플
-- ============================================================================
INSERT OR IGNORE INTO user_settings (id, user_id, ai_provider, settings) VALUES
  (lower(hex(randomblob(16))), '33333333-3333-3333-3333-333333333333', 'openai', '{"theme":"dark","language":"ko","notifications":true}'),
  (lower(hex(randomblob(16))), '44444444-4444-4444-4444-444444444444', 'gemini', '{"theme":"light","language":"en","notifications":false}');

-- ============================================================================
-- 번역 코멘트 샘플
-- ============================================================================
INSERT OR IGNORE INTO translation_comments (id, translation_id, user_id, content, created_at) VALUES
  (lower(hex(randomblob(16))), 'trans-001-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', '"application"의 번역을 "앱"으로 하는 것은 어떨까요?', datetime('now', '-4 days')),
  (lower(hex(randomblob(16))), 'trans-001-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '컨텍스트상 "애플리케이션"이 더 적절합니다.', datetime('now', '-3 days'));

-- ============================================================================
-- 번역 플랫폼 설정 샘플
-- ============================================================================
INSERT OR IGNORE INTO translation_platforms (id, code, name, description, deploy_status, settings) VALUES
  (lower(hex(randomblob(16))), 'web', 'Web Platform', '웹 애플리케이션', 'completed', '{"url":"https://example.com","api_endpoint":"/api/v1"}'),
  (lower(hex(randomblob(16))), 'ios', 'iOS App', 'iOS 모바일 앱', 'completed', '{"bundle_id":"com.example.ios","app_store_id":"123456"}'),
  (lower(hex(randomblob(16))), 'android', 'Android App', 'Android 모바일 앱', 'in_progress', '{"package_name":"com.example.android"}'),
  (lower(hex(randomblob(16))), 'desktop', 'Desktop App', '데스크톱 애플리케이션', 'pending', '{"platforms":["windows","mac"]}');

-- ============================================================================
-- 번역 로그 샘플 (히스토리)
-- ============================================================================
INSERT OR IGNORE INTO translation_logs (id, translation_result_id, previous_text, new_text, changed_by, change_reason, created_at) VALUES
  (lower(hex(randomblob(16))), 
   (SELECT id FROM translation_results WHERE translation_id = 'trans-002-0000-0000-000000000002' AND language_code = 'ko' LIMIT 1),
   '설정 메뉴는 경험을 커스터마이즈할 수 있게 해줍니다',
   '설정 메뉴에서 사용자 경험을 사용자 지정할 수 있습니다',
   '33333333-3333-3333-3333-333333333333',
   '더 자연스러운 한국어 표현으로 수정',
   datetime('now', '-2 days'));

-- ============================================================================
-- Migration complete
-- ============================================================================
