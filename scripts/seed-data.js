#!/usr/bin/env node
/**
 * 데이터 초기화 및 시드 스크립트
 * 모든 테스트 데이터를 생성합니다.
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lviuhkfoaqpunudjmvol.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function seedData() {
  console.log('🌱 데이터 시드 시작...\n');

  // 1. 사용자 생성 (auth.users와 profiles)
  console.log('👥 사용자 생성 중...');
  const users = [
    { email: 'admin@example.com', name: '관리자' },
    { email: 'translator@example.com', name: '번역가' },
    { email: 'reviewer@example.com', name: '검수자' },
  ];

  for (const user of users) {
    // auth.users에 생성
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: 'password123',
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log(`  ℹ️  ${user.email} - 이미 존재함`);
      } else {
        console.error(`  ❌ ${user.email}: ${authError.message}`);
      }
      continue;
    }

    // profiles에 생성 (기본 스키마: id, email, name, avatar_url, created_at)
    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: authData.user.id,
        email: user.email,
        name: user.name,
      });

    if (profileError) {
      console.error(`  ❌ 프로필 생성 실패 ${user.email}: ${profileError.message}`);
    } else {
      console.log(`  ✅ ${user.email} - 생성됨`);
    }
  }

  // 2. 번역 데이터 생성
  console.log('\n📝 번역 데이터 생성 중...');
  const { data: existingTranslations } = await supabase
    .from('translations')
    .select('id')
    .limit(1);

  if (existingTranslations && existingTranslations.length > 0) {
    console.log('  ℹ️  번역 데이터가 이미 존재함 (걱너뜀)');
  } else {
    const translations = [
      { source_text: '원격 지원 세션이 시작되었습니다.', context: 'RemoteCall 연결 시작', status: 'deployed', priority: 'high', scope: 'saas', product_code: 'RC', request_id: 'req-001' },
      { source_text: '6자리 연결 코드를 입력해주세요.', context: '연결 코드 입력 안내', status: 'reviewed', priority: 'urgent', scope: 'saas', product_code: 'RC', request_id: 'req-001' },
      { source_text: '화면 공유를 시작합니다.', context: '화면 공유 시작', status: 'in_progress', priority: 'medium', scope: 'solution', product_code: 'RV', request_id: 'req-002' },
      { source_text: '파일 전송이 완료되었습니다.', context: '파일 전송 완료', status: 'pending', priority: 'low', scope: 'saas', product_code: 'RC', request_id: 'req-003' },
      { source_text: '고객님의 대기 순번은 %d번 입니다.', context: '대기 순번 안내', status: 'deployed', priority: 'high', scope: 'saas', product_code: 'RM', request_id: 'req-004' },
    ];

    for (const t of translations) {
      const { error } = await supabase.from('translations').insert(t);
      if (error) {
        console.error(`  ❌ "${t.source_text.substring(0, 20)}...": ${error.message}`);
      } else {
        console.log(`  ✅ "${t.source_text.substring(0, 30)}..."`);
      }
    }
  }

  // 3. 용어집 데이터 생성
  console.log('\n📚 용어집 데이터 생성 중...');
  const { data: existingGlossary } = await supabase
    .from('glossary')
    .select('id')
    .limit(1);

  if (existingGlossary && existingGlossary.length > 0) {
    console.log('  ℹ️  용어집 데이터가 이미 존재함 (걱너뜀)');
  } else {
    const glossaryTerms = [
      { term: 'Remote Support', translation: '원격 지원', language_code: 'ko', context: '서비스명', product_code: 'RC' },
      { term: 'Screen Sharing', translation: '화면 공유', language_code: 'ko', context: '기능명', product_code: 'RC' },
      { term: 'Connection Code', translation: '연결 코드', language_code: 'ko', context: '6자리 코드', product_code: 'RC' },
      { term: 'Session', translation: '세션', language_code: 'ko', context: '연결 단위', product_code: 'RC' },
      { term: 'File Transfer', translation: '파일 전송', language_code: 'ko', context: '기능명', product_code: 'RC' },
    ];

    for (const g of glossaryTerms) {
      const { error } = await supabase.from('glossary').insert(g);
      if (error) {
        console.error(`  ❌ "${g.term}": ${error.message}`);
      } else {
        console.log(`  ✅ "${g.term}"`);
      }
    }
  }

  console.log('\n✨ 데이터 시드 완료!');
}

seedData().catch(err => {
  console.error('❌ 예상치 못한 오류:', err);
  process.exit(1);
});
