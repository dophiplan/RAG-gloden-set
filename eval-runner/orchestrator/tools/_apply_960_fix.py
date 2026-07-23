#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""RC2-960 사후 반려 이행 — RUNNING 중 state 충돌을 피해, 멈춤 타이밍에 장부 반영.
(일회용: 반영 후 스스로 삭제)"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from olib import load_state, save_state, ledger_append

UNIT = "RC2-HTTPSW-4439"
for _ in range(240):                      # 최대 4시간 대기
    st = load_state()
    ps = st["products"]["RC2"]
    if ps["status"] != "RUNNING":
        gs = ps["goldenset"]
        if UNIT in gs["done_units"]:
            gs["done_units"] = [u for u in gs["done_units"] if u != UNIT]
            lb = gs.get("last_batch") or {}
            if lb.get("label") == "19차":
                lb["file"] = "RC2_골든셋_19차_3문항_v1_1.xlsx"
                lb["units"] = [u for u in lb.get("units", []) if u != UNIT]
            save_state(st)
            ledger_append("GOLDENSET_BATCH", "ITEM_REMOVED", "script:claude(사후 반려 이행)",
                          evidence={"문항": "RC2-960", "배치": "19차 → 3문항 v1_1",
                                    "사유": "사람: 반려인데 승인 오클릭 — 사후 삭제 지시",
                                    "반환 단위": UNIT}, product="RC2")
            ledger_append("GOLDENSET_BATCH", "UNITS_RETURNED", "script:claude(사후 반려 이행)",
                          evidence={"반환": 1, "사유": "삭제 문항 단독 인용 단위"}, product="RC2")
            print("적용 완료 — done_units에서 반환, 장부 기록")
        else:
            print("이미 미보유 — 장부 변경 없음")
        Path(__file__).unlink()
        sys.exit(0)
    time.sleep(60)
print("4시간 내 멈춤 없음 — 수동 확인 필요")
