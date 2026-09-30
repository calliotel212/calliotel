#!/usr/bin/env python3
"""Regenerate scripts/bootstrap-calliotel-dashboard.sh from source tree."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "scripts" / "bootstrap-calliotel-dashboard.sh"

SKIP_DIRS = {".git", "node_modules", ".next", "__pycache__", ".venv"}
SKIP_FILES = {OUT.name, "generate-bootstrap-calliotel-dashboard.py"}
SKIP_SUFFIXES = {".pyc"}


def delimiter_for(rel: Path) -> str:
    token = re.sub(r"[^A-Za-z0-9_]", "_", str(rel).replace("/", "__"))
    return f"CALLOIOTEL_{token}"


def collect_files() -> list[Path]:
    files: list[Path] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if rel.name in SKIP_FILES:
            continue
        if rel.suffix in SKIP_SUFFIXES:
            continue
        if rel.name == ".env":
            continue
        files.append(rel)
    return files


def embed_file(rel: Path) -> str:
    content = (ROOT / rel).read_text(encoding="utf-8")
    delim = delimiter_for(rel)
    if f"\n{delim}\n" in content or content.endswith(f"\n{delim}"):
        raise SystemExit(f"Delimiter collision in {rel}")
    parent = rel.parent
    lines = [
        f'mkdir -p "$INSTALL_DIR/{parent}"' if str(parent) != "." else 'mkdir -p "$INSTALL_DIR"',
        f'cat > "$INSTALL_DIR/{rel.as_posix()}" << \'{delim}\'',
        content.rstrip("\n"),
        delim,
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    files = collect_files()
    body_parts = [
        "#!/usr/bin/env bash",
        "# Bootstrap calliotel-dashboard — macOS/Linux.",
        "set -euo pipefail",
        'INSTALL_DIR="${1:-calliotel-dashboard}"',
        'mkdir -p "$INSTALL_DIR"',
        'INSTALL_DIR="$(cd "$INSTALL_DIR" && pwd)"',
        'echo "Writing calliotel-dashboard to: $INSTALL_DIR"',
        "",
    ]
    for rel in files:
        if rel.as_posix() == "scripts/bootstrap-calliotel-dashboard.sh":
            continue
        body_parts.append(embed_file(rel))

    body_parts.extend(
        [
            "echo",
            f'echo "Created $INSTALL_DIR with {len(files)} project files."',
            "echo",
            'echo "Next steps:"',
            'echo "  cd \\"$INSTALL_DIR\\""',
            'echo "  cp .env.example .env"',
            'echo "  # Edit .env — replace every REPLACE_* value"',
            'echo "  docker compose up -d --build"',
            "echo",
            'echo "Open http://localhost:3000 (web) and http://localhost:8000/health (api)"',
        ]
    )
    inner = "\n".join(body_parts) + "\n"

    # Self-embed: outer script writes all files including this bootstrap script.
    outer = [
        "#!/usr/bin/env bash",
        "# Bootstrap calliotel-dashboard — macOS/Linux.",
        "set -euo pipefail",
        'INSTALL_DIR="${1:-calliotel-dashboard}"',
        'mkdir -p "$INSTALL_DIR"',
        'INSTALL_DIR="$(cd "$INSTALL_DIR" && pwd)"',
        'echo "Writing calliotel-dashboard to: $INSTALL_DIR"',
        "",
    ]
    for rel in files:
        if rel.as_posix() == "scripts/bootstrap-calliotel-dashboard.sh":
            continue
        outer.append(embed_file(rel))

    self_delim = "CALLOIOTEL_scripts__bootstrap_calliotel_dashboard_sh"
    if self_delim in inner:
        raise SystemExit("Bootstrap delimiter collision")
    outer.extend(
        [
            'mkdir -p "$INSTALL_DIR/scripts"',
            f'cat > "$INSTALL_DIR/scripts/bootstrap-calliotel-dashboard.sh" << \'{self_delim}\'',
            inner.rstrip("\n"),
            self_delim,
            "",
            'chmod +x "$INSTALL_DIR/scripts/bootstrap-calliotel-dashboard.sh" 2>/dev/null || true',
            "",
            f'echo "Created $INSTALL_DIR with {len(files)} project files."',
            'echo "  cd \\"$INSTALL_DIR\\" && cp .env.example .env && docker compose up -d --build"',
        ]
    )
    OUT.write_text("\n".join(outer) + "\n", encoding="utf-8")
    OUT.chmod(0o755)
    print(f"Wrote {OUT} ({len(files)} files)")


if __name__ == "__main__":
    main()
