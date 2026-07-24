#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""notify.py — 텔레그램 알림 (카드 발행·사고 정지를 폰으로)

- 요약만 보낸다: 사내 데이터 상세는 대시보드에서 (외부 메신저 서버 경유 최소화)
- 설정(.telegram.json) 없거나 chat_id 미바인딩이면 조용히 no-op — 파이프라인을 절대 막지 않는다
- ORCH_MOCK=1(테스트)에서는 발송 안 함
"""
import json
import os
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
CFG = ROOT / ".telegram.json"


def _cfg():
    try:
        return json.loads(CFG.read_text(encoding="utf-8"))
    except Exception:
        return {}


def send(text, buttons=None):
    """fire-and-forget — 실패해도 예외를 밖으로 내지 않는다 (알림은 보조 수단)"""
    if os.environ.get("ORCH_MOCK") == "1":
        return False
    c = _cfg()
    if not c.get("token") or not c.get("chat_id"):
        return False
    body = {"chat_id": c["chat_id"], "text": text[:3800]}
    if buttons:
        body["reply_markup"] = {"inline_keyboard": buttons}
    try:
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{c['token']}/sendMessage",
            data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=6).read()
        return True
    except Exception as e:
        print(f"(텔레그램 알림 실패 — 무시: {str(e)[:80]})")
        return False


def gate_card(prod, gate_id, title, evidence=None):
    """사람 게이트 카드 발행 알림 — [승인] [반려] 버튼 포함 (처리는 tg_gate_bot 데몬)"""
    ev = evidence or {}
    keys = list(ev.items())[:3]
    lines = [f"🙋 결정해 주세요 — {prod} · {gate_id}", str(title)[:150]]
    lines += [f"· {k}: {str(v)[:60]}" for k, v in keys]
    lines.append("(상세는 관제판에서 — 버튼으로 바로 결정 가능)")
    send("\n".join(lines), buttons=[[
        {"text": "✅ 승인", "callback_data": f"approve:{gate_id}"},
        {"text": "↩ 반려 (사유)", "callback_data": f"reject:{gate_id}"}]])


def halt(prod, reason):
    send(f"⛔ 사고 정지 — {prod}\n{str(reason)[:200]}\n(관제판에서 [다시 시도] 또는 Claude 호출)")


def info(text):
    send(text)
