#!/bin/zsh
# gapfill_shard.sh — 커버리지맵 구멍 메우기: 3-AI 분담(샤딩) 무인 완주 루프
#   claude·Kimi·codex가 미커버를 3등분해 동시에 뛰고, 라운드마다 성과를 지도에 병합.
#   한 주자가 한도로 멈추면 그 조각은 나머지 주자가 이어달림 (map_gapfill --role 폴백).
#   사용: nohup zsh tools/gapfill_shard.sh CI manual > results/_gapfill_shard_manual.log 2>&1 &
set -u
cd "$(dirname "$0")/.."
PROD=${1:-CI}; SCOPE=${2:-manual}; MAXROUND=${3:-40}; WAIT=${4:-1800}
LOG=results/_gapfill_${SCOPE}.log
for i in $(seq 1 $MAXROUND); do
  echo "=== [라운드 $i/$MAXROUND] $(date '+%Y-%m-%d %H:%M:%S') $PROD/$SCOPE 3분담" >> $LOG
  PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py $PROD --scope $SCOPE --shard 1/3 --role generator >> $LOG 2>&1 &
  P1=$!
  PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py $PROD --scope $SCOPE --shard 2/3 --role judge >> $LOG 2>&1 &
  P2=$!
  PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py $PROD --scope $SCOPE --shard 3/3 --role reviewer >> $LOG 2>&1 &
  P3=$!
  wait $P1 $P2 $P3
  echo "--- [라운드 $i] 병합" >> $LOG
  PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py $PROD --scope $SCOPE --collect >> $LOG 2>&1
  rc=$?
  echo "=== [라운드 $i] collect rc=$rc" >> $LOG
  if [ $rc -eq 3 ]; then echo "✅ $SCOPE 범위 전체 커버 — 종료" >> $LOG; exit 0; fi
  if [ $rc -eq 2 ]; then echo "⏸ 성과 0 (한도 의심) — ${WAIT}초 대기 후 재개" >> $LOG; sleep $WAIT; fi
done
echo "⚠ 라운드 소진 — 남은 미커버는 다음 실행에서 이어서" >> $LOG
