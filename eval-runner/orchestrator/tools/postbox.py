#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
postbox.py — git 우체통 (인수인계서 v2 §4 · 수리 발주 v1.1 FIX-02/03/07 반영)

깃 저장소를 우체통 삼아 AI들(Claude Code / Codex CLI / 사람)이 산출물을 릴레이한다.
git 우체통 = 검수큐의 원격판. 우체통 경유 전달·수신은 전건 ledger 기록 (불변 단서 ③).

[FIX-02] 외부 호출 실패는 절대 침묵하지 않는다 — push 실패 시 rebase 재시도 3회,
         최종 실패는 SEND_FAILED 원장 기록 + 예외 정지. 성공 출력은 실제 성공 후에만.
[FIX-03] 발신자 명의는 설정(config postbox.sender → env POSTBOX_ME) — 미설정 시 정지.
         수신 시 manifest sha256 전건 대조 — 불일치는 RECV_HASH_MISMATCH + 투입 금지 경고.
[FIX-07] 우체통 원격은 코드 저장소와 분리 강제 — 동일 origin 이면 거부.

사용:
  python3 tools/postbox.py setup --repo <전용 우체통 저장소>   # 코드 저장소 주소는 거부됨
  python3 tools/postbox.py send --title 제목 --files a b [--note ...]
  python3 tools/postbox.py poll
  python3 tools/postbox.py watch --interval 300
환경: POSTBOX_ME(명의) · POSTBOX_DIR(우체통 경로 오버라이드 — 회귀 테스트용)
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from olib import ROOT, N, now, ledger_append, load_config


def box_dir():
    return Path(os.environ.get("POSTBOX_DIR") or (ROOT / "우체통"))


def seen_path():
    return box_dir() / ".postbox_seen.json"


class PostboxError(RuntimeError):
    pass


def git(*args, cwd=None, ok=True):
    p = subprocess.run(["git", *args], capture_output=True, text=True,
                       cwd=str(cwd or box_dir()))
    if ok and p.returncode != 0:
        raise PostboxError(f"git {' '.join(args)} 실패:\n{p.stderr.strip()[:500]}")
    return p


def get_sender():
    """[FIX-03] 명의: config postbox.sender → env POSTBOX_ME. 기본값 없음 — 미설정 = 정지."""
    cfg = load_config()
    sender = (cfg.get("postbox") or {}).get("sender") or os.environ.get("POSTBOX_ME")
    if not sender:
        raise PostboxError("발신자 명의 미설정 — config.yaml postbox.sender 또는 POSTBOX_ME 환경변수 필요 "
                           "(기본값 없음: 명의 충돌은 조용히 재발한다)")
    return sanitize(sender)


def sanitize(s):
    """[FIX-03] 디렉토리/파일명 소독 — 경로 이탈 차단"""
    return re.sub(r"[^A-Za-z0-9가-힣_\-]", "", N(s))[:60] or "무명"


def code_repo_origin():
    p = subprocess.run(["git", "-C", str(ROOT), "remote", "get-url", "origin"],
                       capture_output=True, text=True)
    return p.stdout.strip() if p.returncode == 0 else None


def _norm_url(u):
    return (u or "").rstrip("/").removesuffix(".git").lower()


def guard_separate_repo(url=None):
    """[FIX-07] 우체통 원격 ≠ 코드 저장소 — 동일하면 거부."""
    code = _norm_url(code_repo_origin())
    if not code:
        return
    target = url
    if target is None and box_dir().exists():
        p = git("remote", "get-url", "origin", ok=False)
        target = p.stdout.strip() if p.returncode == 0 else None
    if target and _norm_url(target) == code:
        raise PostboxError(f"우체통 원격이 코드 저장소와 동일({target}) — 분리 필수 (FIX-07). "
                           "전용 빈 Private 저장소를 만들어 지정하라.")


def has_remote():
    p = git("remote", ok=False)
    return bool(p.stdout.strip())


def cmd_setup(a):
    box = box_dir()
    if a.repo:
        guard_separate_repo(a.repo)
    if box.exists():
        print(f"이미 존재: {box}")
        guard_separate_repo()
        return
    if a.repo:
        git("clone", a.repo, str(box), cwd=ROOT)
    else:
        box.mkdir(parents=True)
        git("init", cwd=box)
        (box / "README.md").write_text("# RAG 평가 우체통\nAI 릴레이 전용 저장소 — outbox/<보낸이>/ 에 소포를 넣는다.\n", encoding="utf-8")
        git("add", "-A", cwd=box)
        git("commit", "-m", "우체통 개설", cwd=box)
    ledger_append("POSTBOX", "SETUP", f"사람:{a.actor}", evidence={"repo": a.repo or "로컬"})
    print(f"우체통 준비: {box} (원격: {a.repo or '없음 — 로컬 전용'})")


def cmd_send(a):
    box = box_dir()
    if not box.exists():
        raise PostboxError("우체통 없음 — setup 먼저")
    guard_separate_repo()
    me = get_sender()
    ts = now().replace(":", "").replace("-", "")[:15]
    title = sanitize(a.title)
    pkg = box / "outbox" / me / f"{ts}_{title}"
    pkg.mkdir(parents=True, exist_ok=True)
    entries = []
    for f in a.files:
        src = Path(f)
        shutil.copy2(src, pkg / N(src.name))
        entries.append({"file": N(src.name),
                        "sha256": hashlib.sha256(src.read_bytes()).hexdigest(),
                        "size": src.stat().st_size})
    (pkg / "manifest.json").write_text(json.dumps(
        {"from": me, "title": title, "note": a.note or "", "sent": now(), "files": entries},
        ensure_ascii=False, indent=2), encoding="utf-8")
    git("add", "-A")
    git("commit", "-m", f"[{me}] {title}")
    # [FIX-02] push: rebase 재시도 3회 → 최종 실패는 SEND_FAILED + 예외 정지
    if has_remote():
        branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
        last_err = ""
        for attempt in range(1, 4):
            p = git("push", "origin", branch, ok=False)
            if p.returncode == 0:
                break
            last_err = p.stderr.strip()[:400]
            r = git("pull", "--rebase", "origin", branch, ok=False)
            if r.returncode != 0:
                git("rebase", "--abort", ok=False)   # 충돌 자동 해소 금지 — 정지 후 보고
                ledger_append("POSTBOX", "SEND_FAILED", f"사람:{a.actor}",
                              evidence={"title": title, "attempt": attempt,
                                        "push_err": last_err, "rebase_err": r.stderr.strip()[:400]},
                              reason="rebase 충돌/실패 — 자동 해소 금지, 사람 확인 필요")
                raise PostboxError(f"발송 실패(재시도 {attempt}회): rebase 불가\n{r.stderr.strip()[:400]}")
        else:
            ledger_append("POSTBOX", "SEND_FAILED", f"사람:{a.actor}",
                          evidence={"title": title, "attempts": 3, "push_err": last_err},
                          reason="push 3회 실패 — 원격 상태 확인 필요")
            raise PostboxError(f"발송 실패(push 3회):\n{last_err}")
    ledger_append("POSTBOX", "SEND", f"사람:{a.actor}",
                  evidence={"title": title, "files": [e["file"] for e in entries],
                            "remote": has_remote()})
    print(f"📮 발송 확인: {title} ({len(entries)}개 파일)"
          + (" — 원격 push 완료" if has_remote() else " — 로컬 커밋(원격 없음)"))


def cmd_poll(a):
    box = box_dir()
    if not box.exists():
        raise PostboxError("우체통 없음 — setup 먼저")
    guard_separate_repo()
    me = get_sender()
    # [FIX-02] pull 실패 침묵 금지
    if has_remote():
        branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
        p = git("pull", "--ff-only", "origin", branch, ok=False)
        if p.returncode != 0:
            print(p.stderr.strip())
            ledger_append("POSTBOX", "POLL_FAILED", "script:postbox",
                          evidence={"err": p.stderr.strip()[:400]})
            raise PostboxError("poll 실패 — pull 불가 (위 stderr 참조)")
    sp = seen_path()
    seen = json.loads(sp.read_text(encoding="utf-8")) if sp.exists() else []
    new = []
    for mf in sorted((box / "outbox").rglob("manifest.json")):
        key = str(mf.parent.relative_to(box))
        if key in seen:
            continue
        try:
            d = json.loads(mf.read_text(encoding="utf-8"))
        except Exception as e:
            # [P3] 독소포(poison parcel) — 손상 manifest 하나가 poll 전체를 영구 봉쇄하던 결함:
            # seen에 등재해 재크래시 루프를 끊고, 카드로 사람에게 알린다 (원장 기록)
            seen.append(key)
            ledger_append("POSTBOX", "RECV_MANIFEST_CORRUPT", "script:postbox",
                          evidence={"위치": key, "오류": f"{type(e).__name__}: {str(e)[:120]}"})
            q = ROOT / load_config()["paths"]["queue"]
            q.mkdir(exist_ok=True)
            (q / f"POSTBOX_손상소포_{sanitize(key)[:40]}.md").write_text(
                f"# 우체통 손상 소포 — manifest 해독 불가\n\n- 위치: 우체통/{key}/\n"
                f"- 오류: {type(e).__name__}\n\n> 발신자에게 재발송을 요청하세요. 이 소포는 투입 금지.\n",
                encoding="utf-8")
            continue
        if sanitize(d.get("from", "")) == me:
            continue
        seen.append(key)
        # [FIX-03] 수신 해시 전건 대조 — 이름이 아니라 내용물의 벽
        mismatch = []
        for e in d.get("files", []):
            fp = mf.parent / e.get("file", "")
            if not fp.exists():
                mismatch.append({"file": e.get("file"), "이유": "파일 부재"})
                continue
            if e.get("sha256"):
                actual = hashlib.sha256(fp.read_bytes()).hexdigest()
                if actual != e["sha256"]:
                    mismatch.append({"file": e["file"], "이유": f"해시 불일치({actual[:12]}≠{e['sha256'][:12]})"})
        action = "RECV_HASH_MISMATCH" if mismatch else "RECV"
        ledger_append("POSTBOX", action, "script:postbox",
                      evidence={"from": d.get("from"), "title": d.get("title"),
                                "files": [e["file"] for e in d.get("files", [])],
                                "mismatch": mismatch})
        warn = ""
        if mismatch:
            warn = ("\n## ⛔ 해시 불일치 — data/ 투입 금지\n"
                    + "\n".join(f"- {m['file']}: {m['이유']}" for m in mismatch)
                    + "\n> 발신자에게 재발송 요청. 내용물 검증 전 사용 금지 (규칙 B′ 취지).\n")
        q = ROOT / load_config()["paths"]["queue"]
        q.mkdir(exist_ok=True)
        (q / f"POSTBOX_{sanitize(d.get('from',''))}_{sanitize(d.get('title','소포'))}.md").write_text(
            f"""# 우체통 수신 — {d.get('title')}{' ⛔해시불일치' if mismatch else ''}

- 보낸이: {d.get('from')} · 수신: {now()}
- 메모: {d.get('note','')}
- 파일: {', '.join(e['file'] for e in d.get('files', []))}
- 위치: 우체통/{key}/
{warn}
> {'내용 확인 후 해당 data/ 폴더로 투입하면 입구 검사(해시 등록·형식 게이트)가 실행된다.' if not mismatch else ''}
""", encoding="utf-8")
        new.append((key, d, bool(mismatch)))
    # [P3] seen 원자적 쓰기 — 파손되면 독소포 결함과 결합해 poll 영구 사망
    tmp = sp.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(seen, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(sp)
    bad = sum(1 for _, _, m in new if m)
    print(f"📬 새 소포 {len(new)}건" + (f" (해시 불일치 {bad}건 ⛔)" if bad else "")
          + (f": {[d.get('title') for _, d, _ in new]}" if new else ""))
    return len(new)


def cmd_watch(a):
    print(f"우체통 감시 시작 — {a.interval}초 간격 (Ctrl+C 종료)")
    while True:
        try:
            cmd_poll(a)
        except PostboxError as e:
            print(f"폴링 오류(계속 감시): {e}")
        time.sleep(a.interval)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("setup"); s.add_argument("--repo", default=None); s.add_argument("--actor", default="난희")
    s = sub.add_parser("send"); s.add_argument("--title", required=True); s.add_argument("--files", nargs="+", required=True); s.add_argument("--note"); s.add_argument("--actor", default="난희")
    s = sub.add_parser("poll")
    s = sub.add_parser("watch"); s.add_argument("--interval", type=int, default=300)
    a = ap.parse_args()
    try:
        {"setup": cmd_setup, "send": cmd_send, "poll": cmd_poll, "watch": cmd_watch}[a.cmd](a)
    except PostboxError as e:
        print(f"⛔ {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
