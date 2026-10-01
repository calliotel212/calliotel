#!/usr/bin/env python3
"""Deploy the real-funds spending guards onto the live Calliotel backend.

Stops WELCOME5 / referral / welcome promo credit from:
  • buying provider inventory (OTP numbers, dedicated proxy), and
  • spending Telnyx voice minutes (in-app + outbound calls),
which is the recurring balance drain.

SAFE BY DESIGN:
  • Dry run by default. Pass --apply to write, restart calliotel-api, health-check.
  • Backs up every touched file first; ANY failure after writing restores the
    backups and restarts again — a bad deploy rolls itself back.
  • Uses anchored edits. If an anchor isn't found (because production has drifted
    from this repo), that edit is SKIPPED and reported — never guessed, never
    clobbered. Edits are idempotent: re-running changes nothing once applied.

Requires services/paid_funds.py on the server (already present — the Telnyx
number purchase uses assert_real_funds_cover today).

Env (for local testing): CALLIOTEL_BACKEND=<dir>, BACKUP_DIR=<dir>
Flags: --apply, --no-restart

Usage on the server (preview first, then apply):
  /var/www/calliotel/venv/bin/python ops/deploy_money_guards.py
  /var/www/calliotel/venv/bin/python ops/deploy_money_guards.py --apply
"""
from __future__ import annotations

import os
import py_compile
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = os.environ.get("CALLIOTEL_BACKEND", "/var/www/calliotel/backend").rstrip("/") + "/"
APPLY = "--apply" in sys.argv
RESTART = "--no-restart" not in sys.argv

GUARD_IMPORT = "from services.paid_funds import assert_real_funds_cover"


class Skip(Exception):
    pass


def read_live(path: str) -> str | None:
    p = ROOT + path
    return open(p, encoding="utf-8").read() if os.path.exists(p) else None


# ── anchored edits ─────────────────────────────────────────────────────────────

# Provider inventory: insert the guard between the wallet fetch and the debit.
# Matches only when the two lines are ADJACENT, so an already-guarded file (which
# has the guard lines in between) is left untouched → idempotent.
_INVENTORY_RE = re.compile(
    r'([ \t]*)wallet[ \t]*=[ \t]*await db\.wallets\.find_one\(\{"user_id": user_id\}\)\n'
    r'([ \t]*)reserved[ \t]*=[ \t]*await debit_if_funded\(db, user_id, (\w+)\)'
)


def guard_inventory_buy(text: str) -> str:
    def repl(m: re.Match) -> str:
        indent, debit_indent, price = m.group(1), m.group(2), m.group(3)
        return (
            f'{indent}wallet = await db.wallets.find_one({{"user_id": user_id}})\n'
            f'{indent}# Provider inventory must be paid with real funds, not promo credit.\n'
            f'{indent}{GUARD_IMPORT}\n'
            f'{indent}await assert_real_funds_cover(db, user_id, wallet, {price})\n'
            f'{debit_indent}reserved = await debit_if_funded(db, user_id, {price})'
        )

    new_text, n = _INVENTORY_RE.subn(repl, text)
    if n == 0:
        if "assert_real_funds_cover" in text:
            raise Skip("already guarded")
        raise Skip("debit_if_funded anchor not found — review manually")
    return new_text


# Telnyx voice: insert the guard between the wallet fetch and the balance check.
_VOICE_RE = re.compile(
    r'([ \t]*)wallet[ \t]*=[ \t]*await db\.wallets\.find_one\(\{"user_id": user_id\}\)\n'
    r'([ \t]*)bal[ \t]*=[ \t]*float\(wallet\.get\("balance", 0\)\) if wallet else 0\.0\n'
    r'([ \t]*)if bal < dest_rate:'
)


def guard_voice_calls(text: str) -> str:
    def repl(m: re.Match) -> str:
        i1, i2, i3 = m.group(1), m.group(2), m.group(3)
        return (
            f'{i1}wallet = await db.wallets.find_one({{"user_id": user_id}})\n'
            f'{i1}# Telnyx voice must be paid with real funds, not promo credit.\n'
            f'{i1}{GUARD_IMPORT}\n'
            f'{i1}await assert_real_funds_cover(db, user_id, wallet, dest_rate)\n'
            f'{i2}bal = float(wallet.get("balance", 0)) if wallet else 0.0\n'
            f'{i3}if bal < dest_rate:'
        )

    new_text, n = _VOICE_RE.subn(repl, text)
    if n == 0:
        if "assert_real_funds_cover" in text:
            raise Skip("already guarded")
        raise Skip("voice balance-check anchor not found — review manually")
    return new_text


PATCHES: dict[str, list] = {
    "routes/fivesim_otp.py": [guard_inventory_buy],
    "routes/herosms_routes.py": [guard_inventory_buy],
    "routes/proxy_routes.py": [guard_inventory_buy],
    "routes/calls.py": [guard_voice_calls],
}


# ── run ──────────────────────────────────────────────────────────────────────

def plan() -> tuple[dict[str, str], list[str]]:
    changes: dict[str, str] = {}
    report: list[str] = []
    for path, edits in PATCHES.items():
        text = read_live(path)
        if text is None:
            report.append(f"SKIP   {path}: not on server")
            continue
        original = text
        for edit in edits:
            try:
                text = edit(text)
                report.append(f"EDIT   {path}: {edit.__name__}")
            except Skip as s:
                report.append(f"--     {path}: {edit.__name__} skipped ({s})")
        if text != original:
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
    bak = os.path.join(os.environ.get("BACKUP_DIR", "/root"), f"money-guards-{ts}")
    os.makedirs(bak, exist_ok=True)
    for path in changes:
        os.makedirs(os.path.dirname(os.path.join(bak, path)), exist_ok=True)
        shutil.copy2(ROOT + path, os.path.join(bak, path))

    def rollback(reason: str) -> int:
        print(f"\nROLLING BACK: {reason}")
        for path in changes:
            shutil.copy2(os.path.join(bak, path), ROOT + path)
        if RESTART:
            subprocess.run(["systemctl", "restart", "calliotel-api"])
            print("restored and restarted:", "healthy" if health_ok() else "STILL UNHEALTHY — check journalctl")
        return 1

    for path, content in changes.items():
        with open(ROOT + path, "w", encoding="utf-8") as fh:
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
    print("DEPLOYED OK — customer API healthy. backup:", bak)
    return 0


if __name__ == "__main__":
    sys.exit(main())
