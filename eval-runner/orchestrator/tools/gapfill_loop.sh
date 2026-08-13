#!/bin/zsh
# gapfill_loop.sh — 커버리지맵 구멍 메우기 무인 완주 루프
#   사용: nohup zsh tools/gapfill_loop.sh CI manual > results/_gapfill_loop_manual.log 2>&1 &
# 종료 조건: 해당 범위 미커버 0 (rc=3) · 또는 최대 시도 횟수 소진
# 한도로 멈추면(rc=2 또는 부분 진행) 대기 후 체크포인트에서 이어서 재개 — 처음부터 다시 하지 않음
set -u
cd "$(dirname "$0")/.."
PROD=${1:-CI}; SCOPE=${2:-manual}; MAXTRY=${3:-60}; WAIT=${4:-1800}
LOG=results/_gapfill_${SCOPE}.log
for i in $(seq 1 $MAXTRY); do
  echo "=== [시도 $i/$MAXTRY] $(date '+%Y-%m-%d %H:%M:%S') $PROD/$SCOPE" >> $LOG
  PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py "$PROD" --scope "$SCOPE" >> $LOG 2>&1
  rc=$?
  echo "=== [시도 $i] 종료코드=$rc" >> $LOG
  if [ $rc -eq 3 ]; then echo "✅ $SCOPE 범위 완료 — 루프 종료" >> $LOG; exit 0; fi
  if [ $rc -eq 2 ]; then echo "⏸ 추출 0(한도 의심) — ${WAIT}초 후 재개" >> $LOG; sleep $WAIT; fi
done
echo "⚠ 최대 시도 소진 — 남은 미커버는 다음 실행에서 이어서" >> $LOG
