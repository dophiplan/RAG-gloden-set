#!/bin/bash
# 사용법: ./scripts/fix-api-call.sh "파일경로" "API엔드포인트"
# 예: ./scripts/fix-api-call.sh "src/app/issues/page.tsx" "/api/issues"

FILE_PATH=$1
API_ENDPOINT=$2

if [ -z "$FILE_PATH" ] || [ -z "$API_ENDPOINT" ]; then
  echo "사용법: $0 <파일경로> <API엔드포인트>"
  echo "예: $0 'src/app/issues/page.tsx' '/api/issues'"
  exit 1
fi

echo "🔧 $FILE_PATH 수정 중..."
echo "   API: $API_ENDPOINT"

# import 추가 (없으면)
if ! grep -q "from '@/lib/api-utils'" "$FILE_PATH"; then
  sed -i '' "/^import/a \\
import { apiFetch } from '@/lib/api-utils';" "$FILE_PATH"
  echo "   ✓ import 추가됨"
fi

echo "✅ 수정 완료! 파일을 확인하고 테스트하세요."
echo ""
echo "📋 수동으로 변경할 내역:"
echo "   변경전: const response = await fetch('$API_ENDPOINT');"
echo "   변경후: const data = await apiFetch('$API_ENDPOINT');"
