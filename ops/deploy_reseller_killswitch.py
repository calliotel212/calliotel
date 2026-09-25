#!/usr/bin/env python3
"""Deploy the reseller/developer API kill-switch onto the live backend.

Turns OFF the reseller/developer programmatic API (so no outsider can obtain a
key or resell services) without touching the customer site. Safe by design:

  Dry run by default. Pass --apply to write, restart calliotel-api, and
  health-check. ANY failure after writing restores every touched file and
  restarts again — so a bad deploy rolls itself back instead of leaving the
  site down.

What it does with --apply:
  1. Adds services/reseller_gate.py if it is missing on the server (or is
     byte-identical to the version in this repo). A drifted copy is never
     overwritten — it is reported and skipped.
  2. Appends a small, idempotent kill-switch block to the end of server.py
     (guarded by RESELLER_KILLSWITCH_MARKER). It prunes every reseller/
     developer/public-api route after they are mounted. This works even though
     the server's server.py has drifted from the repo.
  3. Compiles, restarts calliotel-api, health-checks (/api/health + /api/auth/me),
     and confirms the reseller endpoints now return 404. Rolls back on failure.

Leave RESELLER_API_ENABLED unset to keep the reseller API OFF. To re-enable
later: set RESELLER_API_ENABLED=1 in the backend .env and restart.

Env (for local testing): CALLIOTEL_BACKEND=<dir>, PR_SRC=<dir with new/ tree>,
BACKUP_DIR=<dir>. Flags: --apply, --no-restart
"""
from __future__ import annotations

import os
import py_compile
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = os.environ.get("CALLIOTEL_BACKEND", "/var/www/calliotel/backend").rstrip("/") + "/"
REPO = "https://raw.githubusercontent.com/calliotel212/calliotel"
NEW_REF = "cursor/dev-environment-setup-f7f0"
LOCAL_SRC = os.environ.get("PR_SRC")
APPLY = "--apply" in sys.argv
RESTART = "--no-restart" not in sys.argv

GATE_REL = "services/reseller_gate.py"
SERVER_REL = "server.py"
MARKER = "RESELLER_KILLSWITCH_MARKER"

KILLSWITCH_BLOCK = '''

# ── RESELLER_KILLSWITCH_MARKER — reseller/developer API kill-switch ──────────
# Appended by ops/deploy_reseller_killswitch.py. Runs after every router is
# mounted. When RESELLER_API_ENABLED is unset, all reseller/developer/public-api
# routes are removed so no outsider can obtain a key or use the reseller API.
# Reversible: set RESELLER_API_ENABLED=1 in .env and restart.
try:
    from services.reseller_gate import prune_reseller_routes as _prune_reseller_routes
    from services.reseller_gate import log_reseller_gate_status as _log_reseller_gate_status
    _removed_reseller_routes = _prune_reseller_routes(app)
    _log_reseller_gate_status(logger)
    if _removed_reseller_routes:
        logger.info(
            "\\U0001f512 Removed %d reseller/developer route(s): %s",
            len(_removed_reseller_routes), _removed_reseller_routes,
        )
except Exception as _e:  # never let the kill-switch break startup
    try:
        logger.error("Reseller kill-switch not applied: %s", _e)
    except Exception:
        pass
'''


def fetch_repo(path: str) -> bytes | None:
    if LOCAL_SRC:
        p = os.path.join(LOCAL_SRC, "new", path)
        return open(p, "rb").read() if os.path.exists(p) else None
    try:
        with urllib.request.urlopen(f"{REPO}/{NEW_REF}/_server_backend/{path}", timeout=20) as r:
            return r.read()
    except Exception:
        return None


def read_live(path: str) -> str | None:
    p = ROOT + path
    return open(p, encoding="utf-8").read() if os.path.exists(p) else None


def plan() -> tuple[dict[str, str], list[str]]:
    """Return {relpath: new_content} plus a human-readable report."""
    changes: dict[str, str] = {}
    report: list[str] = []

    # 1. services/reseller_gate.py — add if missing or identical; never clobber drift.
    live_gate = read_live(GATE_REL)
    repo_gate = fetch_repo(GATE_REL)
    if repo_gate is None:
        report.append(f"SKIP   {GATE_REL}: could not read repo version")
    else:
        repo_gate_s = repo_gate.decode("utf-8")
        if live_gate is None:
            changes[GATE_REL] = repo_gate_s
            report.append(f"ADD    {GATE_REL}")
        elif live_gate == repo_gate_s:
            report.append(f"OK     {GATE_REL}: already up to date")
        else:
            report.append(f"SKIP   {GATE_REL}: live copy differs from repo, not overwritten")

    # 2. server.py — append the kill-switch block once (idempotent via marker).
    live_server = read_live(SERVER_REL)
    if live_server is None:
        report.append(f"SKIP   {SERVER_REL}: not on server (cannot apply kill-switch)")
    elif MARKER in live_server:
        report.append(f"OK     {SERVER_REL}: kill-switch already present")
    elif "app" not in live_server or "logger" not in live_server:
        report.append(f"SKIP   {SERVER_REL}: expected 'app'/'logger' not found — not editing")
    else:
        changes[SERVER_REL] = live_server.rstrip("\n") + "\n" + KILLSWITCH_BLOCK
        report.append(f"EDIT   {SERVER_REL}: append kill-switch block")

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


def reseller_disabled() -> bool:
    """True when the reseller apply endpoint returns 404 (unmounted)."""
    try:
        req = urllib.request.Request(
            "http://127.0.0.1:8080/api/reseller-api/apply", method="POST", data=b"{}"
        )
        urllib.request.urlopen(req, timeout=5)
        return False  # 2xx means still mounted
    except urllib.error.HTTPError as e:
        return e.code == 404
    except Exception:
        return False


def main() -> int:
    changes, report = plan()
    print("\n".join(report))
    print(f"\n{len(changes)} file(s) would change: " + (", ".join(sorted(changes)) or "none"))
    if not APPLY:
        print("\nDRY RUN — nothing written. Re-run with --apply to deploy.")
        return 0
    if not changes:
        print("Nothing to do.")
        return 0

    ts = time.strftime("%Y%m%d-%H%M%S")
    bak = os.path.join(os.environ.get("BACKUP_DIR", "/root"), f"reseller-killswitch-{ts}")
    os.makedirs(bak, exist_ok=True)
    created: list[str] = []
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
            print("restored and restarted:", "healthy" if health_ok() else "STILL UNHEALTHY — check journalctl")
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
    subprocess.run(["systemctl", "restart", "calliotel-api"])
    if not health_ok():
        return rollback("API not healthy after restart")
    if not reseller_disabled():
        return rollback("reseller endpoint did not return 404 after deploy")
    print("DEPLOYED OK — customer API healthy, reseller API returns 404. backup:", bak)
    return 0


if __name__ == "__main__":
    sys.exit(main())
