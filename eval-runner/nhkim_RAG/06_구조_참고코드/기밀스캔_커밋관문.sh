#!/bin/zsh
# 기밀스캔_커밋관문.sh — Stop 훅 자동 커밋 '전에' 스테이징 내용을 검열하는 관문
#
# 왜 (실측 사고 2026-08-13): 자동 커밋이 스테이징된 것을 검열 없이 공개 저장소로 밀어
#   고객사명이 담긴 파일이 그대로 푸시됐다(커밋 94a1ca55). 사람이 아니라 경로가 원인이므로
#   커밋 직전에 기계 검열을 둔다.
#
# 동작: 스테이징된 '추가되는 줄'에서 기밀 단어를 찾으면 → 커밋 중단 + 해당 경로 언스테이징 +
#       경고 파일 기록. 나머지는 정상 커밋되게 둔다 (작업 유실 방지).
# 금지어 목록: eval-runner/orchestrator/기밀단어.txt (추적 제외 — 단어 자체가 기밀)
set -u
ROOT=/Users/nanheekim
WORDS=$ROOT/eval-runner/orchestrator/기밀단어.txt
WARN=$ROOT/eval-runner/orchestrator/results/_기밀스캔_경고.txt
cd $ROOT || exit 0
[ -f "$WORDS" ] || exit 0                       # 목록 없으면 검열 없음 (기존 동작 유지)

PAT=$(grep -v '^#' "$WORDS" | sed '/^[[:space:]]*$/d' | paste -sd'|' -)
[ -n "$PAT" ] || exit 0

# 스테이징된 파일별로 '추가되는 줄'만 검사
HITS=()
for f in $(git diff --cached --name-only); do
  if git diff --cached -- "$f" | grep -E "^\+" | grep -Eqi "$PAT"; then
    HITS+=("$f")
  fi
done

if [ ${#HITS[@]} -gt 0 ]; then
  mkdir -p $(dirname $WARN)
  {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 기밀 단어가 포함돼 자동 커밋에서 제외된 경로:"
    for f in "${HITS[@]}"; do echo "  · $f"; done
    echo "조치: 해당 파일에서 기밀 문자열을 지우거나 금고(비공개 저장소)로 옮긴 뒤 다시 커밋하세요."
  } >> $WARN
  for f in "${HITS[@]}"; do git restore --staged "$f" 2>/dev/null; done
  echo "⚠ 기밀 스캔 — ${#HITS[@]}개 경로를 자동 커밋에서 제외했습니다 (results/_기밀스캔_경고.txt 확인)"
fi
exit 0
