#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sbb_review.py — 설계본부 자동 소환 (3권 분립의 실체화)

게이트 카드가 발행되면 설계본부(시스템 프롬프트 v1.2 + 판례집)를 **독립된 새 세션**으로
소환해 검수 소견을 받고, 카드에 "설계본부 소견" 섹션으로 첨부한다.

분립 원칙:
- 생성(작업 AI) ≠ 검증(설계본부, 이 스크립트가 소환) ≠ 확정(사람) — §1
- 설계본부는 소견·권고까지만: 승인/반려 버튼은 여전히 사람만 누른다
- 설계본부 세션은 작업 맥락을 받지 않는다 — 프롬프트+판례집+카드+산출물 발췌만 (새 세션)

사용: python3 tools/sbb_review.py --product RC2 --gate GSBATCH_RC2_파일럿
      (auto_run 이 WAITING_HUMAN 도달 시 자동 호출)
"""
import argparse
import json
import re
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).parent))
import llm
from olib import ROOT, N, load_config, load_state, ledger_append

PROMPT = ROOT.parent / "설계본부_시스템프롬프트_v1_2.md"
CASES = ROOT.parent / "판례집_v1_0.md"
MARK = "## 설계본부 소견"


def artifact_preview(prod, card_body, max_rows=8):
    """카드가 가리키는 산출물(xlsx)의 표본 — 설계본부가 실물을 보고 판정하게"""
    names = re.findall(r"[\w가-힣_.\-]+\.xlsx", card_body)
    for name in names:
        for p in (ROOT / "data" / prod).rglob(name):
            try:
                ws = openpyxl.load_workbook(p, read_only=True, data_only=True).active
                rows = list(ws.iter_rows(values_only=True, max_row=max_rows + 1))
            except Exception:
                continue
            lines = [f"### 산출물 표본: {name} (앞 {len(rows)-1}행)"]
            for r in rows:
                lines.append(" | ".join(str(c)[:60] for c in r if c is not None))
            return "\n".join(lines)[:6000]
    return "(첨부 산출물 표본 없음 — 카드 실측 수치로 판정)"


def review(prod, gate_id):
    card = ROOT / "검수큐" / f"GATE_{gate_id}.md"
    if not card.exists():
        sys.exit(f"카드 없음: {card.name}")
    body = card.read_text(encoding="utf-8")
    if MARK in body:
        print("이미 소견 있음 — 생략")
        return
    system = (PROMPT.read_text(encoding="utf-8") + "\n\n---\n\n# 판례집 (주입)\n"
              + CASES.read_text(encoding="utf-8"))
    user = (f"다음 게이트 카드를 검수하라. 판정문 필수 성분 5(§2-2)를 갖춘 소견서만 출력하라.\n"
            f"너는 확정하지 않는다 — 승인/반려는 사람이 누른다. 권고와 근거(조항·판례 번호 인용)까지만.\n"
            f"모호하면 '사람확인 필요'로 명기하라(§2-5).\n\n"
            f"# 게이트 카드\n{body}\n\n{artifact_preview(prod, body)}")
    cfg = load_config()
    try:
        opinion = llm.chat("generator", system, user, cfg)   # 새 세션 (llm은 무상태 — 규칙 B와 동일 구조)
    except Exception as e:
        opinion = f"(설계본부 소환 실패: {str(e)[:150]} — 사람이 직접 판단 필요)"
    stamped = body.rstrip() + f"\n\n{MARK} (독립 세션 · 참고 — 확정은 사람)\n{N(opinion).strip()}\n"
    card.write_text(stamped, encoding="utf-8")
    ledger_append("GOVERNANCE", "SBB_REVIEWED", "설계본부:독립세션",
                  evidence={"gate": gate_id, "소견 길이": len(opinion),
                            "주입": "프롬프트 v1.2 + 판례집 + 카드 + 산출물 표본 (작업 맥락 없음)"},
                  product=prod)
    print(f"설계본부 소견 첨부 완료 — {card.name}")


def review_open_gates(prod):
    """제품의 열린 게이트 전부 — 소견 없는 카드만"""
    st = load_state()
    for g in st["products"].get(prod, {}).get("open_gates", []):
        review(prod, g["id"])


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--product", required=True)
    ap.add_argument("--gate", help="특정 게이트만 (생략 시 열린 게이트 전부)")
    a = ap.parse_args()
    if a.gate:
        review(a.product, a.gate)
    else:
        review_open_gates(a.product)
