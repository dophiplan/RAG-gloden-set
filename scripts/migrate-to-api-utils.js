#!/usr/bin/env node
/**
 * fetch → apiFetch 마이그레이션 스크립트
 * 
 * 사용법: node scripts/migrate-to-api-utils.js
 * 
 * 주의: 이 스크립트는 단순한 패턧만 변환합니다.
 * 복잡한 경우 수동 수정이 필요합니다.
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

const SRC_DIR = path.join(__dirname, '..', 'src');

// 변환 패턴들
const patterns = [
  // 패턴 1: const data = await response.json(); (fetch 직후)
  {
    name: 'fetch 후 json 파싱',
    find: /const\s+(\w+)\s*=\s*await\s+fetch\(['"]([^'"]+)['"]\);\s*\n\s*const\s+(\w+)\s*=\s*await\s+\1\.json\(\);/g,
    replace: (match, resVar, url, dataVar) => {
      return `const ${dataVar} = await apiFetch('${url}');`;
    }
  },
  // 패턴 2: if (response.ok) { const data = await response.json(); }
  {
    name: 'ok 체크 후 파싱',
    find: /if\s*\(\s*(\w+)\.ok\s*\)\s*{\s*\n\s*const\s+(\w+)\s*=\s*await\s+\1\.json\(\);/g,
    replace: (match, resVar, dataVar) => {
      return `// TODO: 에러 핸들링 확인 필요\n      const ${dataVar} = await ${resVar}.json();`;
    },
    warning: true
  }
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  const issues = [];

  // import 확인
  if (content.includes('fetch(') && !content.includes('apiFetch')) {
    patterns.forEach(pattern => {
      if (pattern.find.test(content)) {
        if (pattern.warning) {
          issues.push(`${pattern.name} - 수동 확인 필요: ${filePath}`);
        }
        modified = true;
      }
    });
  }

  return { modified, issues };
}

function main() {
  console.log('🔍 API 유틸리티 마이그레이션 분석 중...\n');

  const files = globSync('src/**/*.{ts,tsx}', { 
    cwd: path.join(__dirname, '..'),
    absolute: true 
  });

  const issues = [];
  let affectedFiles = 0;

  files.forEach(file => {
    if (file.includes('node_modules')) return;
    
    const result = processFile(file);
    if (result.modified) {
      affectedFiles++;
      issues.push(...result.issues);
    }
  });

  console.log(`📊 분석 결과:`);
  console.log(`   총 파일 수: ${files.length}`);
  console.log(`   수정 필요 파일: ${affectedFiles}\n`);

  if (issues.length > 0) {
    console.log('⚠️  수동 확인 필요한 항목:');
    issues.forEach(issue => console.log(`   - ${issue}`));
  }

  console.log('\n✅ 다음 단계:');
  console.log('   1. src/lib/api-utils.ts를 프로젝트에 추가');
  console.log('   2. 각 파일의 fetch 호출을 apiFetch로 교체');
  console.log('   3. 예시: import { apiFetch } from "@/lib/api-utils"');
}

main();
