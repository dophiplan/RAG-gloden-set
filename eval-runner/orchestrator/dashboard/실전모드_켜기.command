#!/bin/bash
# 실전 모드 — 진짜 claude(구독 CLI)가 커버리지맵·골든셋·판정을 만든다.
# 이 파일을 더블클릭하면: config를 CLI 앙상블로 바꾸고 → 관제판을 실전 모드로 켠다.
# (연습 모드로 되돌리려면 '대시보드_켜기.command' 를 더블클릭)

PORT=8791
DIR="$(cd "$(dirname "$0")/.." && pwd)"   # orchestrator 폴더
URL="http://localhost:${PORT}/"
cd "$DIR" || exit 1

echo "──────────────────────────────────────────"
echo " 실전 모드 — 진짜 AI(claude 구독)로 가동"
echo "──────────────────────────────────────────"

# 1) claude 로그인 확인
if ! command -v claude >/dev/null 2>&1; then
  echo "⛔ claude CLI가 없습니다. 먼저 설치가 필요해요."; read -p "엔터로 닫기"; exit 1
fi

# 2) 과금 위험 환경변수 차단 안내
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "⚠ ANTHROPIC_API_KEY가 설정돼 있습니다 — 구독 대신 키 과금 위험."
  echo "  (오케스트레이터는 자식 실행 시 자동 제거하지만, 가능하면 비워두세요.)"
fi

# 3) [P1-1] config.yaml은 편성의 정본 — 스크립트가 되쓰지 않는다.
#    (과거엔 여기서 models 섹션을 매번 재작성해 judge가 kimi-k3로 회귀하고
#     judge_extract·주석의 결정 사항이 지워졌음 — 전수검수 P1-1. 편성 변경은 config.yaml에서 직접.)
export JUDGE_KEY="${JUDGE_KEY:-$KIMI_API_KEY}"
if ! grep -q "^models:" config.yaml; then
  echo "⛔ config.yaml에 models 편성이 없습니다 — git으로 복구하세요 (스크립트는 재작성하지 않음)"
  read -p "엔터로 닫기"; exit 1
fi
echo "편성: config.yaml 현행 유지 (출제 claude · 채점 $(grep -o 'kimi-[a-z0-9.]*' config.yaml | head -1) · 교차 codex)"

# 4) 기존 서버 끄고 실전 모드(ORCH_MOCK 없이)로 재시작
pkill -f "serve.py --port ${PORT}" 2>/dev/null; sleep 1
unset ORCH_MOCK ANTHROPIC_API_KEY
nohup python3 dashboard/serve.py --port ${PORT} >/tmp/pipeline_dashboard.log 2>&1 &
sleep 1.5

# 텔레그램 게이트 봇 — 폰 알림 + 폰에서 승인/반려 (없으면 조용히 생략)
if [ -f .telegram.json ]; then
  if ! { [ -f results/_tg_bot.pid ] && ps -p "$(cat results/_tg_bot.pid)" >/dev/null 2>&1; }; then
    nohup python3 tools/tg_gate_bot.py > results/logs/tg_bot.log 2>&1 &
    echo $! > results/_tg_bot.pid
    echo "텔레그램 봇 켜짐 (폰 알림·결정)"
  fi
fi

echo "브라우저를 엽니다: $URL"
open "$URL"
echo ""
echo "✅ 실전 모드 켜짐 — 이제 대시보드에서 승인을 누르면 진짜 claude가 만듭니다."
echo "   · 새 제품(RM 등)은 data/<제품>/corpus/ 에 코퍼스 파일을 넣고 시작"
echo "   · 연습으로 돌아가려면: 대시보드_켜기.command 더블클릭"
echo ""
