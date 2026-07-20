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


def api_state():
    import os
    st = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))
    # 모델 모드 부가
    try:
        from model_adapter import detect_mode, effective_recheck_rate
        m = detect_mode()
        st["_mode"] = {"mode": "연습(모의AI)" if os.environ.get("ORCH_MOCK") == "1" else m["mode"],
                       "plan": m["plan"], "recheck": effective_recheck_rate()}
    except Exception as e:
        st["_mode"] = {"mode": "?", "error": str(e)}
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


def api_catalog():
    """stage_meta + data/ 실시간 스캔 — 신규 생성 파일 즉시 반영. 정본 표시는 G0 manifest 참조."""
    meta = json.loads((ROOT / "catalog" / "stage_meta.json").read_text(encoding="utf-8"))
    canon = {}
    mf = ROOT / "catalog" / "manifest.json"
    if mf.exists():
        for r in json.loads(mf.read_text(encoding="utf-8"))["files"]:
            if r.get("canonical"):
                canon[r["file"]] = True
    st = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))
    out = {"products": {}}
    for prod in st["products"]:
        stages = []
        for sm in meta["stages"]:
            d = ROOT / "data" / prod / sm["dir"]
            files = []
            if d.is_dir():
                import re as _re
                fl = sorted((p for p in d.iterdir() if p.is_file() and not p.name.startswith(".")),
                            key=lambda p: p.name)
                # 신규 파일: 계열 내 최고버전을 정본 취급
                def vkey(p):
                    m = _re.search(r"_v(\d+(?:_\d+)+)", p.name)
                    return tuple(int(x) for x in m.group(1).split("_")) if m else (0,)
                best = max(fl, key=vkey).name if fl else None
                for p in fl:
                    files.append({"file": N(p.name), "version": "",
                                  "canonical": canon.get(N(p.name), p.name == best),
                                  "size": p.stat().st_size,
                                  "path": f"{prod}/{sm['dir']}/{p.name}"})
            stages.append({"no": sm["no"], "name": sm["name"], "gate": sm["gate"],
                           "what": sm["what"], "consumes": sm["consumes"],
                           "produces": sm["produces"], "tool": sm["tool"],
                           "file_count": len(files), "files": files})
        out["products"][prod] = {"stages": stages,
                                 "total_files": sum(s["file_count"] for s in stages)}
    return out


def api_action(payload):
    """approve / reject / onboard / resume / run — pipeline CLI 경유 (원장 기록 보장)"""
    cmd = payload.get("cmd")
    args = [sys.executable, str(ROOT / "tools" / "pipeline.py")]
    if cmd == "approve":
        args += ["approve", payload["gate_id"], "--actor", payload.get("actor", "송하")]
        if payload.get("ack_all"):
            args += ["--ack-all"]
    elif cmd == "reject":
        if not payload.get("reason"):
            return {"ok": False, "out": "반려는 사유 필수"}
        args += ["reject", payload["gate_id"], "--reason", payload["reason"],
                 "--actor", payload.get("actor", "송하")]
    elif cmd == "resume":
        if not payload.get("reason"):
            return {"ok": False, "out": "HALT 해제는 사유 필수"}
        args += ["resume", "--after-fix", payload["product"], "--reason", payload["reason"],
                 "--actor", payload.get("actor", "송하")]
    elif cmd == "onboard":
        args += ["onboard", "--product", payload["product"], "--name", payload.get("name", ""),
                 "--base", payload.get("base", "blank"), "--actor", payload.get("actor", "송하")]
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
