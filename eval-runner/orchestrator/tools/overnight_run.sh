#!/bin/zsh
# overnight_run.sh — 밤샘 지휘자 (난희 지시 2026-08-13: 내일 아침까지 Kimi·codex 완주 목표)
#   ① Kimi·codex는 매뉴얼 조각을 지금 즉시 출발 (FAQ 대기 없음 — 노는 주자 없애기)
#   ② claude는 FAQ 완주 후 자기 매뉴얼 조각에 합류
#   ③ 세 조각 끝나면 병합 → 남은 미커버는 라운드 반복 (gapfill_shard.sh)
#   ④ caffeinate — 이 지휘자가 살아 있는 동안 맥이 잠들지 않음
set -u
cd "$(dirname "$0")/.."
LOG=results/_밤샘지휘.log
GLOG=results/_gapfill_manual.log
echo "=== 밤샘 시작 $(date '+%Y-%m-%d %H:%M:%S')" >> $LOG
caffeinate -is -w $$ &          # 지휘자(이 pid)가 끝날 때까지 잠들기 방지 (exec 후에도 pid 유지)
echo "☕ caffeinate 가동 — 맥 잠들기 방지" >> $LOG

# ① Kimi·codex 즉시 출발 (각자 조각 · 한도 시 서로가 예비 주자)
PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py CI --scope manual --shard 2/3 --role judge >> $GLOG 2>&1 &
P2=$!
PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py CI --scope manual --shard 3/3 --role reviewer >> $GLOG 2>&1 &
P3=$!
echo "🏃 Kimi(조각2, pid $P2) · codex(조각3, pid $P3) 출발" >> $LOG

# ② claude FAQ 완주 대기 → 매뉴얼 조각 1 합류
while pgrep -f "map_gapfill.py CI --scope faq" >/dev/null; do sleep 60; done
echo "✅ FAQ 종료 $(date '+%H:%M:%S') — claude 매뉴얼 조각1 합류" >> $LOG
PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py CI --scope manual --shard 1/3 --role generator >> $GLOG 2>&1 &
P1=$!

wait $P1 $P2 $P3 2>/dev/null
echo "🧩 1라운드 3조각 종료 — 병합 $(date '+%H:%M:%S')" >> $LOG
PYTHONUNBUFFERED=1 python3 tools/map_gapfill.py CI --scope manual --collect >> $GLOG 2>&1
rc=$?
echo "병합 rc=$rc" >> $LOG
[ $rc -eq 3 ] && { echo "🏁 매뉴얼 전체 커버 — 밤샘 종료 $(date)" >> $LOG; exit 0; }

# ③ 잔여 라운드 — 샤딩 루프가 끝까지 (완주 시 rc=3 종료)
exec zsh tools/gapfill_shard.sh CI manual
