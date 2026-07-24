#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
olib.py — 오케스트레이터 공용 라이브러리 (사양서 v1.3 §4·§5·§5′·§6·§7)

- 원장(ledger.jsonl): append-only. 쓰기 실패 = HALT (킬스위치 §6).
- 상태(state.json): 항상 직렬화 — 중단 후 resume 가능.
- 검수큐: GATE_<id>.md / INPUT_<단계>_<제품>.md 카드 발행.
- 상태: PENDING → RUNNING → (WAITING_HUMAN | WAITING_INPUT | HALTED) → APPROVED/REJECTED → 다음.
"""
import datetime
import json
import unicodedata
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent
CONFIG = ROOT / "config.yaml"


def _load_keyfile():
    """키설정.txt → 환경변수. 비개발자용 — 파일에 붙여넣기만 하면 인식."""
    import os
    kf = ROOT / "키설정.txt"
    if not kf.exists():
        return
    for line in kf.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and v and not os.environ.get(k):
            os.environ[k] = v
    # 별칭: 채점관 키(JUDGE_KEY)가 비어 있으면 기존 KIMI_API_KEY 를 그대로 쓴다
    # (RC 2축 판정 관행 — Kimi 가 채점관. 키를 두 군데 관리하지 않게)
    if not os.environ.get("JUDGE_KEY") and os.environ.get("KIMI_API_KEY"):
        os.environ["JUDGE_KEY"] = os.environ["KIMI_API_KEY"]


_load_keyfile()

STAGES = [
    ("CORPUS_AUDIT", "① 코퍼스 실측"),
    ("TERRAIN", "② 지형 판정"),
    ("COVERAGE_MAP", "③ 커버리지맵"),
    ("GOLDENSET_BATCH", "④ 골든셋 배치"),
    ("UNIFIED_LEDGER", "⑤ 통합 대장"),
    ("CALIBRATION", "⑥ 캘리브레이션"),
    ("STAGE2", "⑦ 본판정"),
    ("SCORING", "⑧ 실물 채점"),
    ("MAINTENANCE", "⑨ 유지보수"),
]
STAGE_KEYS = [k for k, _ in STAGES]
HUMAN_GATES = {"TERRAIN", "GOLDENSET_BATCH", "CALIBRATION", "SCORING", "MAINTENANCE"}  # §4 [GATE:사람]

STATUSES = {"PENDING", "RUNNING", "WAITING_HUMAN", "WAITING_INPUT", "HALTED", "DONE", "REJECTED"}


def N(s):
    return unicodedata.normalize("NFC", str(s)) if s is not None else ""


def now():
    return datetime.datetime.now().isoformat(timespec="seconds")


def load_config():
    cfg = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    # terrain.d/<코드>.yaml 오버레이 병합 — 온보딩이 config.yaml 본문을 건드리지 않고
    # 프로파일을 추가하는 경로 (§10.7 ⓐ terrain.profiles.<코드> 자동 생성)
    tdir = ROOT / "terrain.d"
    if tdir.is_dir():
        for f in sorted(tdir.glob("*.yaml")):
            try:
                prof = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
                cfg.setdefault("terrain", {}).setdefault("profiles", {}).update(prof)
            except yaml.YAMLError as e:
                # FLAG-04: 침묵 무시 금지 — 프로파일 증발은 참조 집합 사고다.
                # ledger_append는 load_config를 재호출하므로(재귀) 원장에 직접 기록한다.
                print(f"⚠ terrain.d/{f.name} 파싱 실패 — 프로파일 미적용: {str(e)[:120]}")
                try:
                    lp = ROOT / cfg["paths"]["ledger"]
                    with open(lp, "a", encoding="utf-8") as lf:
                        lf.write(json.dumps(
                            {"ts": now(), "product": None, "stage": "CONFIG", "gate_id": None,
                             "actor": "script:load_config", "action": "TERRAIN_OVERLAY_PARSE_FAIL",
                             "evidence": {"file": N(f.name), "error": str(e)[:200]},
                             "reason": "깨진 terrain 오버레이 — 해당 제품 프로파일 미적용 상태로 동작 중"},
                            ensure_ascii=False) + "\n")
                except OSError:
                    pass   # 원장 불가 상황은 이후 ledger_append 경로가 HALT로 잡는다
    return cfg


def _paths(cfg=None):
    cfg = cfg or load_config()
    p = cfg["paths"]
    return {
        "data": ROOT / p["data"],
        "queue": ROOT / p["queue"],
        "ledger": ROOT / p["ledger"],
        "state": ROOT / p["state"],
        "results": ROOT / p["results"],
        "manifest": ROOT / p["manifest"],
    }


# ── 원장 (append-only) ─────────────────────────────────────────
def ledger_append(stage, action, actor, evidence=None, gate_id=None, reason=None, product=None):
    """원장 1행 기록. 쓰기 실패는 킬스위치 사유 — 예외를 삼키지 않는다."""
    row = {"ts": now(), "product": product, "stage": stage, "gate_id": gate_id,
           "actor": actor, "action": action, "evidence": evidence or {}, "reason": reason}
    path = _paths()["ledger"]
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            f.flush()
    except OSError as e:
        # 원장 쓰기 실패 → HALT (§6). 상태에 직접 반영하고 예외 재발생.
        try:
            st = load_state()
            if product and product in st["products"]:
                st["products"][product]["status"] = "HALTED"
                st["products"][product]["halt_reason"] = f"원장 쓰기 실패: {e}"
                save_state(st, _skip_ledger=True)
        finally:
            raise
    return row


def ledger_tail(n=50):
    path = _paths()["ledger"]
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").strip().splitlines()
    return [json.loads(l) for l in lines[-n:]]


# ── 상태 (state.json) ─────────────────────────────────────────
def _initial_product_state():
    return {
        "stage": "CORPUS_AUDIT", "status": "PENDING",
        "calibration_passed": False,           # 규칙 C — 시작은 미통과
        "scorer_version": None,                # 규칙 D 기준점
        "compare_blocked": False,              # 규칙 D — 소급 재채점 완료 전 회차 비교 차단
        "stage_history": {}, "open_gates": [], "halt_reason": None,
    }


def load_state():
    path = _paths()["state"]
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    cfg = load_config()
    st = {"updated": now(), "products": {}}
    for prod in cfg["terrain"]["profiles"]:
        st["products"][prod] = _initial_product_state()
    save_state(st, _skip_ledger=True)
    return st


def save_state(st, _skip_ledger=False):
    st["updated"] = now()
    path = _paths()["state"]
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(st, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def set_status(prod, status, stage=None, reason=None, actor="script:orchestrator", evidence=None):
    st = load_state()
    ps = st["products"].setdefault(prod, _initial_product_state())
    if stage:
        ps["stage"] = stage
    prev = ps["status"]
    ps["status"] = status
    if status == "HALTED":
        ps["halt_reason"] = reason
    save_state(st)
    ledger_append(ps["stage"], f"{prev}→{status}", actor, evidence=evidence,
                  reason=reason, product=prod)
    if status == "HALTED":
        try:
            import notify
            notify.halt(prod, reason)   # 폰 알림 (no-op 안전)
        except Exception:
            pass
    return st


# ── 검수큐 카드 ─────────────────────────────────────────────
def issue_input_card(prod, stage, what, where, fmt, extra=""):
    """WAITING_INPUT 카드 — 입력물은 오케스트레이터가 달라고 멈춘다 (§5′)"""
    q = _paths()["queue"]
    q.mkdir(parents=True, exist_ok=True)
    card_id = f"INPUT_{stage}_{prod}"
    body = f"""# {card_id} — 입력 대기

- 발행: {now()} · WAITING_INPUT 검사기 (자동)
- 제품: {prod} · 단계: {dict(STAGES)[stage] if stage in STAGE_KEYS else stage}

## 무엇을
{what}

## 어느 경로에
`{where}`

## 어떤 형식으로
{fmt}

{extra}
> 투입된 입력물은 입구 검사(실측/형식 게이트/해시 매니페스트 등록)를 통과해야 RUNNING 전이.
> ("받으면 무조건 실측부터" — 영역 0 원칙의 전 입력물 일반화)
"""
    (q / f"{card_id}.md").write_text(body, encoding="utf-8")
    ledger_append(stage, "ISSUE_INPUT_CARD", "script:waiting_input", gate_id=card_id,
                  evidence={"what": what, "where": str(where)}, product=prod)
    return card_id


def issue_gate_card(prod, stage, gate_id, what_stopped, evidence, flags=None, recommendation=None,
                    simple=False):
    """WAITING_HUMAN 게이트 카드 — 플래그는 항목별 ack 필수 (§5, v1.2).
    simple=True: 형식 확인 게이트 — 화면에 [▶ 계속 진행] 단일 버튼 (반려는 작은 링크로)"""
    q = _paths()["queue"]
    q.mkdir(parents=True, exist_ok=True)
    flags = flags or []
    ack_lines = "\n".join(
        f"- [ ] ack: {f.get('type','플래그')} · {f.get('id','')} · {f.get('candidates','')}"
        + (f" — {f['note']}" if f.get('note') else "")
        for f in flags) or "(플래그 없음)"
    ev_lines = "\n".join(f"- {k}: {v}" for k, v in (evidence or {}).items())
    rec = f"\n## 기계 권고 (참고용 — 판단은 사람)\n{recommendation}\n" if recommendation else ""
    body = f"""# GATE_{gate_id} — 사람 게이트

- 발행: {now()} · 제품: {prod} · 단계: {dict(STAGES)[stage] if stage in STAGE_KEYS else stage}
{"- 결정 성격: 형식 확인 — 문제 없으면 계속 진행하면 됩니다" if simple else ""}
## 무엇을 / 왜 멈췄나
{what_stopped}

## 실측 수치
{ev_lines}

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
{ack_lines}
{rec}
## 재개
- 승인: `python3 tools/pipeline.py approve {gate_id}`
- 반려: `python3 tools/pipeline.py reject {gate_id} --reason "..."` (사유 필수)
"""
    (q / f"GATE_{gate_id}.md").write_text(body, encoding="utf-8")
    ledger_append(stage, "ISSUE_GATE_CARD", "script:orchestrator", gate_id=gate_id,
                  evidence=evidence, product=prod)
    # 상태에 게이트 오픈 기록
    st = load_state()
    ps = st["products"][prod]
    if gate_id not in [g["id"] for g in ps["open_gates"]]:
        ps["open_gates"].append({"id": gate_id, "stage": stage, "flags": flags,
                                 "acked": False, "issued": now()})
    save_state(st)
    try:
        import notify
        notify.gate_card(prod, gate_id, what_stopped, evidence)   # 폰 알림 (no-op 안전)
    except Exception:
        pass
    return gate_id


def close_gate(prod, gate_id):
    st = load_state()
    ps = st["products"][prod]
    ps["open_gates"] = [g for g in ps["open_gates"] if g["id"] != gate_id]
    save_state(st)
    card = _paths()["queue"] / f"GATE_{gate_id}.md"
    if card.exists():
        done = _paths()["queue"] / "완료"
        done.mkdir(exist_ok=True)
        card.rename(done / card.name)


def find_gate(gate_id):
    st = load_state()
    for prod, ps in st["products"].items():
        for g in ps["open_gates"]:
            if g["id"] == gate_id:
                return prod, ps, g
    return None, None, None


def advance_stage(prod):
    """현 단계 DONE → 다음 단계 PENDING"""
    st = load_state()
    ps = st["products"][prod]
    i = STAGE_KEYS.index(ps["stage"])
    ps["stage_history"][ps["stage"]] = {"done_at": now()}
    if i + 1 < len(STAGE_KEYS):
        ps["stage"] = STAGE_KEYS[i + 1]
        ps["status"] = "PENDING"
    else:
        ps["status"] = "DONE"
    save_state(st)
    return ps["stage"]
