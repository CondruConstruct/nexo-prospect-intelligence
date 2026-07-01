#!/usr/bin/env python
"""Refresh/create a Gmail OAuth token for NEXO automation.

This starts a localhost OAuth callback. Open the printed URL, approve access,
and the token is written to the active Hermes local config path.
"""
from __future__ import annotations

from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
]

HOME = Path.home()
SECRET_CANDIDATES = [
    HOME / "AppData" / "Local" / "hermes" / "google_client_secret.json",
    Path("//wsl.localhost/Ubuntu/home/condr_gmxbu4g/.hermes/profiles/mainrouter/google_client_secret.json"),
]
TOKEN_PATH = HOME / "AppData" / "Local" / "hermes" / "google_token.json"

def choose_secret() -> Path:
    for path in SECRET_CANDIDATES:
        if path.exists():
            return path
    raise FileNotFoundError("No google_client_secret.json found in known Hermes locations")

if __name__ == "__main__":
    secret = choose_secret()
    print(f"Using client secret: {secret}", flush=True)
    flow = InstalledAppFlow.from_client_secrets_file(str(secret), scopes=SCOPES)
    creds = flow.run_local_server(host="127.0.0.1", port=8799, prompt="consent", authorization_prompt_message="OPEN THIS GOOGLE CONSENT URL:\n{url}\n")
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
    print(f"Saved refreshed Gmail token to: {TOKEN_PATH}", flush=True)
