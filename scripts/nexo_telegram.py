#!/usr/bin/env python
"""NEXO Telegram helper: get bot identity, discover owner chat, and send alerts.

Secrets live in config/nexo_bot.env and are never committed.
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / "config" / "nexo_bot.env"
CHAT_PATH = ROOT / "config" / "nexo_telegram_chat.json"


def load_env() -> dict[str, str]:
    data = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            if not line.strip() or line.strip().startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            data[k.strip()] = v.strip()
    data.update({k: v for k, v in os.environ.items() if k.startswith("NEXO_")})
    return data


def api(method: str, params: dict | None = None) -> dict:
    env = load_env()
    token = env.get("NEXO_TELEGRAM_BOT_TOKEN")
    if not token:
        raise SystemExit("NEXO_TELEGRAM_BOT_TOKEN missing in config/nexo_bot.env")
    url = f"https://api.telegram.org/bot{token}/{method}"
    if params:
        body = urllib.parse.urlencode(params).encode("utf-8")
        req = urllib.request.Request(url, data=body)
    else:
        req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def cmd_identity(_args):
    res = api("getMe")
    bot = res.get("result", {})
    print(json.dumps({"ok": res.get("ok"), "id": bot.get("id"), "username": bot.get("username"), "first_name": bot.get("first_name")}, ensure_ascii=False))


def cmd_discover(_args):
    res = api("getUpdates")
    chats = []
    for upd in res.get("result", []):
        msg = upd.get("message") or upd.get("edited_message") or {}
        chat = msg.get("chat") or {}
        if chat.get("id"):
            chats.append({"chat_id": chat.get("id"), "type": chat.get("type"), "username": chat.get("username"), "first_name": chat.get("first_name"), "last_name": chat.get("last_name")})
    # Deduplicate by chat_id preserving latest identity
    dedup = {c["chat_id"]: c for c in chats}
    print(json.dumps(list(dedup.values()), ensure_ascii=False, indent=2))
    if len(dedup) == 1:
        only = next(iter(dedup.values()))
        CHAT_PATH.write_text(json.dumps(only, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Saved chat id to {CHAT_PATH}")


def cmd_send(args):
    if args.chat_id:
        chat_id = args.chat_id
    elif CHAT_PATH.exists():
        chat_id = json.loads(CHAT_PATH.read_text(encoding="utf-8"))["chat_id"]
    else:
        raise SystemExit("No chat id. Send /start to @AI2004151BOT, then run: python scripts/nexo_telegram.py discover")
    res = api("sendMessage", {"chat_id": str(chat_id), "text": args.text, "disable_web_page_preview": "true"})
    print(json.dumps({"ok": res.get("ok"), "message_id": res.get("result", {}).get("message_id"), "chat_id": chat_id}, ensure_ascii=False))


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(required=True)
    s = sub.add_parser("identity"); s.set_defaults(func=cmd_identity)
    s = sub.add_parser("discover"); s.set_defaults(func=cmd_discover)
    s = sub.add_parser("send"); s.add_argument("text"); s.add_argument("--chat-id"); s.set_defaults(func=cmd_send)
    args = p.parse_args(); args.func(args)

if __name__ == "__main__":
    main()
