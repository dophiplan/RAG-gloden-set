#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
postbox.py — git 우체통 (인수인계서 v2 §4 ★자동화 방식 결정)

깃 저장소를 우체통 삼아 AI들(Claude Code / Codex CLI / 사람)이 산출물을 릴레이한다
— 송하가 하던 복붙 셔틀의 기계화. git 우체통 = 검수큐의 원격판.

구조 (우체통 저장소 안):
  outbox/<보낸이>/<타임스탬프>_<제목>/   ← 산출물 + manifest.json
  inbox 는 상대의 outbox — 폴링으로 새 소포 감지

불변 단서 (v2 §4): 우체통 경유 전달·수신은 전건 ledger 기록.

사용:
  python3 tools/postbox.py setup --repo <git주소 또는 로컬경로>
  python3 tools/postbox.py send --title "골든셋_v1_2_개정발주" --files a.xlsx b.md --note "..."
  python3 tools/postbox.py poll                # 새 소포 확인 → 검수큐 카드 + 원장
  python3 tools/postbox.py watch --interval 300   # 타이머 폴링 (5분마다)
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import time
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from olib import ROOT, N, now, ledger_append, load_config

BOX = ROOT / "우체통"          # 로컬 클론 위치
SEEN = ROOT / "results" / ".postbox_seen.json"
ME = "설계본부"                 # 이 오케스트레이터의 발신자 명의


def git(*args, cwd=None, ok=True):
    p = subprocess.run(["git", *args], capture_output=True, text=True, cwd=str(cwd or BOX))
    if ok and p.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} 실패: {p.stderr[:300]}")
    return p.stdout.strip()


def has_remote():
    try:
        return bool(git("remote", ok=False))
    except Exception:
        return False


def cmd_setup(a):
    if BOX.exists():
        print(f"이미 존재: {BOX}")
        return
    if a.repo:
        git("clone", a.repo, str(BOX), cwd=ROOT)
    else:
        BOX.mkdir()
        git("init", cwd=BOX)
        (BOX / "README.md").write_text("# RAG 평가 우체통\nAI 릴레이용 — outbox/<보낸이>/ 에 소포를 넣는다.\n", encoding="utf-8")
        git("add", "-A", cwd=BOX)
        git("commit", "-m", "우체통 개설", cwd=BOX)
    ledger_append("POSTBOX", "SETUP", f"사람:{a.actor}", evidence={"repo": a.repo or "로컬"})
    print(f"우체통 준비: {BOX} (원격: {a.repo or '없음 — 로컬 전용'})")


def cmd_send(a):
    if not BOX.exists():
        sys.exit("우체통 없음 — setup 먼저")
    ts = now().replace(":", "").replace("-", "")[:15]
    pkg = BOX / "outbox" / ME / f"{ts}_{a.title}"
    pkg.mkdir(parents=True, exist_ok=True)
    entries = []
    for f in a.files:
        src = Path(f)
        shutil.copy2(src, pkg / N(src.name))
        entries.append({"file": N(src.name), "sha256": hashlib.sha256(src.read_bytes()).hexdigest(),
                        "size": src.stat().st_size})
    (pkg / "manifest.json").write_text(json.dumps(
        {"from": ME, "title": a.title, "note": a.note or "", "sent": now(), "files": entries},
        ensure_ascii=False, indent=2), encoding="utf-8")
    git("add", "-A")
    git("commit", "-m", f"[{ME}] {a.title}")
    if has_remote():
        git("push", "origin", "HEAD", ok=False)
    ledger_append("POSTBOX", "SEND", f"사람:{a.actor}",
                  evidence={"title": a.title, "files": [e["file"] for e in entries]})
    print(f"📮 발송: {a.title} ({len(entries)}개 파일) → {pkg.relative_to(ROOT)}")


def cmd_poll(a):
    if not BOX.exists():
        sys.exit("우체통 없음 — setup 먼저")
    if has_remote():
        git("pull", "--ff-only", ok=False)
    seen = json.loads(SEEN.read_text(encoding="utf-8")) if SEEN.exists() else []
    new = []
    for mf in sorted((BOX / "outbox").rglob("manifest.json")):
        d = json.loads(mf.read_text(encoding="utf-8"))
        if d.get("from") == ME:
            continue
        key = str(mf.parent.relative_to(BOX))
        if key in seen:
            continue
        seen.append(key)
        new.append((key, d))
        # 수신 = 원장 기록 + 검수큐 카드 (입구 검사는 사람이 투입 결정 후)
        ledger_append("POSTBOX", "RECV", "script:postbox",
                      evidence={"from": d.get("from"), "title": d.get("title"),
                                "files": [e["file"] for e in d.get("files", [])]})
        q = ROOT / load_config()["paths"]["queue"]
        q.mkdir(exist_ok=True)
        (q / f"POSTBOX_{d.get('from','')}_{d.get('title','소포')}.md").write_text(
            f"""# 우체통 수신 — {d.get('title')}

- 보낸이: {d.get('from')} · 수신: {now()}
- 메모: {d.get('note','')}
- 파일: {', '.join(e['file'] for e in d.get('files', []))}
- 위치: 우체통/{key}/

> 내용 확인 후 해당 data/ 폴더로 투입하면 입구 검사(해시 등록·형식 게이트)가 실행된다.
""", encoding="utf-8")
    SEEN.parent.mkdir(exist_ok=True)
    SEEN.write_text(json.dumps(seen, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"📬 새 소포 {len(new)}건" + (f": {[d.get('title') for _, d in new]}" if new else ""))
    return len(new)


def cmd_watch(a):
    print(f"우체통 감시 시작 — {a.interval}초 간격 (Ctrl+C 종료)")
    while True:
        try:
            cmd_poll(a)
        except Exception as e:
            print(f"폴링 오류: {e}")
        time.sleep(a.interval)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("setup"); s.add_argument("--repo", default=None); s.add_argument("--actor", default="송하")
    s = sub.add_parser("send"); s.add_argument("--title", required=True); s.add_argument("--files", nargs="+", required=True); s.add_argument("--note"); s.add_argument("--actor", default="송하")
    s = sub.add_parser("poll");
    s = sub.add_parser("watch"); s.add_argument("--interval", type=int, default=300)
    a = ap.parse_args()
    {"setup": cmd_setup, "send": cmd_send, "poll": cmd_poll, "watch": cmd_watch}[a.cmd](a)


if __name__ == "__main__":
    main()
