#!/bin/bash

# PDF Upload Load Test Script
# 사용법: ./test-pdf-upload.sh

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_ENDPOINT="$BASE_URL/api/pdf/parse"

echo "======================================"
echo "PDF Upload Load Test"
echo "======================================"
echo "Endpoint: $API_ENDPOINT"
echo ""

# 색상 코드
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 테스트 파일 생성 함수
create_test_pdf() {
    local size_mb=$1
    local filename=$2

    echo "Creating test PDF: $filename ($size_mb MB)..."

    # 간단한 PDF 헤더
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
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF) Tj
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
410
%%EOF
EOF

    # 파일 크기 조정 (더미 데이터 추가)
    local target_size=$((size_mb * 1024 * 1024))
    local current_size=$(stat -f%z "$filename" 2>/dev/null || stat -c%s "$filename" 2>/dev/null)

    if [ $current_size -lt $target_size ]; then
        dd if=/dev/zero bs=1 count=$((target_size - current_size)) >> "$filename" 2>/dev/null
    fi

    echo "✓ Created: $filename ($(du -h "$filename" | cut -f1))"
}

# 테스트 실행 함수
test_upload() {
    local file=$1
    local size_mb=$2

    if [ ! -f "$file" ]; then
        echo -e "${RED}✗ File not found: $file${NC}"
        return 1
    fi

    local actual_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    local actual_size_mb=$(echo "scale=2; $actual_size / 1024 / 1024" | bc)

    echo ""
    echo "────────────────────────────────────"
    echo "Testing: $file"
    echo "Size: ${actual_size_mb}MB"
    echo "────────────────────────────────────"

    # cURL 요청 (인증 없이 테스트)
    local start_time=$(date +%s.%N)

    local response=$(curl -s -w "\n%{http_code}\n%{time_total}" \
        -X POST "$API_ENDPOINT" \
        -F "file=@$file" \
        2>&1)

    local end_time=$(date +%s.%N)

    # 응답 파싱
    local http_code=$(echo "$response" | tail -n 2 | head -n 1)
    local time_total=$(echo "$response" | tail -n 1)
    local body=$(echo "$response" | head -n -2)

    # 결과 출력
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ SUCCESS${NC}"
        echo "Status: $http_code"
        echo "Time: ${time_total}s"

        # 응답에서 정보 추출 (jq가 있으면)
        if command -v jq &> /dev/null; then
            local extracted=$(echo "$body" | jq -r '.totalExtracted // 0' 2>/dev/null)
            local processing_time=$(echo "$body" | jq -r '.processingTime // "N/A"' 2>/dev/null)
            echo "Extracted texts: $extracted"
            echo "Server processing: ${processing_time}s"
        fi
    elif [ "$http_code" = "413" ]; then
        echo -e "${YELLOW}⚠ EXPECTED FAILURE (File too large)${NC}"
        echo "Status: $http_code (Payload Too Large)"
        echo "Error: $(echo "$body" | jq -r '.error // "Unknown"' 2>/dev/null)"
    elif [ "$http_code" = "401" ]; then
        echo -e "${YELLOW}⚠ AUTHENTICATION REQUIRED${NC}"
        echo "Status: $http_code"
        echo "Note: Run with authentication token for full test"
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "Status: $http_code"
        echo "Response: $body"
    fi
}

# 테스트 파일 디렉토리 생성
TEST_DIR="./test-pdfs"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo ""
echo "Preparing test files..."
echo ""

# 테스트 PDF 파일 생성
create_test_pdf 1 "test-1mb.pdf"
create_test_pdf 5 "test-5mb.pdf"
create_test_pdf 10 "test-10mb.pdf"
create_test_pdf 25 "test-25mb.pdf"
create_test_pdf 50 "test-50mb.pdf"
create_test_pdf 51 "test-51mb.pdf"

echo ""
echo "======================================"
echo "Running Load Tests"
echo "======================================"

# 테스트 실행
test_upload "test-1mb.pdf" 1
test_upload "test-5mb.pdf" 5
test_upload "test-10mb.pdf" 10
test_upload "test-25mb.pdf" 25
test_upload "test-50mb.pdf" 50
test_upload "test-51mb.pdf" 51

echo ""
echo "======================================"
echo "Test Summary"
echo "======================================"
echo ""
echo "Expected Results:"
echo "  - 1MB, 5MB, 10MB, 25MB, 50MB: ✓ SUCCESS"
echo "  - 51MB: ⚠ 413 Payload Too Large"
echo ""
echo "Test files saved in: $TEST_DIR"
echo "To clean up: rm -rf $TEST_DIR"
echo ""
