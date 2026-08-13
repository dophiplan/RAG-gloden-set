#!/bin/zsh
# overnight_rounds.sh — 밤샘 지휘자 v2: '시간제 라운드' (난희 전수조사 후속 2026-08-13)
#
# 왜 v1을 버렸나: v1은 "3조각 전원 완주 → 병합"이라 제일 느린 주자(Kimi: 큰 매뉴얼에서
#   호출 1건 10분)가 밤새 라운드를 막는다. 실측: claude·codex 4분/배치 vs Kimi 15~20분/배치.
# v2: 라운드는 시간으로 끝난다(기본 2시간). 마감 시 남은 조각을 회수·병합하고,
#   남은 미커버를 '그 시점에 뛸 수 있는 주자 수'로 다시 나눈다 — 빠른 주자가 자연히 더 가져간다.
#   Kimi가 라운드에 10배치만 해도 그만큼 지도가 커지고, 아무도 기다리지 않는다.
#
# 사용: nohup zsh tools/overnight_rounds.sh CI manual > results/_overnight_nohup.log 2>&1 &
set -u
cd "$(dirname "$0")/.."
PROD=${1:-CI}; SCOPE=${2:-manual}
ROUND_SEC=${ROUND_SEC:-7200}   # 라운드 길이 (기본 2시간)
MAXROUND=${MAXROUND:-24}
LOG=results/_밤샘지휘.log
GLOG=results/_gapfill_${SCOPE}.log
echo "=== 지휘자 v2 (시간제 라운드 ${ROUND_SEC}s) $(date '+%F %T')" >> $LOG
caffeinate -is -w $$ &
echo "☕ caffeinate 가동" >> $LOG

launch_round() {
  # claude 가 FAQ 중이면 2분담(Kimi·codex), 아니면 3분담
  if pgrep -f "map_gapfill.py $PROD --scope faq" >/dev/null; then
    echo "  편성: 2분담 (claude 는 FAQ 마무리 중)" >> $LOG
    PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py $PROD --scope $SCOPE --shard 1/2 --role judge >> $GLOG 2>&1 &
    PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py $PROD --scope $SCOPE --shard 2/2 --role reviewer >> $GLOG 2>&1 &
  else
    echo "  편성: 3분담 (claude 합류)" >> $LOG
    PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py $PROD --scope $SCOPE --shard 1/3 --role generator >> $GLOG 2>&1 &
    PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py $PROD --scope $SCOPE --shard 2/3 --role judge >> $GLOG 2>&1 &
    PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py $PROD --scope $SCOPE --shard 3/3 --role reviewer >> $GLOG 2>&1 &
  fi
}

for i in $(seq 1 $MAXROUND); do
  echo "=== [라운드 $i/$MAXROUND] $(date '+%F %T')" >> $LOG
  # 이미 뛰는 조각이 있으면 입양(v1이 띄운 것), 없으면 새로 편성
  if ! pgrep -f "map_gapfill.py $PROD --scope $SCOPE --shard" >/dev/null; then
    launch_round
  else
    echo "  기존 조각 입양 — 이어서 진행" >> $LOG
  fi
  start=$(date +%s)
  while :; do
    sleep 120
    pgrep -f "map_gapfill.py $PROD --scope $SCOPE --shard" >/dev/null || { echo "  조각 전원 종료" >> $LOG; break; }
    el=$(( $(date +%s) - start ))
    if [ $el -ge $ROUND_SEC ]; then
      echo "  ⏱ 시간제 마감 — 남은 조각 회수 (체크포인트 보존, 다음 라운드에서 이어짐)" >> $LOG
      pkill -f "map_gapfill.py $PROD --scope $SCOPE --shard" 2>/dev/null
      sleep 8
      break
    fi
  done
  echo "  🧩 병합" >> $LOG
  PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py $PROD --scope $SCOPE --collect >> $GLOG 2>&1
  rc=$?
  echo "  병합 rc=$rc" >> $LOG
  if [ $rc -eq 3 ]; then
    # 이 범위 완주 — FAQ(claude)가 남았으면 그것까지 기다렸다 종료
    if [ "$SCOPE" = "manual" ]; then
      while pgrep -f "map_gapfill.py $PROD --scope faq" >/dev/null; do sleep 120; done
    fi
    echo "🏁 $SCOPE 전체 커버 — 밤샘 종료 $(date '+%F %T')" >> $LOG
    exit 0
  fi
done
echo "⚠ 라운드 소진 — 남은 미커버는 다음 실행에서" >> $LOG
