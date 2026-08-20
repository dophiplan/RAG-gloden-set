#!/bin/zsh
# kimi_watchdog.sh — Kimi 재추출 걸림 감시 [실측 2026-08-20: 죽은 SSL 연결에서 53분 대기]
cd "$(dirname "$0")/.."
while pgrep -f "밤샘_재추출.sh" >/dev/null || pgrep -f "rebase_compare_extract" >/dev/null; do
  sleep 600
  CK=results/_ckpt_coverage_CI_rebasecmp_judge_s2.json
  [ -f $CK ] || continue
  AGE=$(( $(date +%s) - $(stat -f %m $CK) ))
  KP=$(pgrep -f "role judge --shard" | head -1)
  if [ -n "$KP" ] && [ $AGE -gt 2400 ]; then
    echo "[감시견] Kimi ${AGE}초 무갱신 — 강제 재시작 $(date '+%T')" >> results/_밤샘재추출.log
    kill $KP 2>/dev/null; sleep 5
    SP=$(ps -eo pid,command | grep "sleep 1800" | grep -v grep | awk '{print $1}' | head -1)
    [ -n "$SP" ] && kill $SP 2>/dev/null
  fi
done
