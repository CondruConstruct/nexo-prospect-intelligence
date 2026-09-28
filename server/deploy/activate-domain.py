#!/usr/bin/env python3
"""Root-only, retryable QR Forever domain cutover. Never prints configuration."""
import fcntl
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import tempfile
import time
import urllib.request

DOMAIN = "qrforever.md"
ALIASES = (DOMAIN, "www." + DOMAIN)
ADDRESS = "162.254.38.74"
TEMPORARY = "qr-forever.162-254-38-74.sslip.io"
ENV = Path("/etc/qr-forever/app.env")
CADDY = Path("/etc/caddy/Caddyfile")
STATE = Path("/etc/qr-forever/domain-cutover")


def run(*args, timeout=30):
    return subprocess.run(args, check=True, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, timeout=timeout).stdout


def atomic(path, content, mode=None):
    previous = path.stat() if path.exists() else None
    fd, name = tempfile.mkstemp(prefix=".cutover-", dir=path.parent)
    try:
        os.fchmod(fd, mode if mode is not None else (previous.st_mode & 0o777 if previous else 0o600))
        if previous:
            os.fchown(fd, previous.st_uid, previous.st_gid)
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def dns_ready():
    for host in ALIASES:
        ipv4 = {item[4][0] for item in socket.getaddrinfo(host, 443, socket.AF_INET)}
        if ipv4 != {ADDRESS}:
            return False
        # Check independent public DNS as well as this server's resolver.
        for kind in ("A", "AAAA"):
            with urllib.request.urlopen("https://dns.google/resolve?name=" + host + "&type=" + kind,
                                        timeout=8) as response:
                answer = json.load(response)
            if answer.get("Status") != 0:
                return False
            records = {r["data"] for r in answer.get("Answer", []) if r["type"] == (1 if kind == "A" else 28)}
            if (kind == "A" and records != {ADDRESS}) or (kind == "AAAA" and records):
                return False
    return True


def health(url, host=None):
    args = ["curl", "--silent", "--show-error", "--fail", "--max-time", "12", "--noproxy", "*"]
    if host:
        args += ["--resolve", host + ":443:" + ADDRESS]
    result = json.loads(run(*args, url, timeout=15))
    return result.get("ok") is True and result.get("storageConfigured") is True


def app_ready():
    for _ in range(15):
        try:
            if health("http://127.0.0.1:3000/api/health"):
                return
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError("Application health unavailable")


def reload_caddy():
    run("/usr/local/bin/caddy", "validate", "--config", str(CADDY))
    run("systemctl", "reload", "caddy")


def rollback():
    atomic(ENV, (STATE / "previous.env").read_bytes())
    atomic(CADDY, (STATE / "previous.caddy").read_bytes())
    reload_caddy()
    run("systemctl", "restart", "qr-forever")
    app_ready()
    (STATE / "pending").unlink(missing_ok=True)


def main():
    if os.geteuid() != 0:
        raise RuntimeError("Root required")
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(STATE, 0o700)
    with (STATE / "lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if (STATE / "complete").exists():
            return
        if (STATE / "pending").exists():
            rollback()
        try:
            if not dns_ready() or not all(health("https://" + h + "/api/health", h) for h in ALIASES):
                print("Domain activation waiting for apex/www DNS and trusted HTTPS.")
                return
        except Exception:
            print("Domain activation waiting for apex/www DNS and trusted HTTPS.")
            return
        previous = ENV.read_bytes()
        text = previous.decode("utf-8")
        pattern = r"(?m)^PUBLIC_URL=[^\r\n]*"
        if len(re.findall(pattern, text)) != 1:
            raise RuntimeError("Expected exactly one PUBLIC_URL assignment")
        updated = re.sub(pattern, "PUBLIC_URL=https://" + DOMAIN, text).encode("utf-8")
        atomic(STATE / "previous.env", previous, 0o600)
        atomic(STATE / "previous.caddy", CADDY.read_bytes(), 0o600)
        atomic(STATE / "pending", b"pending\n", 0o600)
        try:
            atomic(ENV, updated)
            run("systemctl", "restart", "qr-forever")
            app_ready()
            final = f"""{DOMAIN} {{
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}}
www.{DOMAIN}, {TEMPORARY} {{
    redir https://{DOMAIN}{{uri}} 302
}}
http://{ADDRESS} {{
    redir https://{DOMAIN}{{uri}} 302
}}
"""
            atomic(CADDY, final.encode("utf-8"))
            reload_caddy()
            if not health("https://" + DOMAIN + "/api/health", DOMAIN):
                raise RuntimeError("Canonical HTTPS health unavailable")
            atomic(STATE / "complete", b"Canonical domain: https://qrforever.md\n", 0o600)
            (STATE / "pending").unlink(missing_ok=True)
            (STATE / "previous.env").unlink(missing_ok=True)
            (STATE / "previous.caddy").unlink(missing_ok=True)
            print("Canonical domain activated: https://qrforever.md")
        except Exception:
            rollback()
            print("Domain activation rolled back; existing address retained.")
            raise RuntimeError("Domain cutover failed") from None


if __name__ == "__main__":
    try:
        main()
    except BlockingIOError:
        pass
    except Exception:
        print("Domain activation could not finish; inspect service health before retry.")
        raise SystemExit(1)
