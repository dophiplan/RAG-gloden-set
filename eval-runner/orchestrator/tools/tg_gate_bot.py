#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""tg_gate_bot.py — 텔레그램 게이트 봇 (폰에서 승인/반려)

- 롱폴링(getUpdates) — 우리 Mac을 밖에 열지 않아도 된다
- 최초 1명 바인딩: 처음 말 건 사람의 chat_id를 .telegram.json에 저장, 이후 타인은 무시
- [✅ 승인] → pipeline approve + 자동 실행(run) / [↩ 반려] → 다음 메시지를 사유로 reject + run
- /status → 제품별 현재 단계·상태 요약
- 결정은 전부 pipeline CLI 경유 → 원장 기록 보장 (actor: 난희(텔레그램))
"""
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
CFG = ROOT / ".telegram.json"
sys.path.insert(0, str(ROOT / "tools"))


def cfg():
    return json.loads(CFG.read_text(encoding="utf-8"))


def api(method, **kw):
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{cfg()['token']}/{method}",
        data=json.dumps(kw).encode(), headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=70).read())


def say(chat, text):
    api("sendMessage", chat_id=chat, text=text[:3800])


def pipeline(*args):
    p = subprocess.run([sys.executable, str(ROOT / "tools" / "pipeline.py"), *args],
                       capture_output=True, text=True, cwd=str(ROOT))
    return p.returncode, (p.stdout + p.stderr).strip()


def run_product(prod):
    """대시보드 run 액션과 동일 경로 — pidfile 가드·로그 교대 재사용"""
    try:
        req = urllib.request.Request("http://localhost:8791/api/action",
                                     data=json.dumps({"cmd": "run", "product": prod}).encode(),
                                     headers={"Content-Type": "application/json"})
        return json.loads(urllib.request.urlopen(req, timeout=10).read()).get("out", "")
    except Exception as e:
        return f"(실행 시작 실패 — 대시보드 서버 확인: {str(e)[:60]})"


def gate_product(gate_id):
    st = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))
    for prod, ps in st["products"].items():
        if any(g["id"] == gate_id for g in ps.get("open_gates", [])):
            return prod
    for prod in st["products"]:
        if f"_{prod}_" in f"_{gate_id}_" or gate_id.endswith(f"_{prod}") or f"_{prod}_" in gate_id:
            return prod
    return None


def status_text():
    st = json.loads((ROOT / "state.json").read_text(encoding="utf-8"))
    lines = ["📊 현재 상태"]
    for prod, ps in st["products"].items():
        gates = [g["id"] for g in ps.get("open_gates", [])]
        lines.append(f"· {prod}: {ps['stage']} · {ps['status']}"
                     + (f" · 대기 카드: {', '.join(gates)}" if gates else ""))
    return "\n".join(lines)


def main():
    print("🤖 텔레그램 게이트 봇 시작 (롱폴링)")
    offset = 0
    pending_reject = {}   # chat_id → gate_id (반려 사유 입력 대기)
    while True:
        try:
            r = api("getUpdates", offset=offset, timeout=50)
        except Exception as e:
            print(f"폴링 오류(재시도): {str(e)[:80]}")
            time.sleep(5)
            continue
        for u in r.get("result", []):
            offset = u["update_id"] + 1
            c = cfg()
            # ── 버튼 콜백 (승인/반려)
            if "callback_query" in u:
                cq = u["callback_query"]
                chat = cq["message"]["chat"]["id"]
                if chat != c.get("chat_id"):
                    api("answerCallbackQuery", callback_query_id=cq["id"], text="권한 없음")
                    continue
                action, _, gate_id = cq["data"].partition(":")
                prod = gate_product(gate_id)
                if action == "approve":
                    rc, out = pipeline("approve", gate_id, "--ack-all", "--actor", "난희(텔레그램)")
                    if rc == 0 and prod:
                        say(chat, f"✅ 승인 처리 — {gate_id}\n{run_product(prod)}")
                    else:
                        say(chat, f"승인 실패 — {out[:300]}")
                    api("answerCallbackQuery", callback_query_id=cq["id"])
                elif action == "reject":
                    pending_reject[chat] = gate_id
                    say(chat, f"↩ {gate_id} 반려 — 사유를 다음 메시지로 보내주세요 (그대로 원장에 기록·재출제에 반영)")
                    api("answerCallbackQuery", callback_query_id=cq["id"])
                continue
            # ── 일반 메시지
            m = u.get("message")
            if not m or "text" not in m:
                continue
            chat = m["chat"]["id"]
            if c.get("chat_id") is None:
                # 최초 바인딩 — 이후 다른 사람은 무시
                c["chat_id"] = chat
                CFG.write_text(json.dumps(c), encoding="utf-8")
                say(chat, "🤝 연결 완료! 이제 카드가 뜨면 여기로 알림이 오고, 버튼으로 바로 승인/반려할 수 있어요.\n"
                          "/status 로 현재 상태를 언제든 볼 수 있어요.")
                print(f"chat_id 바인딩: {chat}")
                continue
            if chat != c["chat_id"]:
                continue
            text = m["text"].strip()
            if chat in pending_reject:
                gate_id = pending_reject.pop(chat)
                prod = gate_product(gate_id)
                rc, out = pipeline("reject", gate_id, "--reason", text, "--actor", "난희(텔레그램)")
                if rc == 0 and prod:
                    say(chat, f"↩ 반려 접수 — {gate_id}\n사유: {text[:100]}\n{run_product(prod)}")
                else:
                    say(chat, f"반려 실패 — {out[:300]}")
                continue
            if text.startswith("/status") or text in ("상태", "현황"):
                say(chat, status_text())
            elif text.startswith("/start"):
                say(chat, "이미 연결돼 있어요. /status 로 상태 확인, 카드 알림의 버튼으로 결정하면 돼요.")
            else:
                say(chat, "명령: /status (현재 상태) · 결정은 카드 알림의 버튼으로")
        time.sleep(0.5)


if __name__ == "__main__":
    main()
