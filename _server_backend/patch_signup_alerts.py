from pathlib import Path
import ast
import re

p = Path("/var/www/calliotel/backend/routes/auth.py")
t = p.read_text()

# Replace email signup telegram message (look for the New signup f-string)
pat_email = re.compile(
    r'f"👤 New signup\\n📧 \{user_data\.email\}\\n🆔 \{client_id\}"',
)
repl_email = (
    'f"👤 New email signup\\n📧 {email_lc}\\n'
    '🌐 Domain: {email_lc.split(\'@\')[-1]}\\n🆔 {client_id}"'
)
t2, n1 = pat_email.subn(repl_email, t, count=1)
print("email alert replacements:", n1)

pat_google = re.compile(
    r'f"🔵 New Google signup\\n📧 \{email\}\\n👤 \{user_doc\.get\(\'full_name\'\) or \'Unknown\'\}"',
)
repl_google = (
    'f"🔵 New Google signup\\n📧 {email}\\n'
    '🌐 Domain: {email.split(\'@\')[-1]}\\n'
    '👤 {user_doc.get(\'full_name\') or \'Unknown\'}"'
)
t2, n2 = pat_google.subn(repl_google, t2, count=1)
print("google alert replacements:", n2)

if n1 == 0 and n2 == 0:
    # debug nearby
    for i, line in enumerate(t.splitlines(), 1):
        if "New signup" in line or "New Google signup" in line:
            print(i, repr(line[:160]))
    raise SystemExit("no patterns matched")

ast.parse(t2)
p.write_text(t2)
print("ok")
