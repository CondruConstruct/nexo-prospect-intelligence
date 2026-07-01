#!/usr/bin/env python
"""NEXO Gmail reply watchdog.

Monitors Gmail for NEXO-related replies, alerts Telegram, and optionally sends a
safe first response to interested prospects. Designed for cron no-agent mode.
"""
from __future__ import annotations

import base64
import datetime as dt
import email.utils
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = ROOT / "state"
STATE_PATH = STATE_DIR / "gmail_reply_watchdog.json"
EVENTS_PATH = STATE_DIR / "gmail_reply_events.jsonl"
TOKEN_PATH = Path.home() / "AppData" / "Local" / "hermes" / "google_token.json"
QUERY = 'in:inbox newer_than:30d (NEXO OR "pilot sprint" OR "prospect list" OR "prospect intelligence" OR "local prospect") -from:me'
AUTO_REPLY_ENABLED = os.getenv("NEXO_AUTO_REPLY", "1") == "1"
DRY_RUN = os.getenv("NEXO_DRY_RUN", "0") == "1"


def utcnow() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def gmail_service():
    if not TOKEN_PATH.exists():
        raise SystemExit(f"Missing Gmail token: {TOKEN_PATH}. Run scripts/google_oauth_setup.py")
    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH))
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def headers(msg: dict[str, Any]) -> dict[str, str]:
    return {h.get("name", "").lower(): h.get("value", "") for h in msg.get("payload", {}).get("headers", [])}


def decode(data: str) -> str:
    if not data: return ""
    data += "=" * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode(data.encode("ascii")).decode("utf-8", "replace")


def body_text(payload: dict[str, Any]) -> str:
    out=[]
    def walk(part):
        for sub in part.get("parts", []) or []: walk(sub)
        data = part.get("body", {}).get("data")
        mime = part.get("mimeType", "")
        if data and ("text/plain" in mime or not part.get("parts")):
            out.append(decode(data))
    walk(payload)
    return "\n".join(out)


def load_state():
    if STATE_PATH.exists():
        try: return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except Exception: pass
    return {"seen_message_ids": [], "auto_replied_threads": []}


def save_state(state):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def telegram_alert(text: str):
    try:
        sys.path.insert(0, str(ROOT / "scripts"))
        import nexo_telegram
        # direct API call through helper; will fail quietly if chat not discovered
        chat_path = ROOT / "config" / "nexo_telegram_chat.json"
        if not chat_path.exists():
            return False
        chat_id = json.loads(chat_path.read_text(encoding="utf-8"))["chat_id"]
        nexo_telegram.api("sendMessage", {"chat_id": str(chat_id), "text": text[:3900], "disable_web_page_preview": "true"})
        return True
    except Exception:
        return False


def classify_interest(text: str) -> str:
    t=text.lower()
    if any(x in t for x in ["no", "unsubscribe", "remove me", "not interested", "stop emailing"]): return "negative"
    if any(x in t for x in ["interested", "send", "sample", "pricing", "price", "quote", "details", "yes", "tell me more", "call"]): return "positive"
    return "uncertain"


def build_reply(to_email: str, subject: str) -> str:
    return f"""Hi,

Thanks for replying — happy to share more.

NEXO builds public-source, human-reviewed local prospect intelligence for agency campaigns. A typical pilot sprint can focus on one niche and geography, for example: 50–75 local businesses with website/contact path, source notes, fit signals, and priority labels.

To scope this properly, please send:
1. the service you sell,
2. the target niche,
3. the target city/state or region,
4. the fields you want included.

For first pilots, payment is handled by invoice / bank transfer through NEXOGREX S.R.L. after we confirm the scope.

Important note: NEXO provides prospect research, not guaranteed meetings or campaign results. Your team remains responsible for outreach compliance and final use of the data.

Best,
NEXO by NEXOGREX S.R.L.
"""


def send_reply(service, original, h, reply_text: str):
    to = email.utils.parseaddr(h.get("from", ""))[1]
    if not to: return None
    subj = h.get("subject", "")
    if not subj.lower().startswith("re:"): subj = "Re: " + subj
    msg_id = h.get("message-id", "")
    body = [f"To: {to}", f"Subject: {subj}", "From: me"]
    if msg_id:
        body.append(f"In-Reply-To: {msg_id}")
        body.append(f"References: {msg_id}")
    body.append("Content-Type: text/plain; charset=UTF-8")
    body.append("")
    body.append(reply_text)
    raw = base64.urlsafe_b64encode("\r\n".join(body).encode("utf-8")).decode("ascii")
    if DRY_RUN:
        return {"dry_run": True, "to": to, "subject": subj}
    return service.users().messages().send(userId="me", body={"raw": raw, "threadId": original.get("threadId")}).execute()


def main():
    service = gmail_service()
    state = load_state()
    seen=set(state.get("seen_message_ids", []))
    replied=set(state.get("auto_replied_threads", []))
    results = service.users().messages().list(userId="me", q=QUERY, maxResults=20).execute().get("messages", [])
    new_events=[]
    alerts=[]
    for item in results:
        mid=item["id"]
        if mid in seen: continue
        msg=service.users().messages().get(userId="me", id=mid, format="full").execute()
        h=headers(msg); body=body_text(msg.get("payload", {})); snippet=msg.get("snippet", "")
        sender=h.get("from", ""); subj=h.get("subject", "")
        interest=classify_interest(body + "\n" + snippet)
        event={"ts":utcnow(),"message_id":mid,"thread_id":msg.get("threadId"),"from":sender,"subject":subj,"interest":interest,"snippet":snippet}
        if AUTO_REPLY_ENABLED and interest == "positive" and msg.get("threadId") not in replied:
            try:
                reply=build_reply(sender, subj)
                sent=send_reply(service, msg, h, reply)
                event["auto_reply"]={"sent": True, "result_id": sent.get("id") if isinstance(sent, dict) else None}
                replied.add(msg.get("threadId"))
                alerts.append(f"NEXO: positive Gmail reply detected and auto-replied.\nFrom: {sender}\nSubject: {subj}\nPlanned next step: wait for niche/geography/scope details or prepare invoice if they ask for quote.")
            except Exception as e:
                event["auto_reply"]={"sent": False, "error": str(e)[:250]}
                alerts.append(f"NEXO: positive Gmail reply detected, but auto-reply failed.\nFrom: {sender}\nSubject: {subj}\nError: {e}")
        else:
            alerts.append(f"NEXO: Gmail reply detected ({interest}).\nFrom: {sender}\nSubject: {subj}\nSnippet: {snippet}\nPlanned next step: {'do not contact again / suppress' if interest=='negative' else 'review and reply if relevant'}")
        new_events.append(event); seen.add(mid)
    if new_events:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with EVENTS_PATH.open("a", encoding="utf-8") as f:
            for e in new_events: f.write(json.dumps(e, ensure_ascii=False, sort_keys=True)+"\n")
        state["seen_message_ids"] = list(seen)[-1000:]
        state["auto_replied_threads"] = list(replied)[-1000:]
        save_state(state)
        delivered = [telegram_alert(a) for a in alerts]
        print("\n\n".join(alerts))
    # Quiet when no new events.

if __name__ == "__main__":
    main()
