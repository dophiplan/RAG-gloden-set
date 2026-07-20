#!/bin/bash
# RAG 평가 관제판 켜기 — 이 파일을 더블클릭하면 됩니다.
# 서버: dashboard/serve.py (state.json + ledger.jsonl + 검수큐 + 자료실 + 승인/반려)

PORT=8791
DIR="$(cd "$(dirname "$0")/.." && pwd)"   # orchestrator 폴더
URL="http://localhost:${PORT}/"

echo "──────────────────────────────────────────"
echo " RAG 평가 관제판 (오케스트레이터 v0)"
echo " 폴더: $DIR"
echo "──────────────────────────────────────────"

if curl -s -o /dev/null "http://localhost:${PORT}/api/state" 2>/dev/null; then
  echo "이미 서버가 켜져 있습니다. 브라우저만 엽니다."
else
  echo "서버를 켭니다 (포트 ${PORT})..."
  cd "$DIR" || exit 1
  nohup python3 dashboard/serve.py --port ${PORT} >/tmp/pipeline_dashboard.log 2>&1 &
  sleep 1.5
fi

echo "브라우저를 엽니다: $URL"
open "$URL"

echo ""
echo "✅ 완료 — 관제판에서 트랙·검수큐·성적·원장을 확인하세요."
echo "   · 트랙 동그라미에 마우스 = 단계 설명 + 자료 다운로드"
echo "   · 승인/반려 버튼 = 원장(ledger.jsonl)에 자동 기록"
echo ""
