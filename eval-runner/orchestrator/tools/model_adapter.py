#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
model_adapter.py — 모델 어댑터: 키 개수 자동 판별 + 규칙 A/B/B′ 집행 (사양서 v1.3 §3)

모드표 (§3):
  1키: 생성=generator 세션① · 1축=스크립트 · 2축=generator 신규 세션② · 교차 생략 · 재검 10%
  2키: 생성=generator · 1축=스크립트 · 2축=judge · 교차 생략 · 재검 5%
  3키: 생성=generator · 1축=스크립트 · 2축=judge · 3차=reviewer · 재검 5%

- 규칙 A: 1축은 항상 스크립트 — 이 모듈에 1축용 LLM 호출 함수 자체가 없다.
- 규칙 B (판정측 오염 차단): judge_call() 은 [문항, 판정 기준서] 만 받는다 —
  생성 맥락을 넘길 파라미터가 구조적으로 존재하지 않는다. 항상 새 세션.
- 규칙 B′ (생성측 오염 차단 — 해시 매니페스트): 생성 호출 첨부물 전건의 SHA-256을
  매니페스트와 대조. 미등록 해시는 호출 거부 + 원장 기록. 이름이 아니라 내용물로 벽.

사용:
  python3 tools/model_adapter.py mode                # 현재 모드 표시
  python3 tools/model_adapter.py guard <파일...>      # 첨부물 매니페스트 대조 (통과/거부)
  python3 tools/model_adapter.py register <파일...> --actor 송하  # 재료 재등록 (사람 게이트)
  python3 tools/model_adapter.py selftest
"""
import argparse
import hashlib
import json
import os
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from olib import ROOT, N, load_config, ledger_append, now


class ManifestViolation(Exception):
    pass


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ── 모드 판별 ──────────────────────────────────────────────
def detect_mode(cfg=None, env=None):
    cfg = cfg or load_config()
    env = env if env is not None else os.environ
    models = cfg.get("models", {})
    have = {}
    for role in ("generator", "judge", "reviewer"):
        m = models.get(role)
        # [v2] provider "cli" = 구독 로그인 CLI — 키 없이도 가용
        have[role] = bool(m and (m.get("provider") == "cli"
                                 or env.get(m.get("api_key_env", ""), "")))
    nkeys = sum(have.values())
    if not have["generator"]:
        mode = 0  # 키 없음 — 모델 호출 전면 불가 (검수·상태 기계만 동작)
    elif have["judge"] and have["reviewer"]:
        mode = 3
    elif have["judge"]:
        mode = 2
    else:
        mode = 1
    plan = {
        0: {"생성": None, "1축": "스크립트", "2축": None, "3차교차": None, "재검율": None},
        1: {"생성": "generator(세션①)", "1축": "스크립트", "2축": "generator(신규 세션②)",
            "3차교차": "생략", "재검율": 0.10},   # 1키는 코드가 0.10 강제 상향
        2: {"생성": "generator", "1축": "스크립트", "2축": "judge", "3차교차": "생략", "재검율": 0.05},
        3: {"생성": "generator", "1축": "스크립트", "2축": "judge", "3차교차": "reviewer", "재검율": 0.05},
    }[mode]
    return {"mode": mode, "have": have, "plan": plan}


def effective_recheck_rate(cfg=None, env=None):
    cfg = cfg or load_config()
    m = detect_mode(cfg, env)
    conf = cfg["pipeline"].get("recheck_rate", 0.05)
    if m["mode"] == 1:
        return max(conf, 0.10)   # 1키 모드 강제 상향
    return conf


# ── 규칙 B′: 해시 매니페스트 벽 ─────────────────────────────
def _load_manifest_hashes():
    """적법 재료 해시 전집: catalog/manifest.json + manifest_corpus_* + manifest_materials_*"""
    hashes = {}
    cat = ROOT / "catalog"
    mf = cat / "manifest.json"
    if mf.exists():
        for r in json.loads(mf.read_text(encoding="utf-8"))["files"]:
            hashes[r["sha256"]] = r["file"]
    for f in list(cat.glob("manifest_corpus_*.json")) + list(cat.glob("manifest_materials_*.json")):
        for e in json.loads(f.read_text(encoding="utf-8"))["entries"]:
            hashes[e["sha256"]] = e["file"]
    return hashes


def guard_attachments(paths, purpose="generation", product=None, raise_on_fail=True):
    """생성 호출 첨부물 전건 대조. 미등록 → 거부 + 원장 기록."""
    hashes = _load_manifest_hashes()
    report = []
    ok = True
    for p in paths:
        p = Path(p)
        if not p.exists():
            report.append({"file": N(p.name), "status": "MISSING"})
            ok = False
            continue
        h = sha256_file(p)
        if h in hashes:
            report.append({"file": N(p.name), "status": "REGISTERED", "as": hashes[h]})
        else:
            report.append({"file": N(p.name), "status": "UNREGISTERED", "sha256": h[:16]})
            ok = False
    if not ok:
        ledger_append("GENERATION", "ATTACHMENT_REFUSED", "script:manifest_guard",
                      evidence={"purpose": purpose, "report": report}, product=product,
                      reason="규칙 B′ — 미등록 해시 첨부물, 호출 거부 (이름이 아니라 내용물의 벽)")
        if raise_on_fail:
            raise ManifestViolation(json.dumps(report, ensure_ascii=False))
    return ok, report


def register_materials(paths, actor, product=None):
    """재료 갱신 시 매니페스트 재등록 — 사람 게이트 경유 (actor 필수, 원장 기록)"""
    if not actor:
        raise ValueError("재등록은 사람 게이트 경유 — --actor 필수")
    cat = ROOT / "catalog"
    mf_path = cat / f"manifest_materials_{product or 'COMMON'}.json"
    entries = []
    if mf_path.exists():
        entries = json.loads(mf_path.read_text(encoding="utf-8"))["entries"]
    added = []
    for p in paths:
        p = Path(p)
        h = sha256_file(p)
        e = {"file": N(p.name), "sha256": h, "size": p.stat().st_size,
             "registered": now(), "actor": f"사람:{actor}"}
        entries.append(e)
        added.append(e)
    mf_path.write_text(json.dumps({"product": product or "COMMON", "entries": entries},
                                  ensure_ascii=False, indent=2), encoding="utf-8")
    ledger_append("CORPUS_AUDIT", "MANIFEST_REGISTER", f"사람:{actor}",
                  evidence={"added": [e["file"] for e in added]}, product=product)
    return added


# ── 규칙 B: 판정 호출 빌더 — [문항, 판정 기준서]만 ──────────────
def build_judge_request(question_item: dict, rubric_text: str, cfg=None, env=None):
    """새 세션 판정 요청 페이로드. 생성 맥락 파라미터는 구조적으로 없음 (규칙 B).
    question_item 허용 키: ID/유형/질문/정답/근거 출처/근거 원문 발췌 (그 외 키는 제거)"""
    ALLOW = {"ID", "유형", "질문", "정답", "근거 출처", "근거 원문 발췌", "합격 기준"}
    clean = {k: v for k, v in question_item.items() if k in ALLOW}
    dropped = sorted(set(question_item) - ALLOW)
    m = detect_mode(cfg, env)
    role = "judge" if m["mode"] >= 2 else ("generator" if m["mode"] == 1 else None)
    if role is None:
        raise RuntimeError("판정 가능한 키 없음 (모드 0)")
    return {
        "role": role, "new_session": True,       # 항상 새 세션
        "inputs": {"문항": clean, "판정_기준서": rubric_text},
        "dropped_keys": dropped,                  # 오염 소지 키 제거 증적
        "mode": m["mode"],
    }


# ── CLI ────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("mode")
    s = sub.add_parser("guard"); s.add_argument("files", nargs="+"); s.add_argument("--product")
    s = sub.add_parser("register"); s.add_argument("files", nargs="+"); s.add_argument("--actor", required=True); s.add_argument("--product")
    sub.add_parser("selftest")
    a = ap.parse_args()

    if a.cmd == "mode":
        m = detect_mode()
        print(f"모드: {m['mode']}키 · 키 보유 {m['have']}")
        for k, v in m["plan"].items():
            print(f"  {k}: {v}")
        print(f"  실효 재검율: {effective_recheck_rate()}")
    elif a.cmd == "guard":
        ok, rep = guard_attachments(a.files, product=a.product, raise_on_fail=False)
        for r in rep:
            print(f"  [{r['status']:^12}] {r['file']}" + (f" (= {r.get('as','')})" if r.get('as') else ""))
        print("▶ " + ("통과 — 생성 호출 허용" if ok else "거부 — 미등록 해시 (원장 기록됨)"))
        sys.exit(0 if ok else 1)
    elif a.cmd == "register":
        added = register_materials(a.files, a.actor, a.product)
        for e in added:
            print(f"  등록: {e['file']} {e['sha256'][:16]}…")
    elif a.cmd == "selftest":
        selftest()


def selftest():
    import tempfile
    ok = True
    # 1) 모드 판별
    fake = {"models": {"generator": {"api_key_env": "T_G"}, "judge": {"api_key_env": "T_J"},
                       "reviewer": {"api_key_env": "T_R"}}, "pipeline": {"recheck_rate": 0.05}}
    for env, want, rr in [({}, 0, None), ({"T_G": "x"}, 1, 0.10),
                          ({"T_G": "x", "T_J": "x"}, 2, 0.05),
                          ({"T_G": "x", "T_J": "x", "T_R": "x"}, 3, 0.05)]:
        m = detect_mode(fake, env)
        got_rr = effective_recheck_rate(fake, env) if m["mode"] else None
        good = m["mode"] == want and got_rr == rr
        ok &= good
        print(f"  {'✅' if good else '❌'} 키 {list(env)} → {m['mode']}키 (재검 {got_rr})")
    # 2) 규칙 B′: 미등록 파일 거부
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False, dir=str(ROOT / "results")) as f:
        f.write(b"fake corpus export - outside wall")
        fake_path = f.name
    passed, rep = guard_attachments([fake_path], raise_on_fail=False)
    good = not passed
    ok &= good
    print(f"  {'✅' if good else '❌'} 미등록 위조 파일 → 거부 + 원장 기록")
    Path(fake_path).unlink()
    # 3) 등록된 정본 통과
    sample = next((ROOT / "data").glob("RV/03_coverage_map/*v1_3*"))
    passed, rep = guard_attachments([sample], raise_on_fail=False)
    ok &= passed
    print(f"  {'✅' if passed else '❌'} 등록 정본({N(sample.name)[:30]}…) → 통과")
    # 4) 규칙 B: 오염 키 제거
    req = build_judge_request({"ID": "X-1", "질문": "q", "정답": "a",
                               "생성_세션_근거사유": "오염!", "작업메모": "오염!"},
                              "기준서 v1", fake, {"T_G": "x", "T_J": "x"})
    good = req["new_session"] and "생성_세션_근거사유" not in req["inputs"]["문항"] \
        and req["dropped_keys"] == ["생성_세션_근거사유", "작업메모"] and req["role"] == "judge"
    ok &= good
    print(f"  {'✅' if good else '❌'} 판정 요청 — 새 세션 + 오염 키 {req['dropped_keys']} 제거")
    print(f"selftest: {'전건 통과' if ok else '실패 있음'}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
