#!/usr/bin/env node
/**
 * 데이터 초기화 스크립트
 * 대시보드, 번역관리, 용어집, 번역 요청 데이터를 모두 삭제합니다.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lviuhkfoaqpunudjmvol.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function resetData() {
  console.log('🗑️  데이터 초기화를 시작합니다...\n');

  const tables = [
    { name: 'translation_results', label: '번역 결과' },
    { name: 'translation_audit_logs', label: '번역 감사 로그' },
    { name: 'glossary_audit_logs', label: '용어집 감사 로그' },
    { name: 'translation_products', label: '번역-제품 연결' },
    { name: 'glossary_products', label: '용어집-제품 연결' },
    { name: 'translation_corrections', label: '번역 수정' },
    { name: 'translation_platforms', label: '번역 플랫폼' },
    { name: 'issues', label: '이슈' },
    { name: 'translation_logs', label: '번역 로그' },
    { name: 'translations', label: '번역 데이터' },
    { name: 'glossary', label: '용어집' },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const { name, label } of tables) {
    try {
      const { error, count } = await supabase
        .from(name)
        .delete({ count: 'exact' })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 데이터 삭제

      if (error) {
        // 테이블이 없는 경우는 무시
        if (error.message.includes('does not exist')) {
          console.log(`  ⏭️  ${label} (${name}): 테이블 없음`);
          continue;
        }
        console.error(`  ❌ ${label} (${name}): ${error.message}`);
        failCount++;
      } else {
        console.log(`  ✅ ${label} (${name}): 삭제 완료`);
        successCount++;
      }
    } catch (err) {
      console.error(`  ❌ ${label} (${name}): ${err.message}`);
      failCount++;
    }
  }

  console.log('\n📊 초기화 결과:');
  console.log(`   성공: ${successCount}개 테이블`);
  console.log(`   실패: ${failCount}개 테이블`);
  
  if (failCount === 0) {
    console.log('\n✨ 모든 데이터가 성공적으로 초기화되었습니다!');
  } else {
    console.log('\n⚠️  일부 테이블 초기화에 실패했습니다.');
    process.exit(1);
  }
}

resetData().catch(err => {
  console.error('❌ 예상치 못한 오류:', err);
  process.exit(1);
});
