#!/usr/bin/env python3
"""Deploy the PR #1 security changes onto a live backend that has drifted from GitHub.

Dry run by default. Pass --apply to write, restart calliotel-api and health-check.
Any failure after writing restores every touched file and restarts again.

  1. Copies a PR file only when the live copy is byte-identical to GitHub `main`,
     or when the file does not exist on the server yet.
  2. For drifted files, applies small anchored edits. An edit whose anchor is not
     found is skipped and reported; it never guesses.

Env (testing): CALLIOTEL_BACKEND=<dir>, PR_SRC=<dir with main/ and new/ trees>, BACKUP_DIR=<dir>.
Flags: --apply, --no-restart
"""
from __future__ import annotations

import os
import py_compile
import re
import shutil
import subprocess
import sys
import time
import urllib.request

ROOT = os.environ.get("CALLIOTEL_BACKEND", "/var/www/calliotel/backend").rstrip("/") + "/"
REPO = "https://raw.githubusercontent.com/calliotel212/calliotel"
BASE_REF, NEW_REF = "main", "cursor/welcome5-atoz-security-42bc"
LOCAL_SRC = os.environ.get("PR_SRC")
APPLY = "--apply" in sys.argv
RESTART = "--no-restart" not in sys.argv

COPY_IF_SAFE = [
    "middleware/security_headers.py",
    "services/admin_gate.py",
    "services/auth_throttle.py",
    "services/email_gate.py",
    "services/paid_funds.py",
    "services/promo_guard.py",
    "services/turnstile.py",
    "routes/admin.py",
    "routes/admin_jobs.py",
    "routes/bekena_routes.py",
    "routes/herosms_routes.py",
    "scripts/ensure_indexes.py",
]


class Skip(Exception):
    pass


def fetch(ref: str, path: str) -> bytes | None:
    if LOCAL_SRC:
        label = "main" if ref == BASE_REF else "new"
        p = os.path.join(LOCAL_SRC, label, path)
        return open(p, "rb").read() if os.path.exists(p) else None
    try:
        with urllib.request.urlopen(f"{REPO}/{ref}/_server_backend/{path}", timeout=20) as r:
            return r.read()
    except Exception:
        return None


def read_live(path: str) -> str | None:
    p = ROOT + path
    return open(p, encoding="utf-8").read() if os.path.exists(p) else None


def func_region(text: str, def_regex: str) -> tuple[int, int]:
    m = re.search(def_regex, text)
    if not m:
        raise Skip(f"function not found: {def_regex}")
    end = text.find("\n@router.", m.end())
    nxt_def = re.search(r"\n(async )?def \w+\(", text[m.end():])
    candidates = [e for e in (end, m.end() + nxt_def.start() if nxt_def else -1) if e != -1]
    return m.start(), (min(candidates) if candidates else len(text))


# ── anchored edits ────────────────────────────────────────────────────────────

def add_model_field(cls: str, field_line: str):
    name = field_line.split(":")[0].strip()

    def edit(text: str) -> str:
        m = re.search(rf"^class {cls}\(BaseModel\):[^\n]*\n", text, re.M)
        if not m:
            raise Skip(f"class {cls} not found")
        body_end = re.search(r"^\S", text[m.end():], re.M)
        body = text[m.end(): m.end() + (body_end.start() if body_end else len(text))]
        if re.search(rf"^\s+{name}\s*:", body, re.M):
            raise Skip(f"{cls}.{name} already present")
        return text[: m.end()] + f"    {field_line}\n" + text[m.end():]

    edit.__name__ = f"add {cls}.{name}"
    return edit


def signup_turnstile(text: str) -> str:
    if "services.turnstile" in text:
        raise Skip("already has Turnstile")
    m = re.search(r"async def signup\((.*?)\):[^\n]*\n", text, re.S)
    if not m:
        raise Skip("signup() not found")
    body_var = re.search(r"(\w+)\s*:\s*UserSignup", m.group(1))
    if not body_var or "request" not in m.group(1) or "def _client_ip" not in text:
        raise Skip("signup() has no request/_client_ip to read the IP from")
    gate = (
        "    from services.turnstile import assert_human as _assert_human\n"
        f"    await _assert_human(getattr({body_var.group(1)}, 'turnstile_token', None), _client_ip(request))\n"
    )
    return text[: m.end()] + gate + text[m.end():]


def signup_unverified(text: str) -> str:
    start, end = func_region(text, r"async def signup\(")
    region = text[start:end]
    pat = re.compile(r'"email_verified":\s*True,?[^\n]*')
    hits = pat.findall(region)
    if len(hits) != 1:
        raise Skip(f'expected one "email_verified": True in signup(), found {len(hits)}')
    region = pat.sub('"email_verified": False,  # spending gated until the emailed link is clicked', region, 1)
    if "email_confirmation_required=True" not in region:
        i = region.rfind("UserResponse(")
        if i != -1:
            j = i + len("UserResponse(")
            region = region[:j] + "\n                email_confirmation_required=True," + region[j:]
    return text[:start] + region + text[end:]


def me_flag(text: str) -> str:
    start, end = func_region(text, r"async def get_me\(")
    region = text[start:end]
    if "email_confirmation_required" in region:
        raise Skip("get_me already sets the flag")
    sig = re.search(r"async def get_me\((\w+)", region)
    i = region.find("UserResponse(")
    if not sig or i == -1:
        raise Skip("get_me() does not return UserResponse(...)")
    j = i + len("UserResponse(")
    flag = (
        "\n        email_confirmation_required=__import__('services.email_gate', "
        f"fromlist=['x']).needs_email_confirmation({sig.group(1)}),"
    )
    region = region[:j] + flag + region[j:]
    return text[:start] + region + text[end:]


def banned_logout(text: str) -> str:
    start, end = func_region(text, r"async def get_current_user\(")
    region = text[start:end]
    if "banned" in region:
        raise Skip("get_current_user already checks banned")
    m = re.search(r'^([ \t]+)raise HTTPException\(status_code=401, detail="User not found"\)\n', region, re.M)
    if not m:
        raise Skip('no "User not found" raise in get_current_user')
    ind = m.group(1)[:-4] if len(m.group(1)) >= 4 else m.group(1)
    add = (
        f"{ind}if user.get(\"banned\"):\n"
        f"{ind}    raise HTTPException(status_code=403, detail=\"This account has been suspended. Contact support@calliotel.com.\")\n"
    )
    region = region[: m.end()] + add + region[m.end():]
    return text[:start] + region + text[end:]


def gate_route(route: str, method: str = "post"):
    def edit(text: str) -> str:
        rx = re.compile(
            rf'@router\.{method}\(\s*["\']{re.escape(route)}["\'][^\n]*\)\s*\n'
            r"(?:@[^\n]*\n)*"
            r"async def (\w+)\((.*?)\)\s*(?:->[^:]*)?:[^\n]*\n",
            re.S,
        )
        m = rx.search(text)
        if not m:
            raise Skip(f"route {method.upper()} {route} not found")
        uv = re.search(r"(\w+)\s*(?::\s*[\w.\[\]]+)?\s*=\s*Depends\(\s*get_current_user", m.group(2))
        if not uv:
            raise Skip(f"{route}: no get_current_user parameter")
        if "require_confirmed_email" in text[m.end(): m.end() + 400]:
            raise Skip(f"{route}: already gated")
        gate = (
            "    from services.email_gate import require_confirmed_email as _rce\n"
            f"    _rce({uv.group(1)})\n"
        )
        return text[: m.end()] + gate + text[m.end():]

    edit.__name__ = f"email gate {method.upper()} {route}"
    return edit


PATCHES: dict[str, list] = {
    "routes/auth.py": [
        add_model_field("UserSignup", "turnstile_token: Optional[str] = None"),
        add_model_field("UserResponse", "email_confirmation_required: Optional[bool] = False"),
        signup_turnstile,
        signup_unverified,
        me_flag,
        banned_logout,
    ],
    "telnyx_routes.py": [gate_route("/auto-purchase")],
    "routes/fivesim_otp.py": [gate_route("/buy")],
    "routes/proxy_routes.py": [gate_route("/buy")],
    "routes/promo_codes.py": [gate_route("/apply")],
    "routes/esim_routes.py": [gate_route("/order"), gate_route("/topup")],
    "routes/wallet.py": [gate_route("/transfer-balance")],
}


# ── run ───────────────────────────────────────────────────────────────────────

def plan() -> tuple[dict[str, str], list[str]]:
    changes: dict[str, str] = {}
    report: list[str] = []
    for path in COPY_IF_SAFE:
        live = read_live(path)
        new = fetch(NEW_REF, path)
        base = fetch(BASE_REF, path)
        if new is None:
            report.append(f"SKIP   {path}: could not download PR version")
            continue
        new_s = new.decode("utf-8")
        if live is None:
            changes[path] = new_s
            report.append(f"ADD    {path}")
        elif live == new_s:
            report.append(f"OK     {path}: already up to date")
        elif base is not None and live == base.decode("utf-8"):
            changes[path] = new_s
            report.append(f"COPY   {path}")
        else:
            report.append(f"SKIP   {path}: live copy differs from GitHub, not overwritten")

    for path, edits in PATCHES.items():
        text = read_live(path)
        if text is None:
            report.append(f"SKIP   {path}: not on server")
            continue
        for edit in edits:
            try:
                text = edit(text)
                report.append(f"EDIT   {path}: {edit.__name__}")
            except Skip as s:
                report.append(f"--     {path}: {edit.__name__} skipped ({s})")
        if text != read_live(path):
            changes[path] = text
    return changes, report


def health_ok() -> bool:
    for _ in range(15):
        time.sleep(2)
        try:
            with urllib.request.urlopen("http://127.0.0.1:8080/api/health", timeout=5) as r:
                if r.status != 200:
                    continue
        except Exception:
            continue
        try:
            urllib.request.urlopen("http://127.0.0.1:8080/api/auth/me", timeout=5)
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                return True
        except Exception:
            pass
    return False


def router_errors(since: str) -> list[str]:
    try:
        out = subprocess.run(
            ["journalctl", "-u", "calliotel-api", "--since", since, "--no-pager"],
            capture_output=True, text=True, timeout=20,
        ).stdout
    except Exception:
        return []
    return [l for l in out.splitlines() if "failed to load" in l or "Traceback" in l][:10]


def main() -> int:
    changes, report = plan()
    print("\n".join(report))
    print(f"\n{len(changes)} file(s) would change: " + ", ".join(sorted(changes)))
    if not APPLY:
        print("\nDRY RUN - nothing written. Re-run with --apply to deploy.")
        return 0
    if not changes:
        print("Nothing to do.")
        return 0

    ts = time.strftime("%Y%m%d-%H%M%S")
    bak = os.path.join(os.environ.get("BACKUP_DIR", "/root"), f"pr1-deploy-{ts}")
    created: list[str] = []
    os.makedirs(bak, exist_ok=True)
    for path in changes:
        dst = ROOT + path
        if os.path.exists(dst):
            os.makedirs(os.path.dirname(os.path.join(bak, path)), exist_ok=True)
            shutil.copy2(dst, os.path.join(bak, path))
        else:
            created.append(path)

    def rollback(reason: str) -> int:
        print(f"\nROLLING BACK: {reason}")
        for path in changes:
            b = os.path.join(bak, path)
            if os.path.exists(b):
                shutil.copy2(b, ROOT + path)
        for path in created:
            try:
                os.remove(ROOT + path)
            except FileNotFoundError:
                pass
        if RESTART:
            subprocess.run(["systemctl", "restart", "calliotel-api"])
            print("restored and restarted:", "healthy" if health_ok() else "STILL UNHEALTHY - check journalctl")
        return 1

    for path, content in changes.items():
        dst = ROOT + path
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, "w", encoding="utf-8") as fh:
            fh.write(content)
    for path in changes:
        try:
            py_compile.compile(ROOT + path, doraise=True)
        except Exception as e:
            return rollback(f"compile error in {path}: {e}")
    print(f"\nwritten + compiled. backup: {bak}")

    if not RESTART:
        return 0
    since = time.strftime("%Y-%m-%d %H:%M:%S")
    subprocess.run(["systemctl", "restart", "calliotel-api"])
    if not health_ok():
        return rollback("API not healthy after restart")
    errs = [e for e in router_errors(since) if any(k in e for k in ("fivesim", "proxy", "promo", "esim", "wallet", "herosms", "admin", "bekena", "telnyx"))]
    if errs:
        print("\n".join(errs))
        return rollback("a router failed to load after deploy")
    print("DEPLOYED OK - API healthy, auth answering. backup:", bak)
    return 0


if __name__ == "__main__":
    sys.exit(main())
