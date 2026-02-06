# PDF 업로드 부하 테스트 보고서

## 📋 현재 설정 분석

### 1. 발견된 문제점
- ❌ **파일 크기 제한 미설정**: next.config.ts에 명시적 제한 없음
- ❌ **클라이언트 검증 없음**: PDFUploader에 파일 크기 사전 체크 없음
- ❌ **API 제한 없음**: /api/pdf/parse에 용량 제한 없음

### 2. Next.js 기본 제한
- **기본 body size limit**: 4MB (API Routes)
- **Vercel 배포 시**: 4.5MB
- **결과**: 현재는 **4MB 이상 파일 업로드 불가**

---

## 🎯 권장 설정

### 파일 크기 제한 가이드

| 용도 | 권장 크기 | 이유 |
|------|-----------|------|
| 일반 기획서 | 10MB | 대부분의 PDF 커버 |
| 대용량 기획서 | 50MB | 이미지 많은 PDF |
| 최대 허용 | 100MB | 매우 큰 PDF (신중히 설정) |

**권장**: **50MB**
- ✅ 대부분의 PDF 지원
- ✅ 서버 부하 관리 가능
- ✅ 메모리 오버플로 방지

---

## 🔧 구현할 개선사항

### 1. Next.js 설정 (next.config.ts)
```typescript
const nextConfig: NextConfig = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // 50MB로 설정
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};
```

### 2. 클라이언트 검증 (PDFUploader.tsx)
```typescript
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const processFile = async (file: File) => {
  // 파일 크기 체크
  if (file.size > MAX_FILE_SIZE) {
    setError(`파일 크기는 50MB를 초과할 수 없습니다. (현재: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    return;
  }

  // 기존 로직...
};
```

### 3. API 검증 (route.ts)
```typescript
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  // 파일 크기 검증
  if (file && file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: '파일 크기는 50MB를 초과할 수 없습니다.' },
      { status: 413 } // Payload Too Large
    );
  }

  // 기존 로직...
}
```

---

## 🧪 부하 테스트 시나리오

### 테스트 케이스

| 케이스 | 파일 크기 | 예상 결과 | 테스트 목적 |
|--------|-----------|-----------|-------------|
| 1 | 1MB | ✅ 성공 | 일반적인 케이스 |
| 2 | 5MB | ✅ 성공 | 중간 크기 |
| 3 | 10MB | ✅ 성공 | 큰 기획서 |
| 4 | 25MB | ✅ 성공 | 매우 큰 파일 |
| 5 | 50MB | ✅ 성공 | 최대 허용 |
| 6 | 51MB | ❌ 실패 | 제한 초과 |
| 7 | 100MB | ❌ 실패 | 훨씬 초과 |

### 성능 테스트 기준

| 메트릭 | 목표 | 허용 범위 |
|--------|------|-----------|
| 업로드 시간 (10MB) | < 3초 | < 5초 |
| 파싱 시간 (10MB) | < 5초 | < 10초 |
| 전체 처리 시간 | < 10초 | < 15초 |
| 메모리 사용량 | < 500MB | < 1GB |
| CPU 사용률 | < 80% | < 100% |

---

## 📝 테스트 스크립트

### 1. 수동 테스트 (브라우저)

```bash
# 1. 개발 서버 실행
npm run dev

# 2. 브라우저에서 테스트
# http://localhost:3000/upload

# 3. 테스트 PDF 준비
# - 1MB PDF
# - 10MB PDF
# - 50MB PDF
# - 51MB PDF (제한 초과)

# 4. 각 파일 업로드 시도
# 5. 콘솔과 네트워크 탭 확인
```

### 2. 자동 테스트 스크립트 (cURL)

```bash
#!/bin/bash

# PDF 부하 테스트 스크립트
BASE_URL="http://localhost:3000"
TOKEN="your-auth-token" # Supabase 인증 토큰

# 1MB 테스트
echo "Testing 1MB PDF..."
curl -X POST "$BASE_URL/api/pdf/parse" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-1mb.pdf" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n"

# 10MB 테스트
echo "Testing 10MB PDF..."
curl -X POST "$BASE_URL/api/pdf/parse" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-10mb.pdf" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n"

# 50MB 테스트
echo "Testing 50MB PDF..."
curl -X POST "$BASE_URL/api/pdf/parse" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-50mb.pdf" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n"

# 51MB 테스트 (실패 예상)
echo "Testing 51MB PDF (should fail)..."
curl -X POST "$BASE_URL/api/pdf/parse" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-51mb.pdf" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n"
```

### 3. Node.js 테스트 스크립트

```javascript
// test-pdf-upload.js
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testPDFUpload(filePath, fileName) {
  const stats = fs.statSync(filePath);
  const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log(`\n=== Testing: ${fileName} (${sizeInMB} MB) ===`);

  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  const startTime = Date.now();

  try {
    const response = await fetch('http://localhost:3000/api/pdf/parse', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN',
      },
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`Status: ${response.status}`);
    console.log(`Duration: ${duration}s`);

    if (response.ok) {
      const data = await response.json();
      console.log(`Extracted: ${data.totalExtracted} texts`);
      console.log(`✅ SUCCESS`);
    } else {
      const error = await response.text();
      console.log(`❌ FAILED: ${error}`);
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
  }
}

// 테스트 실행
(async () => {
  await testPDFUpload('./test-1mb.pdf', '1MB PDF');
  await testPDFUpload('./test-10mb.pdf', '10MB PDF');
  await testPDFUpload('./test-50mb.pdf', '50MB PDF');
  await testPDFUpload('./test-51mb.pdf', '51MB PDF');
})();
```

---

## 🔍 모니터링 포인트

### 1. 클라이언트 측
```javascript
// PDFUploader.tsx에 추가
console.time('upload-time');
console.time('parse-time');

// 업로드 시작
console.log('File size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

// 업로드 완료
console.timeEnd('upload-time');

// 파싱 완료
console.timeEnd('parse-time');
console.log('Memory usage:', performance.memory?.usedJSHeapSize / 1024 / 1024, 'MB');
```

### 2. 서버 측
```typescript
// route.ts에 추가
console.log('=== PDF Upload Start ===');
console.log('File size:', file.size / 1024 / 1024, 'MB');
console.log('Memory before:', process.memoryUsage().heapUsed / 1024 / 1024, 'MB');

const startTime = Date.now();

// 파싱 로직...

const endTime = Date.now();
console.log('Processing time:', (endTime - startTime) / 1000, 's');
console.log('Memory after:', process.memoryUsage().heapUsed / 1024 / 1024, 'MB');
console.log('=== PDF Upload End ===');
```

---

## ⚠️ 주의사항

### 1. Vercel 배포 시 제한
- **함수 실행 시간**: 10초 (Hobby), 60초 (Pro)
- **메모리**: 1024MB (Hobby), 3008MB (Pro)
- **페이로드 크기**: 4.5MB (Hobby), 사용자 지정 가능 (Pro)

### 2. 대용량 PDF 처리
50MB 이상 PDF는:
- ✅ 페이지별 처리
- ✅ 스트리밍 파싱
- ✅ 백그라운드 작업
- ✅ 프로그레스 바 표시

### 3. 메모리 최적화
```typescript
// 큰 파일 처리 시
const pdfDoc = await PDFDocument.load(buffer, {
  updateMetadata: false, // 메타데이터 업데이트 비활성화
});

// 페이지별 처리
for (let i = 0; i < pdfDoc.numPages; i++) {
  const page = await pdfDoc.getPage(i);
  // 처리...
  page.cleanup(); // 메모리 해제
}
```

---

## 📈 예상 결과

### 파일 크기별 처리 시간 (예상)

| 파일 크기 | 업로드 | 파싱 | 전체 | 상태 |
|-----------|--------|------|------|------|
| 1MB | 0.5s | 1s | 1.5s | ✅ 빠름 |
| 5MB | 1s | 2s | 3s | ✅ 양호 |
| 10MB | 2s | 4s | 6s | ✅ 양호 |
| 25MB | 4s | 8s | 12s | ⚠️ 느림 |
| 50MB | 8s | 15s | 23s | ⚠️ 매우 느림 |

### 권장사항
- **최적**: 10MB 이하
- **허용**: 50MB 이하
- **비권장**: 50MB 이상

---

## ✅ 체크리스트

### 구현 전
- [ ] next.config.ts 업데이트
- [ ] PDFUploader 파일 크기 검증 추가
- [ ] API 라우트 검증 추가
- [ ] 에러 메시지 개선

### 테스트
- [ ] 1MB PDF 업로드
- [ ] 10MB PDF 업로드
- [ ] 50MB PDF 업로드
- [ ] 51MB PDF 업로드 (거부 확인)
- [ ] 처리 시간 측정
- [ ] 메모리 사용량 측정

### 배포 전
- [ ] 프로덕션 빌드 테스트
- [ ] Vercel 제한 확인
- [ ] 사용자 가이드 업데이트
- [ ] 모니터링 설정

---

## 🚀 다음 단계

1. **즉시 적용**: 50MB 제한 설정
2. **단기**: 프로그레스 바 추가
3. **중기**: 대용량 파일 처리 최적화
4. **장기**: 클라우드 스토리지 통합 (S3, GCS)

---

**작성일**: 2026-02-05
**상태**: 분석 완료, 구현 대기중
