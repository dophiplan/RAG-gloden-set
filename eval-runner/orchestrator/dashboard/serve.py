#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
serve.py — 관제 대시보드 로컬 서버 (사양서 v1.3 §10)

- state.json + ledger.jsonl **읽기 전용 뷰** (원장 편집 UI 없음 — 스크롤만)
- 검수큐 카드의 approve/reject 는 pipeline CLI 를 그대로 호출 (사유 필수·원장 기록)
- 로컬 전용: 127.0.0.1 바인딩

실행: python3 dashboard/serve.py [--port 8791]
"""
import argparse
import json
import re
import subprocess
import sys
import unicodedata
from collections import Counter
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "tools"))


def N(s):
    return unicodedata.normalize("NFC", str(s)) if s is not None else ""


def j(o):
    return json.dumps(o, ensure_ascii=False).encode("utf-8")


# ── 제품 1뎁스 구조 (U1) ──────────────────────────────────
# 사용자에게 보이는 건 제품(RV·RC). 내부 트랙 코드(RV2 등)는 세대 구현 상세.
PRODUCT_META = {
    "RV2": {"display": "RV", "product_name": "리모트뷰", "gen": "골든셋 v2.0 — 현역(구축 중)"},
    "RC2": {"display": "RC", "product_name": "리모트콜", "gen": "골든셋 v2.0 — 현역(구축 중)"},
}
LEGACY_GENS = {   # display → 이전 세대 (데이터 폴더 코드, 라벨)
    "RV": [{"code": "RV", "gen": "골든셋 v1 · 806문항 — 은퇴(정답키 공개, 참고용)"}],
    "RC": [{"code": "RC", "gen": "골든셋 v1.1 · 891문항 — 은퇴(정답키 공개, 참고용)"}],
}
HIDDEN_CODES = {"EE"}   # 자동 테스트 전용 제품 — 화면에서 숨김 (E2E가 쓰고 지나가는 자리)


def display_of(code):
    return PRODUCT_META.get(code, {}).get("display", code)


def api_state():
    import os
    st = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))
    # 제품 1뎁스 뷰모델: display 제품 → {현역 트랙 코드, 세대 라벨, 이전 세대들}
    st["_products"] = {}
    for code, ps in st["products"].items():
        if code in HIDDEN_CODES:
            continue
        meta = PRODUCT_META.get(code, {"display": code, "product_name": code, "gen": "현역"})
        st["_products"][meta["display"]] = {
            "code": code, "name": meta["product_name"], "gen": meta["gen"],
            "legacy": LEGACY_GENS.get(meta["display"], []),
        }
    # 모델 모드 부가
    try:
        from model_adapter import detect_mode, effective_recheck_rate
        m = detect_mode()
        if os.environ.get("ORCH_MOCK") == "1":
            label, cls = "연습 모드 — 가짜 AI (공짜)", "practice"
        elif m["mode"] == 0:
            label, cls = "모델 미연결 — 실전모드_켜기 실행 필요", "off"
        else:
            parts = []
            if m["have"].get("generator"): parts.append("출제 claude")
            if m["have"].get("judge"): parts.append("채점 Kimi" if m["mode"] >= 2 else "채점 claude(신규세션)")
            if m["have"].get("reviewer"): parts.append("교차 codex")
            label, cls = "실전 모드 — " + " · ".join(parts), "live"
        st["_mode"] = {"mode": m["mode"], "label": label, "cls": cls,
                       "plan": m["plan"], "recheck": effective_recheck_rate()}
    except Exception as e:
        st["_mode"] = {"mode": "?", "label": "상태 확인 실패", "cls": "off", "error": str(e)}
    # 킬스위치: HALTED 제품 수
    st["_halt_count"] = sum(1 for p in st["products"].values() if p["status"] == "HALTED")
    return st


def api_ledger(n=60):
    p = ROOT / "ledger.jsonl"
    if not p.exists():
        return []
    lines = p.read_text(encoding="utf-8").strip().splitlines()
    return [json.loads(x) for x in lines[-n:]][::-1]


def api_queue():
    q = ROOT / "검수큐"
    cards = []
    if q.is_dir():
        for f in sorted(q.glob("*.md")):
            body = f.read_text(encoding="utf-8")
            kind = "GATE" if f.name.startswith("GATE_") else "INPUT"
            gate_id = f.stem.replace("GATE_", "")
            m = re.search(r"제품: (\w+)", body)
            acks = re.findall(r"- \[ \] (?:ack: )?(.+)", body)
            cards.append({"file": N(f.name), "kind": kind, "id": gate_id,
                          "product": m.group(1) if m else "?",
                          "title": N(body.splitlines()[0].lstrip("# ")),
                          "body": body, "acks": acks if kind == "GATE" else []})
    return cards


def api_scores():
    """회차 성적 미니보드 — results/score_<P>_<r>/score_report.json 실측 집계"""
    out = {}
    for d in sorted((ROOT / "results").glob("score_*_r*")):
        m = re.match(r"score_(\w+)_(r\d+)", d.name)
        if not m:
            continue
        prod, rnd = m.group(1), m.group(2)
        rp = d / "score_report.json"
        if not rp.exists():
            continue
        rep = json.loads(rp.read_text(encoding="utf-8"))
        c = Counter(r.get("검색") for r in rep)
        g = Counter(r.get("생성") for r in rep)
        top1 = c.get("hit_top1", 0)
        out.setdefault(prod, {})[rnd] = {
            "top1": top1, "top5": top1 + c.get("hit_top5", 0),
            "pass": g.get("pass", 0), "partial": g.get("partial", 0),
            "E환각": sum(1 for r in rep if r.get("E형환각")),
            "E거절": sum(1 for r in rep if r.get("E형거절")),
            "n": len(rep), "scorer": "run_score_v11",
        }
    return out


def _scan_stage_files(code, sm, canon, gen_label=None):
    d = ROOT / "data" / code / sm["dir"]
    files = []
    if d.is_dir():
        fl = sorted((p for p in d.iterdir() if p.is_file() and not p.name.startswith(".")),
                    key=lambda p: p.name)

        def vkey(p):
            m = re.search(r"_v(\d+(?:_\d+)+)", p.name)
            return tuple(int(x) for x in m.group(1).split("_")) if m else (0,)
        best = max(fl, key=vkey).name if fl else None
        for p in fl:
            files.append({"file": N(p.name), "version": "",
                          "canonical": canon.get(N(p.name), p.name == best),
                          "size": p.stat().st_size, "gen": gen_label,
                          "path": f"{code}/{sm['dir']}/{p.name}"})
    return files


def api_catalog():
    """제품(1뎁스) → 단계 → 파일. 현역 세대 + 이전 세대(라벨 병기) 통합 스캔 (U1·U6)."""
    meta = json.loads((ROOT / "catalog" / "stage_meta.json").read_text(encoding="utf-8"))
    canon = {}
    mf = ROOT / "catalog" / "manifest.json"
    if mf.exists():
        for r in json.loads(mf.read_text(encoding="utf-8"))["files"]:
            if r.get("canonical"):
                canon[r["file"]] = True
    st = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))
    out = {"products": {}}
    for code in st["products"]:
        if code in HIDDEN_CODES:
            continue
        disp = display_of(code)
        stages = []
        for sm in meta["stages"]:
            files = _scan_stage_files(code, sm, canon)                      # 현역 세대
            for lg in LEGACY_GENS.get(disp, []):                            # 이전 세대 (참고)
                files += _scan_stage_files(lg["code"], sm, canon, gen_label="v1·은퇴")
            stages.append({"no": sm["no"], "name": sm["name"], "gate": sm["gate"],
                           "what": sm["what"], "consumes": sm["consumes"],
                           "produces": sm["produces"], "tool": sm["tool"],
                           "file_count": len(files), "files": files})
        out["products"][disp] = {"stages": stages,
                                 "total_files": sum(s["file_count"] for s in stages)}
    return out


def api_ai_status():
    """AI 팀 현황 — 역할별 엔진·연결 상태(🟢/⚪) + 제품별 투입 선택(ai_use 체크박스)"""
    import os
    from olib import load_config
    cfg = load_config()
    mock = os.environ.get("ORCH_MOCK") == "1"
    have = {}
    try:
        from model_adapter import detect_mode
        have = detect_mode(cfg, os.environ)["have"]
    except Exception:
        pass
    # role_ko = 본업. 앙상블에선 전원이 '추출'도 겸한다 — 라벨 앞머리는 화면(전략별)에서 붙임
    ROLE_META = [("generator", "병합·출제 대표", "claude"),
                 ("judge", "채점", "Kimi"),
                 ("reviewer", "교차 검토", "codex")]
    engines = []
    for role, role_ko, default_eng in ROLE_META:
        m = cfg.get("models", {}).get(role) or {}
        cmd = m.get("command", [])
        raw = " ".join([str(m.get("model", "")), m.get("provider", ""),
                        " ".join(cmd) if isinstance(cmd, list) else str(cmd)]).lower()
        if "kimi" in raw or "moonshot" in raw:
            eng = "Kimi"
        elif "codex" in raw or "gpt" in raw:
            eng = "codex"
        elif "claude" in raw or "anthropic" in raw:
            eng = "claude"
        else:
            eng = default_eng
        connected = bool(mock or have.get(role))
        if mock:
            how = "가짜 AI (연습 모드)"
        elif not m:
            how = "미설정 — config.yaml 에 없음"
        elif m.get("provider") == "cli":
            how = "구독 계정 (CLI)" if connected else "구독 CLI 미설치 — 계정 대기"
        else:
            how = "API 키" if connected else f"API 키 없음 ({m.get('api_key_env', '?')})"
        engines.append({"role": role, "role_ko": role_ko, "engine": eng,
                        "connected": connected, "how": how})
    st = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))
    use = {}
    for code, ps in st["products"].items():
        if code in HIDDEN_CODES:
            continue
        use[display_of(code)] = {
            "code": code,
            "ai_use": ps.get("ai_use") or {"generator": True, "judge": True, "reviewer": True},
            "strategy": ps.get("strategy", "ensemble"),
        }
    return {"mock": mock, "engines": engines, "products": use}


def api_progress(code):
    """③ 등 장시간 작업의 실시간 진행/막힘 — 엔진이 배치마다 갱신하는 파일을 그대로"""
    if not re.fullmatch(r"[A-Z0-9]{1,8}", code or ""):
        return {"active": False}
    p = ROOT / "results" / f"_progress_{code}.json"
    if not p.exists():
        return {"active": False}
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {"active": False}
    d["active"] = True
    return d


def api_action(payload):
    """approve / reject / onboard / resume / run — pipeline CLI 경유 (원장 기록 보장)"""
    cmd = payload.get("cmd")
    args = [sys.executable, str(ROOT / "tools" / "pipeline.py")]
    if cmd == "approve":
        args += ["approve", payload["gate_id"], "--actor", payload.get("actor", "난희")]
        if payload.get("ack_all"):
            args += ["--ack-all"]
    elif cmd == "reject":
        if not payload.get("reason"):
            return {"ok": False, "out": "반려는 사유 필수"}
        args += ["reject", payload["gate_id"], "--reason", payload["reason"],
                 "--actor", payload.get("actor", "난희")]
    elif cmd == "resume":
        if not payload.get("reason"):
            return {"ok": False, "out": "HALT 해제는 사유 필수"}
        args += ["resume", "--after-fix", payload["product"], "--reason", payload["reason"],
                 "--actor", payload.get("actor", "난희")]
    elif cmd == "onboard":
        args += ["onboard", "--product", payload["product"], "--name", payload.get("name", ""),
                 "--base", payload.get("base", "blank"), "--actor", payload.get("actor", "난희"),
                 "--start", payload.get("start", "full"),
                 "--strategy", payload.get("strategy", "ensemble")]
    elif cmd == "set-strategy":
        args += ["set-strategy", "--product", payload["product"],
                 "--strategy", payload["strategy"], "--actor", payload.get("actor", "난희")]
    elif cmd == "set-members":
        args += ["set-members", "--product", payload["product"],
                 "--use", payload.get("use", "generator"), "--actor", payload.get("actor", "난희")]
    elif cmd == "new-round":
        args += ["new-round", "--product", payload["product"], "--actor", payload.get("actor", "난희")]
    elif cmd == "run":
        args += ["run", "--product", payload["product"]]
    else:
        return {"ok": False, "out": f"미지원: {cmd}"}
    import os
    p = subprocess.run(args, capture_output=True, text=True, cwd=str(ROOT),
                       env={**os.environ})   # ORCH_MOCK 등 서버 환경 승계
    return {"ok": p.returncode == 0, "out": (p.stdout + p.stderr).strip()}


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/" or self.path.startswith("/?"):
            self.path = "/dashboard/index.html"
            return super().do_GET()
        if self.path.startswith("/api/state"):
            return self._send(200, j(api_state()))
        if self.path.startswith("/api/ledger"):
            return self._send(200, j(api_ledger()))
        if self.path.startswith("/api/queue"):
            return self._send(200, j(api_queue()))
        if self.path.startswith("/api/scores"):
            return self._send(200, j(api_scores()))
        if self.path.startswith("/api/catalog"):
            return self._send(200, j(api_catalog()))
        if self.path.startswith("/api/ai_status"):
            return self._send(200, j(api_ai_status()))
        if self.path.startswith("/api/progress"):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            return self._send(200, j(api_progress(N(q.get("product", [""])[0]))))
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/action"):
            n = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(n) or b"{}")
            return self._send(200, j(api_action(payload)))
        if self.path.startswith("/api/upload"):
            return self._send(200, j(self._upload()))
        return self._send(404, j({"ok": False}))

    UPLOAD_DIRS = {"CORPUS": "corpus", "SCORING": "08_scoring",
                   "COVERAGE": "03_coverage_map", "UNIFIED": "05_unified_ledger",
                   "CALIBRATION": "06_calibration"}

    def _upload(self):
        """INPUT 카드용 파일 업로드 — 쿼리: product, target(카드 종류), name. 본문 = 파일 원바이트.
        저장 후 입구 검사는 pipeline run 이 수행 ('받으면 무조건 실측부터')."""
        from urllib.parse import urlparse, parse_qs, unquote
        q = parse_qs(urlparse(self.path).query)
        prod = N(q.get("product", [""])[0])
        target = N(q.get("target", ["CORPUS"])[0]).upper()
        name = N(unquote(q.get("name", ["upload.bin"])[0]))
        name = name.replace("/", "_").replace("\\", "_").replace("..", "_")  # 경로 이탈 차단
        sub = next((d for k, d in self.UPLOAD_DIRS.items() if k in target), "corpus")
        # 채점만 모드: SCORING 카드에 골든셋(xlsx)과 로그(json)를 같이 올려도 자동 분류
        if "SCORING" in target and name.lower().endswith(".xlsx"):
            sub = "05_unified_ledger"
        if not re.fullmatch(r"[A-Z0-9]{1,8}", prod):
            return {"ok": False, "out": f"제품 코드 오류: {prod}"}
        dest_dir = ROOT / "data" / prod / sub
        dest_dir.mkdir(parents=True, exist_ok=True)
        n = int(self.headers.get("Content-Length", 0))
        if n <= 0 or n > 500 * 1024 * 1024:
            return {"ok": False, "out": f"크기 오류: {n}B"}
        dest = dest_dir / name
        with open(dest, "wb") as f:
            remaining = n
            while remaining > 0:
                chunk = self.rfile.read(min(1 << 20, remaining))
                if not chunk:
                    break
                f.write(chunk)
                remaining -= len(chunk)
        sys.path.insert(0, str(ROOT / "tools"))
        from olib import ledger_append
        ledger_append("INPUT", "FILE_UPLOADED", "사람:대시보드",
                      evidence={"file": name, "size": n, "dest": f"data/{prod}/{sub}/"},
                      product=prod)
        return {"ok": True, "out": f"업로드 완료: {name} ({n:,}B) → data/{prod}/{sub}/ — 입구 검사를 실행합니다"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8791)
    a = ap.parse_args()
    srv = HTTPServer(("127.0.0.1", a.port), H)
    print(f"관제 대시보드: http://localhost:{a.port}/  (Ctrl+C 종료)")
    srv.serve_forever()


if __name__ == "__main__":
    main()
