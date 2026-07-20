#!/bin/bash
# 연습 모드 — 가짜 AI(mock)로 클릭 연습. 공짜, 실제 데이터/구독 안 씀.
# 이 파일을 더블클릭하면: (실전모드였다면) config를 원복하고 → 관제판을 연습 모드로 켠다.
# (진짜 AI로 돌리려면 '실전모드_켜기.command' 를 더블클릭)

PORT=8791
DIR="$(cd "$(dirname "$0")/.." && pwd)"   # orchestrator 폴더
URL="http://localhost:${PORT}/"
cd "$DIR" || exit 1

echo "──────────────────────────────────────────"
echo " 연습 모드 — 가짜 AI(mock)로 클릭 연습"
echo "──────────────────────────────────────────"

# 실전모드가 바꿔둔 config가 있으면 원복
if [ -f config.yaml.apikeys ]; then
  cp config.yaml.apikeys config.yaml
  echo "config 원복(API 키 설정본)"
fi

# 기존 서버 끄고 연습 모드(ORCH_MOCK=1)로 재시작
pkill -f "serve.py --port ${PORT}" 2>/dev/null; sleep 1
ORCH_MOCK=1 nohup python3 dashboard/serve.py --port ${PORT} >/tmp/pipeline_dashboard.log 2>&1 &
sleep 1.5

echo "브라우저를 엽니다: $URL"
open "$URL"
echo ""
echo "✅ 연습 모드 켜짐 — 승인을 눌러도 가짜 AI가 즉시 처리합니다(공짜)."
echo "   진짜 claude로 돌리려면: 실전모드_켜기.command 더블클릭"
echo ""
