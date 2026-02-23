#!/bin/bash

# 테스트 PDF 파일 생성 스크립트
# 45MB 클라이언트 제한, 50MB 서버 제한 테스트용

set -e

echo "========================================"
echo "PDF 테스트 파일 생성"
echo "========================================"
echo ""

# 테스트 파일 디렉토리
TEST_DIR="./test-pdfs"
mkdir -p "$TEST_DIR"

# 간단한 PDF 생성 함수
create_test_pdf() {
    local size_mb=$1
    local filename="$TEST_DIR/$2"

    echo "생성 중: $filename ($size_mb MB)..."

    # 기본 PDF 구조 (약 600 bytes)
    cat > "$filename" << 'EOF'
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length 55
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF File) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000317 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
421
%%EOF
EOF

    # 목표 크기까지 0으로 채우기
    local target_size=$((size_mb * 1024 * 1024))
    local current_size=$(stat -f%z "$filename" 2>/dev/null || stat -c%s "$filename" 2>/dev/null)

    if [ $current_size -lt $target_size ]; then
        dd if=/dev/zero bs=1048576 count=$((size_mb - 1)) >> "$filename" 2>/dev/null
    fi

    local final_size=$(stat -f%z "$filename" 2>/dev/null || stat -c%s "$filename" 2>/dev/null)
    local final_mb=$(echo "scale=2; $final_size / 1024 / 1024" | bc)
    echo "✓ 생성 완료: $filename (${final_mb}MB)"
    echo ""
}

# 테스트 케이스별 파일 생성
echo "1. 정상 업로드 테스트 파일들"
echo "--------------------------------"
create_test_pdf 1 "test-01mb-ok.pdf"
create_test_pdf 30 "test-30mb-ok.pdf"
create_test_pdf 44 "test-44mb-ok.pdf"

echo ""
echo "2. 클라이언트 차단 테스트 파일 (45MB 초과)"
echo "--------------------------------"
create_test_pdf 46 "test-46mb-blocked.pdf"

echo ""
echo "3. 서버 차단 테스트 파일 (50MB 초과)"
echo "--------------------------------"
create_test_pdf 51 "test-51mb-blocked.pdf"

echo ""
echo "========================================"
echo "생성 완료!"
echo "========================================"
echo ""
echo "테스트 파일 위치: $TEST_DIR"
echo ""
echo "📋 테스트 가이드:"
echo "--------------------------------"
echo "1. npm run dev 실행"
echo "2. http://localhost:3000/upload 접속"
echo "3. 제품 선택"
echo "4. 각 파일 업로드 테스트:"
echo ""
echo "   ✅ test-01mb-ok.pdf → 정상 업로드"
echo "   ✅ test-30mb-ok.pdf → 정상 업로드"
echo "   ✅ test-44mb-ok.pdf → 정상 업로드"
echo "   ❌ test-46mb-blocked.pdf → Alert 노출 (45MB 초과)"
echo "   ❌ test-51mb-blocked.pdf → Alert 노출 (45MB 초과)"
echo ""
echo "정리: rm -rf $TEST_DIR"
echo ""
