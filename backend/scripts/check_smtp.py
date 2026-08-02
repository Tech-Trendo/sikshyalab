"""Test primary SMTP only from backend/.env (no fallbacks)."""
from __future__ import annotations

import smtplib
import socket
import ssl
from email.mime.text import MIMEText
from pathlib import Path

ENV = Path(__file__).resolve().parents[1] / ".env"


def load_env() -> dict[str, str]:
    data: dict[str, str] = {}
    for line in ENV.read_text(encoding="utf-8").splitlines():
        t = line.strip()
        if not t or t.startswith("#") or "=" not in t:
            continue
        k, _, v = t.partition("=")
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in {"'", '"'}:
            v = v[1:-1]
        data[k.strip()] = v
    return data


def main() -> None:
    env = load_env()
    host = env["EMAIL_HOST"]
    port = int(env.get("EMAIL_PORT") or 587)
    user = env["EMAIL_HOST_USER"]
    password = env["EMAIL_HOST_PASSWORD"]
    print(f"host={host} port={port} user={user} password_len={len(password)}")

    print("1) TCP connect...")
    try:
        with socket.create_connection((host, port), timeout=20) as s:
            print("   TCP OK", s.getpeername())
    except OSError as exc:
        print("   TCP FAIL", type(exc).__name__, exc)
        print("STOP: this PC cannot reach the SMTP host (website on this PC will also fail).")
        return

    print("2) SMTP STARTTLS login + send to self...")
    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(host, port, timeout=30) as server:
            server.ehlo()
            server.starttls(context=ctx)
            server.ehlo()
            server.login(user, password)
            msg = MIMEText("ShikshaLab primary SMTP test.")
            msg["Subject"] = "ShikshaLab SMTP OK"
            msg["From"] = user
            msg["To"] = user
            server.sendmail(user, [user], msg.as_string())
        print("   SEND OK — safe to test on the website.")
    except Exception as exc:  # noqa: BLE001
        print("   SMTP FAIL", type(exc).__name__, exc)


if __name__ == "__main__":
    main()
