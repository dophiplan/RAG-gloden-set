#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
regression_rejectlock.py — '반려가 자동 진행에 무효화되던 사고' 회귀 시험

실측 사고 (2026-08-13, CI):
  14:00:46  사람:난희 reject COVMAP_CI (사유: 커버율 17.8%)
  14:00:47  script:orchestrator  REJECTED→RUNNING → STAGE_DONE → ④ GOLDENSET_BATCH 진입
  → 사람의 반려가 1초 만에 지워지고, 커버율 17.8% 맵으로 출제가 시작됐다.

시험 4종 (원장·실데이터 무기록 — 임시 state 사본에서만 동작):
  ① 반려 시 reject_lock 이 걸린다
  ② 잠금이 걸린 단계는 cmd_run 이 자동 진행을 거부한다
  ③ resume(다시 시도)로 잠금이 풀린다 — 영구 정지가 되지 않는다
  ④ 같은 단계 새 카드 승인으로도 잠금이 풀린다

사용: python3 tools/regression_rejectlock.py
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
PY = sys.executable
OKS, FAILS = [], []


def chk(name, cond, detail=""):
    (OKS if cond else FAILS).append(name)
    print(("  ✅ " if cond else "  ❌ ") + name + (f" — {detail}" if detail else ""))


def main():
    # 격리: state/ledger/검수큐를 임시 디렉터리로 (실데이터·원장 오염 금지)
    tmp = Path(tempfile.mkdtemp(prefix="rejlock_"))
    env = {**os.environ, "ORCH_MOCK": "1", "ORCH_ROOT": str(tmp)}
    for f in ("config.yaml",):
        if (ROOT / f).exists():
            shutil.copy(ROOT / f, tmp / f)
    (tmp / "검수큐").mkdir(exist_ok=True)
    (tmp / "results").mkdir(exist_ok=True)
    st = {"products": {"TT": {"stage": "COVERAGE_MAP", "status": "WAITING_HUMAN",
                              "halt_reason": None, "strategy": "solo",
                              "stage_history": {},
                              "open_gates": [{"id": "COVMAP_TT", "stage": "COVERAGE_MAP",
                                              "flags": [], "issued": "2026-08-13T00:00:00"}]}}}
    (tmp / "state.json").write_text(json.dumps(st, ensure_ascii=False), encoding="utf-8")

    def run(*args):
        return subprocess.run([PY, str(HERE / "pipeline.py"), *args], cwd=str(ROOT), env=env,
                              capture_output=True, text=True)

    def state():
        return json.loads((tmp / "state.json").read_text(encoding="utf-8"))["products"]["TT"]

    if "ORCH_ROOT" not in (ROOT / "tools" / "olib.py").read_text(encoding="utf-8"):
        print("⚠ olib 이 ORCH_ROOT 를 지원하지 않아 격리 실행 불가 — 시험 중단 (실데이터 보호 우선)")
        return 0

    print("■ ① 반려 → 잠금 설정")
    r = run("reject", "COVMAP_TT", "--reason", "커버율 부족(시험)", "--actor", "시험")
    ps = state()
    chk("반려 후 status=REJECTED", ps["status"] == "REJECTED", ps["status"])
    chk("reject_lock 이 해당 단계에 걸림",
        (ps.get("reject_lock") or {}).get("stage") == "COVERAGE_MAP", str(ps.get("reject_lock"))[:80])

    print("■ ② 잠긴 단계는 자동 진행 거부")
    r = run("run", "--product", "TT")
    ps = state()
    chk("run 이 잠금으로 멈춤(메시지)", "반려 잠금" in (r.stdout + r.stderr), (r.stdout + r.stderr)[-120:])
    chk("단계가 전진하지 않음", ps["stage"] == "COVERAGE_MAP", ps["stage"])
    chk("STAGE_DONE 이 찍히지 않음", "STAGE_DONE" not in (r.stdout + r.stderr))

    print("■ ③ [다시 시도](resume)로 잠금 해제 — 영구 정지 아님")
    r = run("resume", "--after-fix", "TT", "--reason", "구멍 메우기 완료(시험)", "--actor", "시험")
    ps = state()
    chk("resume 성공", r.returncode == 0, (r.stdout + r.stderr)[-100:])
    chk("잠금 제거됨", not ps.get("reject_lock"), str(ps.get("reject_lock"))[:60])

    print("■ ④ 같은 단계 새 카드 승인으로도 해제")
    st = json.loads((tmp / "state.json").read_text(encoding="utf-8"))
    st["products"]["TT"].update({
        "status": "WAITING_HUMAN",
        "reject_lock": {"stage": "COVERAGE_MAP", "gate_id": "COVMAP_TT", "reason": "이전 반려"},
        "open_gates": [{"id": "COVMAP_TT2", "stage": "COVERAGE_MAP", "flags": [],
                        "issued": "2026-08-13T01:00:00"}]})
    (tmp / "state.json").write_text(json.dumps(st, ensure_ascii=False), encoding="utf-8")
    r = run("approve", "COVMAP_TT2", "--actor", "시험")
    ps = state()
    chk("승인 후 잠금 제거", not ps.get("reject_lock"), (r.stdout + r.stderr)[-100:])

    shutil.rmtree(tmp, ignore_errors=True)
    print(f"\n■ 결과 — 통과 {len(OKS)} / 실패 {len(FAILS)}")
    if FAILS:
        print("실패:", ", ".join(FAILS))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
