#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pipeline.py — 오케스트레이터 게이트 CLI + 단계 실행기 (사양서 v1.3 §4·§5·§6·§7)

사용:
  python3 tools/pipeline.py status [--product RV]
  python3 tools/pipeline.py run --product RV          # 멈출 때까지 단계 진행
  python3 tools/pipeline.py approve <gate_id> [--ack-all]
  python3 tools/pipeline.py reject <gate_id> --reason "..."
  python3 tools/pipeline.py resume --after-fix <제품> --reason "..."   # HALT 해제
  python3 tools/pipeline.py appeal <gate_id> --evidence "..."          # 반론 채널
  python3 tools/pipeline.py set-stage --product RV --stage SCORING --reason "..."  # 관리(원장 기록)
  python3 tools/pipeline.py onboard --product RM --name 리모트미팅 [--base blank]

원칙: 반려는 일상, HALT는 사고다. HALT는 승인으로도 못 넘고 resume --after-fix 로만.
"""
import argparse
import glob
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import olib
from olib import (N, STAGES, STAGE_KEYS, HUMAN_GATES, ROOT,
                  load_config, load_state, save_state, set_status,
                  ledger_append, issue_input_card, issue_gate_card,
                  close_gate, find_gate, advance_stage, now)

DATA = ROOT / "data"


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def files_in(prod, subdir, pattern="*"):
    d = DATA / prod / subdir
    if not d.is_dir():
        return []
    return sorted(p for p in d.glob(pattern) if p.is_file() and not p.name.startswith("."))


def canonical_of(prod, stage_dir, keyword=None):
    """카탈로그에서 해당 단계 정본 파일을 찾는다."""
    cat = json.loads((ROOT / "catalog" / "manifest.json").read_text(encoding="utf-8"))
    best = None
    for r in cat["files"]:
        if r["product"] != prod or r.get("duplicate_of") or not r.get("canonical"):
            continue
        if r["stage_dir"] != stage_dir:
            continue
        if keyword and keyword not in r["file"]:
            continue
        best = r
    return (DATA / best["dest"]) if best and best.get("dest") else None


# ── 단계 실행기: 반환 = ("DONE"|"WAITING_INPUT"|"WAITING_HUMAN"|"HALTED"|"BLOCKED", evidence) ──
def st_corpus_audit(prod, cfg):
    corpus = files_in(prod, "01_corpus_audit") + files_in(prod, "corpus")
    if not corpus:
        issue_input_card(prod, "CORPUS_AUDIT",
                         what=f"{prod} 코퍼스 export (RAG 시스템 인입분 전량)",
                         where=f"data/{prod}/corpus/",
                         fmt="export 파일(xlsx/json/zip). 투입 시: 청크 실측 + match_corpus 중첩 검사 + 해시 매니페스트 등록 후 ① 시작")
        return "WAITING_INPUT", {"corpus_files": 0}
    # 입구 검사: 해시 매니페스트 등록 (규칙 B′의 벽 — 이름이 아니라 내용물)
    mf_path = ROOT / "catalog" / f"manifest_corpus_{prod}.json"
    entries = [{"file": N(p.name), "sha256": sha256_file(p), "size": p.stat().st_size,
                "registered": now()} for p in corpus]
    mf_path.write_text(json.dumps({"product": prod, "entries": entries},
                                  ensure_ascii=False, indent=2), encoding="utf-8")
    return "DONE", {"corpus_files": len(corpus), "manifest": mf_path.name}


def st_terrain(prod, cfg):
    prof = cfg["terrain"]["profiles"].get(prod, {})
    if prof.get("onboarding"):
        issue_gate_card(prod, "TERRAIN", f"TERRAIN_{prod}",
                        what_stopped=f"{prod} terrain 프로파일 확정 필요 — citation/앵커 패턴·부록 스위치를 사람이 판정",
                        evidence={"프로파일": "초안(복제/빈)", "확정 항목": "citation_pattern·anchor_patterns·appendix_switches"},
                        recommendation="기존 제품(RV/RC) 프로파일과 코퍼스 실측 결과를 대조해 결정")
        return "WAITING_HUMAN", {"profile": "onboarding"}
    return "DONE", {"profile": "확정", "citation_pattern": prof.get("citation_pattern", "")}


def _open_gate_ids(prod):
    st = load_state()
    return {g["id"] for g in st["products"][prod]["open_gates"]}


def st_coverage_map(prod, cfg):
    maps = files_in(prod, "03_coverage_map", "*.xlsx")
    if maps and f"COVMAP_{prod}" not in _open_gate_ids(prod):
        return "DONE", {"map": N(maps[-1].name), "files": len(maps)}
    # 맵이 없으면 생성 엔진 실행 (③ 생성→검수→반려 루프 + ③′ GAP_AUDIT)
    import gen_coverage
    corpus = files_in(prod, "corpus")
    if not corpus:
        issue_input_card(prod, "COVERAGE_MAP",
                         what=f"{prod} 코퍼스 export (커버리지맵 생성 재료)",
                         where=f"data/{prod}/corpus/",
                         fmt="json([{doc,chunk_id,text}]) 또는 md/txt (빈 줄 2개=청크 구분)")
        return "WAITING_INPUT", {}
    return gen_coverage.run(prod, cfg)


def st_goldenset_batch(prod, cfg):
    st = load_state()
    gs = st["products"][prod].get("goldenset", {})
    open_here = {g for g in _open_gate_ids(prod) if g.startswith(("GSPLAN", "GSBATCH", "GSCLOSE"))}
    if gs.get("phase") == "DONE" and not open_here:
        return "DONE", {"goldenset": "마감 완료", "batches": len(files_in(prod, "04_goldenset_batch", "*.xlsx"))}
    # 기존 제품(과거 수동 산출물 보유 + 통합 대장 존재)은 이력 인정
    if files_in(prod, "04_goldenset_batch", "*.xlsx") and files_in(prod, "05_unified_ledger", "*.xlsx") and not gs:
        return "DONE", {"batches": len(files_in(prod, "04_goldenset_batch", "*.xlsx")), "이력": "수동 생산분"}
    import gen_goldenset
    return gen_goldenset.run(prod, cfg)


def st_unified_ledger(prod, cfg):
    files = files_in(prod, "05_unified_ledger", "*.xlsx")
    if not files:
        issue_input_card(prod, "UNIFIED_LEDGER",
                         what=f"{prod} 통합 대장 (전 배치 합본 — ④ 마감이 자동 생성)",
                         where=f"data/{prod}/05_unified_ledger/",
                         fmt="통합 STAGE 대장 xlsx")
        return "WAITING_INPUT", {}
    u = files[-1]
    # 입구 검사: ID 중복 0 (전사 무결 최소선)
    import openpyxl
    wb = openpyxl.load_workbook(u, read_only=True, data_only=True)
    ids = []
    for sn in wb.sheetnames:
        ws = wb[sn]
        try:
            hdr = [N(c) for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
        except StopIteration:
            continue
        if "ID" in hdr and "질문" in hdr:
            i = hdr.index("ID")
            for r in ws.iter_rows(min_row=2, values_only=True):
                v = N(r[i]) if i < len(r) else ""
                if v:
                    ids.append(v)
            break
    wb.close()
    dup = len(ids) - len(set(ids))
    if dup:
        return "HALTED", {"ledger": N(u.name), "rows": len(ids), "ID중복": dup,
                          "halt": "참조 집합 훼손 — ID 충돌"}
    return "DONE", {"ledger": N(u.name), "rows": len(ids), "ID중복": 0}


def st_calibration(prod, cfg):
    try:
        import calibration
        return calibration.run(prod, cfg)
    except ImportError:
        pass
    t = canonical_of(prod, "06_calibration", keyword="대조표")
    if not t:
        issue_input_card(prod, "CALIBRATION",
                         what=f"{prod} 캘리브레이션 대조표 (LLM 30 vs 사람 30)",
                         where=f"data/{prod}/06_calibration/",
                         fmt="대조표 xlsx — 문항별 양측 판정 + 불일치 사유 3분류")
        return "WAITING_INPUT", {}
    return "WAITING_HUMAN", {"대조표": N(t.name)}


def st_stage2(prod, cfg):
    st = load_state()
    if not st["products"][prod]["calibration_passed"]:
        return "BLOCKED", {"사유": "규칙 C — calibration_passed=false, 본판정 잠금"}
    v = files_in(prod, "07_stage2", "*판정대장*.xlsx")
    if v:
        return "DONE", {"판정대장": N(v[-1].name)}
    # 판정대장이 없으면 본판정 실행 (⑦ 전건 판정 + 재검 시드 원장 기록)
    import judge_run
    return judge_run.run_stage2(prod, cfg)


def st_scoring(prod, cfg):
    try:
        import scoring
        return scoring.run(prod, cfg)
    except ImportError:
        pass
    logs = files_in(prod, "08_scoring", "*응답로그*.json") + files_in(prod, "logs", "*.json")
    if not logs:
        issue_input_card(prod, "SCORING",
                         what=f"{prod} 응답 로그 (팀장님 시스템 응시 결과)",
                         where=f"data/{prod}/08_scoring/ 또는 data/{prod}/logs/",
                         fmt="json — meta(search_scope) + responses 전량. 투입 시 형식 게이트 자동 실행",
                         extra=f"질문셋 발행본이 이미 있다면 발행 게이트(ID·질문 2컬럼) 통과분인지 확인")
        return "WAITING_INPUT", {"logs": 0}
    return "WAITING_HUMAN", {"logs": len(logs)}


def st_maintenance(prod, cfg):
    issue_gate_card(prod, "MAINTENANCE", f"MAINT_{prod}",
                    what_stopped=f"{prod} 유지보수 큐 판단 — 전제 실효/오탐 되먹임은 사람 판정",
                    evidence={"되먹임 (a)": "전제 실효 후보 → 골든셋 vN+1 개정 큐",
                              "되먹임 (b)": "오탐·측정 불능 → 채점기 개정 큐 → 규칙 D"})
    return "WAITING_HUMAN", {}


RUNNERS = {
    "CORPUS_AUDIT": st_corpus_audit, "TERRAIN": st_terrain, "COVERAGE_MAP": st_coverage_map,
    "GOLDENSET_BATCH": st_goldenset_batch, "UNIFIED_LEDGER": st_unified_ledger,
    "CALIBRATION": st_calibration, "STAGE2": st_stage2, "SCORING": st_scoring,
    "MAINTENANCE": st_maintenance,
}


# ── 명령들 ──────────────────────────────────────────────────
def cmd_status(a):
    st = load_state()
    prods = [a.product] if a.product else list(st["products"])
    print(f"state.json 갱신: {st['updated']}")
    for p in prods:
        ps = st["products"][p]
        label = dict(STAGES).get(ps["stage"], ps["stage"])
        cal = "통과" if ps["calibration_passed"] else "미통과(규칙 C)"
        print(f"\n[{p}] {label} · {ps['status']} · 캘리브레이션 {cal}"
              + (f" · 비교차단(규칙 D)" if ps.get("compare_blocked") else ""))
        if ps.get("halt_reason"):
            print(f"   ⛔ HALT: {ps['halt_reason']}")
        for g in ps["open_gates"]:
            print(f"   ▸ 게이트 열림: {g['id']} (플래그 {len(g.get('flags', []))})")
        hist = ps.get("stage_history", {})
        if hist:
            print(f"   완료: {', '.join(dict(STAGES)[k].split(' ')[0] for k in STAGE_KEYS if k in hist)}")


def cmd_run(a):
    cfg = load_config()
    prod = a.product
    st = load_state()
    if prod not in st["products"]:
        sys.exit(f"미등록 제품: {prod} — onboard 먼저")
    for _ in range(len(STAGE_KEYS) + 1):
        st = load_state()
        ps = st["products"][prod]
        if ps["status"] == "HALTED":
            print(f"⛔ {prod} HALTED — {ps['halt_reason']} · resume --after-fix 로만 해제")
            return
        if ps["status"] == "WAITING_HUMAN":
            print(f"⏸  {prod} {ps['stage']} · WAITING_HUMAN — 카드 확인: 검수큐/")
            return
        # WAITING_INPUT / REJECTED 은 재검사 — 투입물이 들어왔으면 입구 검사 후 전이 (§5′)
        if ps["status"] == "DONE":
            print(f"✅ {prod} 전 단계 완료")
            return
        stage = ps["stage"]
        set_status(prod, "RUNNING", stage=stage)
        outcome, ev = RUNNERS[stage](prod, cfg)
        print(f"  {dict(STAGES)[stage]} → {outcome} {ev}")
        if outcome == "DONE":
            ledger_append(stage, "STAGE_DONE", "script:pipeline", evidence=ev, product=prod)
            # 소비된 INPUT 카드 정리 (입구 검사 통과 = 카드 해소)
            qdir = ROOT / cfg["paths"]["queue"]
            done_dir = qdir / "완료"
            for card in qdir.glob(f"INPUT_*_{prod}.md"):
                if f"INPUT_{stage}_" in card.name or stage in card.name:
                    done_dir.mkdir(exist_ok=True)
                    card.rename(done_dir / card.name)
            nxt = advance_stage(prod)
            if nxt == stage:
                break
        elif outcome == "WAITING_INPUT":
            set_status(prod, "WAITING_INPUT", reason="입력물 부재", evidence=ev)
            return
        elif outcome == "WAITING_HUMAN":
            set_status(prod, "WAITING_HUMAN", evidence=ev)
            return
        elif outcome == "BLOCKED":
            print(f"  🔒 {ev}")
            set_status(prod, "PENDING", reason=str(ev))
            return
        elif outcome == "HALTED":
            set_status(prod, "HALTED", reason=json.dumps(ev, ensure_ascii=False))
            return


def cmd_approve(a):
    prod, ps, g = find_gate(a.gate_id)
    if not g:
        sys.exit(f"열린 게이트 없음: {a.gate_id}")
    flags = g.get("flags", [])
    if flags and not a.ack_all:
        print(f"플래그 {len(flags)}건 — 항목별 ack 필요. 확인했으면 --ack-all 로 승인 (원장에 항목별 기록).")
        for f in flags:
            print(f"  · {f.get('type')} {f.get('id')} {f.get('candidates')}")
        sys.exit(1)
    for f in flags:
        ledger_append(g["stage"], "FLAG_ACK", f"사람:{a.actor}", gate_id=a.gate_id,
                      evidence=f, product=prod)
    ledger_append(g["stage"], "approve", f"사람:{a.actor}", gate_id=a.gate_id,
                  evidence={"flags_acked": len(flags)}, product=prod)
    close_gate(prod, a.gate_id)
    # 승인 = 게이트만 닫는다. 단계 전진은 러너가 DONE을 보고할 때만 (다중 게이트 단계 대응).
    st = load_state()
    ps = st["products"][prod]
    if ps["stage"] == g["stage"]:
        if g["stage"] == "TERRAIN":
            # 승인 = 지형 확정 — terrain.d 오버레이의 onboarding 플래그 해제
            import yaml as _yaml
            tf = ROOT / "terrain.d" / f"{prod}.yaml"
            if tf.exists():
                d = _yaml.safe_load(tf.read_text(encoding="utf-8")) or {}
                if prod in d:
                    d[prod]["onboarding"] = False
                    tf.write_text(_yaml.safe_dump(d, allow_unicode=True, sort_keys=False),
                                  encoding="utf-8")
        if g["stage"] == "CALIBRATION" and a.gate_id.startswith("CAL_"):
            ps["calibration_passed"] = True     # 임계 통과 게이트 승인 시에만
        if g["stage"] == "MAINTENANCE":
            ps["status"] = "DONE"
            save_state(st)
            ledger_append("MAINTENANCE", "PRODUCT_CYCLE_DONE", f"사람:{a.actor}", product=prod)
            print(f"✅ 승인 — {a.gate_id} · {prod} 사이클 완료")
            return
        ps["status"] = "PENDING"
        save_state(st)
    print(f"✅ 승인 — {a.gate_id} (ack {len(flags)}건 원장 기록). 다음: run --product {prod}")


def cmd_reject(a):
    if not a.reason:
        sys.exit("반려는 사유 필수 — --reason")
    prod, ps, g = find_gate(a.gate_id)
    if not g:
        sys.exit(f"열린 게이트 없음: {a.gate_id}")
    ledger_append(g["stage"], "reject", f"사람:{a.actor}", gate_id=a.gate_id,
                  reason=a.reason, product=prod)
    close_gate(prod, a.gate_id)
    set_status(prod, "REJECTED", reason=a.reason)
    print(f"↩ 반려 — {a.gate_id} · 사유 원장 기록. (반려는 일상 — 수정 재제출 후 run)")


def cmd_resume(a):
    st = load_state()
    prod = a.after_fix
    ps = st["products"].get(prod)
    if not ps or ps["status"] != "HALTED":
        sys.exit(f"{prod} 는 HALTED 상태가 아님")
    if not a.reason:
        sys.exit("HALT 해제는 사유 기록 필수 — --reason")
    ledger_append(ps["stage"], "RESUME_AFTER_FIX", f"사람:{a.actor}",
                  reason=a.reason, evidence={"halt_was": ps["halt_reason"]}, product=prod)
    ps["status"] = "PENDING"
    ps["halt_reason"] = None
    save_state(st)
    print(f"🔓 HALT 해제 — {prod} (원인 제거 확인 + 사유 원장 기록)")


def cmd_appeal(a):
    if not a.evidence:
        sys.exit("반론은 실측 증거 필수 — --evidence")
    ledger_append("APPEAL", "appeal", f"사람:{a.actor}", gate_id=a.gate_id,
                  evidence={"주장": a.evidence}, product=a.product)
    print(f"📮 반론 접수 — {a.gate_id}. 사람 재판정 → 철회 시 원장에 철회+판례화 행 기록 (FEAT-006/074)")


def cmd_set_stage(a):
    """관리용 — 실제 이력을 반영해 위치 보정. 반드시 원장 기록."""
    if not a.reason:
        sys.exit("set-stage 는 사유 필수 — --reason")
    st = load_state()
    ps = st["products"][a.product]
    if a.stage not in STAGE_KEYS:
        sys.exit(f"단계 오류: {a.stage} ∈ {STAGE_KEYS}")
    for k in STAGE_KEYS[:STAGE_KEYS.index(a.stage)]:
        ps["stage_history"].setdefault(k, {"done_at": "(이력 반영)"})
    ps["stage"] = a.stage
    ps["status"] = "PENDING"
    if a.calibration_passed:
        ps["calibration_passed"] = True
    save_state(st)
    ledger_append(a.stage, "SET_STAGE", f"사람:{a.actor}", reason=a.reason,
                  evidence={"calibration_passed": ps["calibration_passed"]}, product=a.product)
    print(f"🧭 {a.product} → {a.stage} (원장 기록)")


def cmd_onboard(a):
    """제품 온보딩 — §10.7: 제품은 화면 구조가 아니라 데이터다"""
    prod = a.product.upper()
    cfg = load_config()
    st = load_state()
    if prod in st["products"] and not a.force:
        sys.exit(f"{prod} 이미 존재")
    # ⓐ terrain.profiles.<코드> 자동 생성 — terrain.d/ 오버레이로 (config.yaml 본문 불변)
    if prod not in cfg["terrain"]["profiles"]:
        import yaml as _yaml
        base_prof = dict(cfg["terrain"]["profiles"].get(a.base, {})) if a.base in cfg["terrain"]["profiles"] else {}
        prof = {
            "citation_pattern": base_prof.get("citation_pattern", f"{prod}-[A-Z]+(?:-[A-Z0-9]+)*-\\d+").replace(a.base + "-", f"{prod}-") if base_prof else f"{prod}-[A-Z]+(?:-[A-Z0-9]+)*-\\d+",
            "question_id_pattern": f"{prod}-[A-Z]\\d+",
            "anchor_patterns": base_prof.get("anchor_patterns", []),
            "anchor_suspect_pattern": base_prof.get("anchor_suspect_pattern", "\\(20\\d\\d-\\d\\d-\\d\\d[^)]*\\)"),
            "anchor_required_prefixes": [],
            "appendix_switches": base_prof.get("appendix_switches", []),
            "map_fact_column": "이 단위가 말하는 사실", "map_unit_column": "Unit ID",
            "onboarding": True,   # ② 지형 판정 사람 게이트에서 확정 후 해제
        }
        tdir = ROOT / "terrain.d"
        tdir.mkdir(exist_ok=True)
        (tdir / f"{prod}.yaml").write_text(
            _yaml.safe_dump({prod: prof}, allow_unicode=True, sort_keys=False), encoding="utf-8")
        print(f"terrain.d/{prod}.yaml 생성 (base={a.base}) — ② 지형 판정 게이트에서 확정")
    # ⓑ data 스캐폴드
    for d in ["corpus", "01_corpus_audit", "03_coverage_map", "04_goldenset_batch",
              "05_unified_ledger", "06_calibration", "07_stage2", "08_scoring", "09_maintenance"]:
        (DATA / prod / d).mkdir(parents=True, exist_ok=True)
    # ⓒ 상태 생성 (①에서 정지) + ⓓ 규칙 C
    st["products"][prod] = {"stage": "CORPUS_AUDIT", "status": "PENDING",
                            "calibration_passed": False, "scorer_version": None,
                            "compare_blocked": False, "stage_history": {},
                            "open_gates": [], "halt_reason": None}
    save_state(st)
    # ⓔ 원장 ONBOARD 행
    ledger_append("CORPUS_AUDIT", "ONBOARD", f"사람:{a.actor}",
                  evidence={"name": a.name or prod, "terrain_base": a.base, "dirs": "created"},
                  product=prod)
    # 트랙을 ①에서 WAITING_INPUT 정지 + INPUT_CORPUS 카드
    issue_input_card(prod, "CORPUS_AUDIT",
                     what=f"{prod} 코퍼스 export",
                     where=f"data/{prod}/corpus/",
                     fmt="export 파일. 투입 시: 청크 실측 + match_corpus 중첩 + 해시 매니페스트 등록 후 ① 시작")
    set_status(prod, "WAITING_INPUT", reason="온보딩 — 코퍼스 대기")
    print(f"🆕 {prod} 온보딩 — ① WAITING_INPUT 정지 · INPUT_CORPUS 카드 발행 · calibration_passed=false")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("status"); s.add_argument("--product")
    s = sub.add_parser("run"); s.add_argument("--product", required=True)
    s = sub.add_parser("approve"); s.add_argument("gate_id"); s.add_argument("--ack-all", action="store_true"); s.add_argument("--actor", default="송하")
    s = sub.add_parser("reject"); s.add_argument("gate_id"); s.add_argument("--reason"); s.add_argument("--actor", default="송하")
    s = sub.add_parser("resume"); s.add_argument("--after-fix", required=True, metavar="제품"); s.add_argument("--reason"); s.add_argument("--actor", default="송하")
    s = sub.add_parser("appeal"); s.add_argument("gate_id"); s.add_argument("--evidence"); s.add_argument("--product"); s.add_argument("--actor", default="작업AI")
    s = sub.add_parser("set-stage"); s.add_argument("--product", required=True); s.add_argument("--stage", required=True); s.add_argument("--reason"); s.add_argument("--calibration-passed", action="store_true", dest="calibration_passed"); s.add_argument("--actor", default="송하")
    s = sub.add_parser("onboard"); s.add_argument("--product", required=True); s.add_argument("--name"); s.add_argument("--base", default="blank"); s.add_argument("--force", action="store_true"); s.add_argument("--actor", default="송하")
    a = ap.parse_args()
    {"status": cmd_status, "run": cmd_run, "approve": cmd_approve, "reject": cmd_reject,
     "resume": cmd_resume, "appeal": cmd_appeal, "set-stage": cmd_set_stage,
     "onboard": cmd_onboard}[a.cmd](a)


if __name__ == "__main__":
    main()
