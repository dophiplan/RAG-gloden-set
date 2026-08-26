#!/bin/bash
# 관제판 상태를 5분마다 GitHub에 자동 푸시 — 원격 채점센터(Claude)가 진행상황을 볼 수 있게.
# 사용법: 이 파일을 더블클릭(또는 터미널에서 실행)하고 창을 열어두면 됩니다. 중단은 Ctrl+C.
cd "$(dirname "$0")"
echo "[상태공유] 시작 — 5분마다 state.json·ledger·검수큐를 GitHub에 푸시합니다. 중단: Ctrl+C"
while true; do
  git add orchestrator/state.json orchestrator/ledger.jsonl orchestrator/검수큐 orchestrator/results/*.log 2>/dev/null
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -q -m "상태공유: $(date '+%m/%d %H:%M')"
    git pull --rebase -q origin main 2>/dev/null
    git push -q origin main \
      && echo "[상태공유] $(date '+%H:%M') 푸시 완료" \
      || echo "[상태공유] $(date '+%H:%M') 푸시 실패 — 네트워크 확인"
  else
    echo "[상태공유] $(date '+%H:%M') 변경 없음"
  fi
  sleep 300
done
