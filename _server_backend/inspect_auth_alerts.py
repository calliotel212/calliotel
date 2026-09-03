from pathlib import Path
import ast

p = Path("/var/www/calliotel/backend/routes/auth.py")
bak = Path("/var/www/calliotel/backend/routes/auth.py.bak-signupmsg")

# Prefer latest good backup if current is broken
try:
    ast.parse(p.read_text())
    t = p.read_text()
    print("current auth.py syntax ok")
except SyntaxError as e:
    print("current broken:", e)
    if bak.exists():
        # bak is from before email_lc patch - don't use if we need email_lc
        pass
    # try to restore from git? use journal - restore from .bak and re-apply email_lc? 
    raise SystemExit("auth.py syntax broken — restore needed")

# Find and replace using plain str.replace (no re — avoids \n interpretation)
old_email = 'f"👤 New signup\\n📧 {user_data.email}\\n🆔 {client_id}"'
# In the actual file the content is backslash-n. When we read_text, \\n in source becomes \n two-char in Python string... 
# Actually in the .py file on disk: f"...\\n📧..." which read as f"...\n📧..." (one escape)

# Show what is really in the file around New signup
for i, line in enumerate(t.splitlines(), 1):
    if "New signup" in line or "New email signup" in line or ("New Google signup" in line and "notify" not in line):
        print(i, repr(line[:200]))
