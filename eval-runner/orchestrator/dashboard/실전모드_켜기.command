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

# 3) config를 CLI 앙상블로 전환 (원본은 config.yaml.apikeys 로 1회 백업)
if [ ! -f config.yaml.apikeys ]; then cp config.yaml config.yaml.apikeys; fi
python3 - << 'PY'
from pathlib import Path
c = Path("config.yaml"); t = c.read_text(encoding="utf-8")
rest = t[t.index("pipeline:"):] if "pipeline:" in t else t
cli = ('models:\n'
       '  generator: {provider: "cli", command: ["claude", "-p"], model: "claude-opus-4-8"}\n'
       '  judge:     {provider: "cli", command: ["claude", "-p"], model: "claude-opus-4-8"}\n\n')
c.write_text(cli + rest, encoding="utf-8")
print("config → CLI 앙상블(claude 구독)로 전환 완료")
PY

# 4) 기존 서버 끄고 실전 모드(ORCH_MOCK 없이)로 재시작
pkill -f "serve.py --port ${PORT}" 2>/dev/null; sleep 1
unset ORCH_MOCK ANTHROPIC_API_KEY
nohup python3 dashboard/serve.py --port ${PORT} >/tmp/pipeline_dashboard.log 2>&1 &
sleep 1.5

echo "브라우저를 엽니다: $URL"
open "$URL"
echo ""
echo "✅ 실전 모드 켜짐 — 이제 대시보드에서 승인을 누르면 진짜 claude가 만듭니다."
echo "   · 새 제품(RM 등)은 data/<제품>/corpus/ 에 코퍼스 파일을 넣고 시작"
echo "   · 연습으로 돌아가려면: 대시보드_켜기.command 더블클릭"
echo ""
