#!/bin/bash
# CI 데이터 동기화 — 채점센터 vault(RAG-eval-CI-vault)의 작업 브랜치를 data/CI로 당겨온다.
# 더블클릭 후 대시보드 화면을 새로고침하면 CI 성적판이 갱신된다.
cd "$(dirname "$0")/../data/CI" || { echo "data/CI 폴더가 없습니다"; read -p "엔터를 누르면 닫힙니다"; exit 1; }
git fetch origin claude/resume-token-work-id1xu0 \
  && git checkout claude/resume-token-work-id1xu0 2>/dev/null \
  && git pull origin claude/resume-token-work-id1xu0 \
  && echo "" && echo "✅ CI 데이터 동기화 완료 — 브라우저에서 대시보드를 새로고침하세요."
read -p "엔터를 누르면 닫힙니다"
