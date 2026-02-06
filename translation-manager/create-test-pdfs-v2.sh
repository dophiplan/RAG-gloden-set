#!/bin/bash

# 테스트 PDF 파일 생성 스크립트 v2
# 더 정확한 파일 크기로 생성

set -e

echo "========================================"
echo "PDF 테스트 파일 생성 v2"
echo "========================================"
echo ""

# 테스트 파일 디렉토리
TEST_DIR="./test-pdfs"
mkdir -p "$TEST_DIR"

# PDF 생성 함수 (정확한 크기)
create_pdf_exact() {
    local size_mb=$1
    local filename="$TEST_DIR/$2"
    local description="$3"

    echo "생성 중: $filename ($size_mb MB) - $description"

    # 기본 PDF 헤더/푸터 (최소 PDF 구조)
    cat > "$filename" << 'EOF'
%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 100 700 Td (Test) Tj ET
endstream endobj
xref
0 5
0000000000 65535 f
0000000015 00000 n
0000000060 00000 n
0000000111 00000 n
0000000212 00000 n
trailer<</Size 5/Root 1 0 R>>
startxref
304
%%EOF
EOF

    # 현재 크기 확인
    local current_size=$(wc -c < "$filename")

    # 목표 크기 계산 (정확히 MB 단위)
    local target_size=$((size_mb * 1024 * 1024))

    # 추가로 채워야 할 크기
    local padding=$((target_size - current_size))

    if [ $padding -gt 0 ]; then
        # 0으로 파일 크기 채우기
        dd if=/dev/zero bs=1 count=$padding >> "$filename" 2>/dev/null
    fi

    # 최종 크기 확인
    local final_size=$(wc -c < "$filename")
    local final_mb=$(echo "scale=2; $final_size / 1024 / 1024" | bc)

    echo "✓ 완료: ${final_mb}MB"
    echo ""
}

# 테스트 케이스별 파일 생성
echo "📝 테스트 시나리오:"
echo ""

echo "1️⃣  정상 업로드 (45MB 미만)"
echo "-----------------------------------"
create_pdf_exact 1 "01-ok-1mb.pdf" "작은 파일"
create_pdf_exact 30 "02-ok-30mb.pdf" "중간 크기"
create_pdf_exact 44 "03-ok-44mb.pdf" "거의 최대"

echo "2️⃣  클라이언트 차단 (45MB 이상)"
echo "-----------------------------------"
create_pdf_exact 45 "04-blocked-45mb.pdf" "정확히 45MB"
create_pdf_exact 46 "05-blocked-46mb.pdf" "45MB 초과"

echo "3️⃣  서버도 차단 (50MB 초과)"
echo "-----------------------------------"
create_pdf_exact 51 "06-blocked-51mb.pdf" "서버 제한 초과"

echo ""
echo "========================================"
echo "✨ 생성 완료!"
echo "========================================"
echo ""
echo "📁 파일 위치: $TEST_DIR"
echo ""
ls -lh "$TEST_DIR"/*.pdf 2>/dev/null | grep -E "(01|02|03|04|05|06)-" | awk '{print "  " $9 " (" $5 ")"}'
echo ""
echo "========================================"
echo "🧪 테스트 방법"
echo "========================================"
echo ""
echo "1. 개발 서버 실행:"
echo "   npm run dev"
echo ""
echo "2. 브라우저에서 접속:"
echo "   http://localhost:3000/upload"
echo ""
echo "3. 파일 업로드 테스트:"
echo ""
echo "   ✅ 01-ok-1mb.pdf"
echo "      → 정상 업로드, 텍스트 추출 확인"
echo ""
echo "   ✅ 02-ok-30mb.pdf"
echo "      → 정상 업로드, 처리 시간 확인"
echo ""
echo "   ✅ 03-ok-44mb.pdf"
echo "      → 정상 업로드 (최대 제한 직전)"
echo ""
echo "   ❌ 04-blocked-45mb.pdf"
echo "      → Alert: '파일 크기는 45MB를 초과할 수 없습니다'"
echo "      → 현재 파일 크기: 45.00MB"
echo ""
echo "   ❌ 05-blocked-46mb.pdf"
echo "      → Alert: '파일 크기는 45MB를 초과할 수 없습니다'"
echo "      → 현재 파일 크기: 46.00MB"
echo ""
echo "   ❌ 06-blocked-51mb.pdf"
echo "      → Alert: '파일 크기는 45MB를 초과할 수 없습니다'"
echo "      → 현재 파일 크기: 51.00MB"
echo ""
echo "========================================"
echo "🧹 정리 명령어"
echo "========================================"
echo ""
echo "  rm -rf $TEST_DIR"
echo ""
