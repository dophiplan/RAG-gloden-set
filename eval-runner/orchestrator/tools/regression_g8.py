#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
regression_g8.py — 수리 발주 v1.1 회귀 T10~T16 (실전 경계: git·과금·동시성·중단)

T10 gitignore: 임시 저장소에서 키설정.txt 생성 → status 미등장
T11 우체통 경합: bare 원격 + 클론 2개 (a) 양쪽 발송 모두 원격 도달 (b) 원격 차단 시 SEND_FAILED 정지
T12 우체통 변조: 소포 파일 변조 → RECV_HASH_MISMATCH 검출 + 투입 금지 카드
T13 본판정 중단→재개: 3번째 배치 강제 예외 → 재실행 → 완주(판정 수=문항 수) + 미판정 주입 → 게이트
T14 과금 차단: 자식 프로세스 env에 ANTHROPIC_API_KEY 부재
T15 지문 CLI 버전: 버전 문자열 변경 → 지문 변화 (규칙 C 트리거)
T16 저장소 분리: 우체통 원격 = 코드 저장소 → 거부
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "tools"))
os.environ["ORCH_MOCK"] = "1"

results = []


def check(tid, desc, ok, detail=""):
    results.append((tid, ok))
    print(f"{'✅' if ok else '❌'} {tid} {desc}" + (f" — {detail}" if detail else ""))


def sh(cmd, cwd=None, env=None, ok_fail=False):
    p = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd,
                       env={**os.environ, **(env or {})})
    if not ok_fail and p.returncode != 0:
        raise RuntimeError(f"{cmd} → {p.returncode}\n{p.stderr[:300]}")
    return p


def pb(args, box, me, env=None, ok_fail=False):
    return sh([sys.executable, str(ROOT / "tools/postbox.py")] + args, cwd=str(ROOT),
              env={"POSTBOX_DIR": str(box), "POSTBOX_ME": me, **(env or {})}, ok_fail=ok_fail)


def t10():
    with tempfile.TemporaryDirectory() as td:
        repo = Path(td) / "r"
        repo.mkdir()
        sh(["git", "init", "-q"], cwd=str(repo))
        # [R-1 수리] 검사 대상 = 저장소 루트의 .gitignore (홈 디렉토리 아님 —
        # 작업 머신에서 홈=저장소라 우연히 통과했던 결함. 회귀도 산출물이다)
        shutil.copy(ROOT.parent.parent / ".gitignore", repo / ".gitignore")
        d = repo / "eval-runner/orchestrator"
        d.mkdir(parents=True)
        (d / "키설정.txt").write_text("GEN_KEY=비밀", encoding="utf-8")
        p = sh(["git", "-c", "core.quotePath=false", "status", "--porcelain"], cwd=str(repo))
        visible = "키설정.txt" in p.stdout
        chk = sh(["git", "check-ignore", "eval-runner/orchestrator/키설정.txt"],
                 cwd=str(repo), ok_fail=True)
        check("T10", "gitignore — 키설정.txt status 미등장 + check-ignore 매칭",
              (not visible) and chk.returncode == 0)


def t11_t12():
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        bare = td / "remote.git"
        sh(["git", "init", "-q", "--bare", str(bare)])
        boxA, boxB = td / "boxA", td / "boxB"
        pb(["setup", "--repo", str(bare)], boxA, "AI1")
        # 첫 클론이 빈 저장소면 초기 커밋 필요
        if not (boxA / "README.md").exists():
            (boxA / "README.md").write_text("우체통\n", encoding="utf-8")
            sh(["git", "add", "-A"], cwd=str(boxA))
            sh(["git", "commit", "-q", "-m", "init"], cwd=str(boxA))
            sh(["git", "push", "-q", "origin", "HEAD"], cwd=str(boxA))
        pb(["setup", "--repo", str(bare)], boxB, "AI2")

        # (a) 경합: A 발송 → B는 stale 상태에서 발송 (push 거부 → rebase 재시도 → 성공해야)
        f1, f2 = td / "a.txt", td / "b.txt"
        f1.write_text("from A")
        f2.write_text("from B")
        pb(["send", "--title", "SopoA", "--files", str(f1)], boxA, "AI1")
        p = pb(["send", "--title", "SopoB", "--files", str(f2)], boxB, "AI2")
        # 검증: 원격에 두 소포 모두 존재
        verify = td / "verify"
        sh(["git", "clone", "-q", str(bare), str(verify)])
        mans = list(verify.rglob("manifest.json"))
        titles = {json.loads(m.read_text(encoding="utf-8"))["title"] for m in mans}
        check("T11a", "경합 발송 — rebase 재시도 후 양쪽 소포 원격 도달",
              {"SopoA", "SopoB"} <= titles, f"원격 소포: {sorted(titles)}")

        # (b) 원격 차단 → SEND_FAILED 정지 (성공 출력 금지)
        bare.rename(td / "remote.gone")
        f3 = td / "c.txt"
        f3.write_text("blocked")
        p = pb(["send", "--title", "SopoC", "--files", str(f3)], boxA, "AI1", ok_fail=True)
        led = (ROOT / "ledger.jsonl").read_text(encoding="utf-8")
        check("T11b", "원격 차단 — exit≠0 + SEND_FAILED 원장 + 성공출력 없음",
              p.returncode != 0 and "SEND_FAILED" in led and "발송 확인: SopoC" not in p.stdout,
              f"exit={p.returncode}")
        (td / "remote.gone").rename(bare)

        # T12: B의 소포를 A쪽 클론에서 변조 후 poll → MISMATCH
        # (T11b가 남긴 미푸시 커밋 정리 — 원격 복구 후 rebase+push로 동기화)
        sh(["git", "pull", "--rebase", "-q", "origin", "HEAD"], cwd=str(boxA), ok_fail=True)
        sh(["git", "pull", "--rebase", "-q"], cwd=str(boxA), ok_fail=True)
        sh(["git", "push", "-q", "origin", "HEAD"], cwd=str(boxA), ok_fail=True)
        pb(["poll"], boxA, "AI1")   # 이제 정상 poll
        target = next((boxA / "outbox" / "AI2").rglob("b.txt"))
        target.write_text("변조됨!")
        # seen 초기화해 재수신 유도
        seen = boxA / ".postbox_seen.json"
        if seen.exists():
            seen.unlink()
        p = pb(["poll"], boxA, "AI1")
        led = (ROOT / "ledger.jsonl").read_text(encoding="utf-8")
        card = next((ROOT / "검수큐").glob("POSTBOX_AI2_SopoB.md"), None)
        card_warn = card and "해시 불일치" in card.read_text(encoding="utf-8")
        check("T12", "변조 소포 → RECV_HASH_MISMATCH + 투입 금지 카드",
              "RECV_HASH_MISMATCH" in led and bool(card_warn))
        # 테스트 카드 정리
        for c in (ROOT / "검수큐").glob("POSTBOX_AI*.md"):
            c.unlink()


def t13():
    import judge_run
    import olib
    import openpyxl
    prod = "ZZ"
    d = ROOT / "data" / prod
    if d.exists():
        shutil.rmtree(d)
    (d / "05_unified_ledger").mkdir(parents=True)
    (d / "07_stage2").mkdir(parents=True)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["ID", "유형", "질문", "정답", "근거 출처", "근거 원문 발췌", "합격 기준"])
    for i in range(1, 51):   # 50문항 = 배치 20 기준 3배치
        ws.append([f"ZZ-A{i:02d}", "A", f"질문{i}?", f"정답{i}", f"ZZ-DOC-{i:03d}", f"발췌문장{i}입니다", "요소"])
    wb.save(d / "05_unified_ledger" / "ZZ_통합대장_50문항_v1_0.xlsx")
    st = olib.load_state()
    st["products"].setdefault(prod, {"stage": "STAGE2", "status": "PENDING",
                                     "calibration_passed": True, "scorer_version": None,
                                     "compare_blocked": False, "stage_history": {},
                                     "open_gates": [], "halt_reason": None})
    st["products"][prod]["calibration_passed"] = True
    olib.save_state(st)
    cfg = olib.load_config()
    # (a) 3번째 배치 강제 예외 → 중단 + progress 보존
    os.environ["ORCH_FAIL_AT_BATCH"] = "3"
    interrupted = False
    try:
        judge_run.run_stage2(prod, cfg)
    except RuntimeError:
        interrupted = True
    del os.environ["ORCH_FAIL_AT_BATCH"]
    prog = d / "07_stage2" / "_stage2_progress.jsonl"
    n_saved = len(prog.read_text(encoding="utf-8").splitlines()) if prog.exists() else 0
    check("T13a", "3번째 배치 강제 예외 → 중단 + 기왕 판정 보존",
          interrupted and n_saved == 40, f"보존 {n_saved}/40")
    # (b) 재실행 → 이어받아 완주, 판정 수 = 문항 수
    outcome, ev = judge_run.run_stage2(prod, cfg)
    total = sum(ev.get("판정", {}).values()) if outcome == "DONE" else 0
    check("T13b", "재실행 resume → 완주 (판정 수 = 문항 수 50)",
          outcome == "DONE" and total == 50, f"{outcome} · 판정 {total}")
    # (c) 미판정 1건 주입 → DONE 금지, 게이트 발행
    for f in (d / "07_stage2").glob("*"):
        f.unlink()
    os.environ["ORCH_DROP_ID"] = "ZZ-A05"
    outcome, ev = judge_run.run_stage2(prod, cfg)
    del os.environ["ORCH_DROP_ID"]
    check("T13c", "미판정 1건 주입 → WAITING_HUMAN 게이트 (DONE 금지)",
          outcome == "WAITING_HUMAN" and ev.get("미판정") == 1, f"{outcome} {ev}")
    # 정리
    st = olib.load_state()
    st["products"].pop(prod, None)
    olib.save_state(st)
    shutil.rmtree(d)
    g = ROOT / "검수큐" / "GATE_S2MISS_ZZ.md"
    if g.exists():
        g.unlink()


def t14():
    import llm
    probe = ROOT / "results" / "_env_probe.py"
    probe.write_text("import os,sys; sys.stdin.read(); print('LEAK' if os.environ.get('ANTHROPIC_API_KEY') else 'CLEAN')",
                     encoding="utf-8")
    os.environ["ANTHROPIC_API_KEY"] = "sk-test-danger"
    os.environ.pop("ORCH_MOCK", None)   # _cli 실호출 경로
    try:
        out = llm._cli({"provider": "cli", "command": [sys.executable, str(probe)]}, "s", "u")
    finally:
        del os.environ["ANTHROPIC_API_KEY"]
        os.environ["ORCH_MOCK"] = "1"
        probe.unlink()
    check("T14", "자식 프로세스 env에서 ANTHROPIC_API_KEY 제거", out.strip().endswith("CLEAN"), out.strip()[-20:])


def t15():
    import copy
    import calibration
    from olib import load_config
    cfg = copy.deepcopy(load_config())
    cfg["models"]["judge"] = {"provider": "cli", "command": ["claude", "-p"], "model": "m1"}
    os.environ["ORCH_CLI_VERSION_OVERRIDE"] = "v1.0.0"
    f1 = calibration.fingerprint("RV", cfg)
    os.environ["ORCH_CLI_VERSION_OVERRIDE"] = "v1.0.1"
    f2 = calibration.fingerprint("RV", cfg)
    del os.environ["ORCH_CLI_VERSION_OVERRIDE"]
    check("T15", "CLI 버전 문자열 변경 → 지문 변화 (규칙 C 트리거)", f1 != f2)


def t16():
    """[권고① 수용] origin 유무와 무관하게 가드를 항상 실검사 — mock origin 직접 주입"""
    import postbox
    fake = "https://github.com/mock-org/mock-code-repo.git"
    orig_fn = postbox.code_repo_origin
    postbox.code_repo_origin = lambda: fake
    try:
        # (a) 동일 origin → 거부돼야
        try:
            postbox.guard_separate_repo(fake)
            same_blocked = False
        except postbox.PostboxError:
            same_blocked = True
        # (b) 다른 origin → 통과돼야
        try:
            postbox.guard_separate_repo("https://github.com/mock-org/postbox-repo.git")
            diff_ok = True
        except postbox.PostboxError:
            diff_ok = False
    finally:
        postbox.code_repo_origin = orig_fn
    check("T16", "저장소 분리 가드 — 동일 origin 거부 + 상이 origin 통과 (mock 주입 실검사)",
          same_blocked and diff_ok, f"동일차단={same_blocked} 상이통과={diff_ok}")


def main():
    t10()
    t11_t12()
    t13()
    t14()
    t15()
    t16()
    npass = sum(1 for _, ok in results if ok)
    print(f"\n{'='*54}\nG8 회귀: {npass}/{len(results)} 통과")
    sys.exit(0 if npass == len(results) else 1)


if __name__ == "__main__":
    main()
