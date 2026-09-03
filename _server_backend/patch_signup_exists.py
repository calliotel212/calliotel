from pathlib import Path

p = Path("/var/www/calliotel/backend/routes/auth.py")
# Restore from backup if syntax is broken
bak = Path("/var/www/calliotel/backend/routes/auth.py.bak-signupmsg")
if bak.exists():
    p.write_text(bak.read_text())

text = p.read_text()
marker = 'existing_user = await db.users.find_one({"email": user_data.email})'
if marker not in text:
    raise SystemExit("marker not found")

start = text.rfind("\n", 0, text.index(marker)) + 1
end_marker = "user_id = user_data.email"
end = text.index("\n", text.index(end_marker, start)) + 1

# Keep \\n as two chars in the Python source (escape inside the f-string)
replacement = (
'        email_lc = user_data.email.strip().lower()\n'
'        # Case-insensitive match (users often re-type with different capitalization)\n'
'        existing_user = await db.users.find_one({\n'
'            "$or": [\n'
'                {"email": email_lc},\n'
'                {"email": user_data.email},\n'
'                {"email_normalized": email_lc},\n'
'            ]\n'
'        })\n'
'        if existing_user:\n'
'            try:\n'
'                import asyncio as _asyncio\n'
'                from services.telegram_admin_alerts import notify_admins\n'
'                _asyncio.create_task(notify_admins(\n'
'                    f"⚠️ Signup failed — email already registered\\n📧 {email_lc}\\n🌐 IP: {_client_ip(request)}",\n'
'                    also_email=False,\n'
'                ))\n'
'            except Exception:\n'
'                pass\n'
'            raise HTTPException(\n'
'                status_code=400,\n'
'                detail="This email already has an account. Please log in instead.",\n'
'            )\n'
'\n'
'        # Gmail alias / dot normalization: block john+spam@gmail.com if john@gmail.com exists\n'
'        normalized = normalize_email(email_lc)\n'
'        if normalized and normalized != email_lc:\n'
'            existing_normalized = await db.users.find_one({"email_normalized": normalized})\n'
'            if existing_normalized:\n'
'                logger.info(f"🛡️  Blocked Gmail alias signup: {email_lc} → {normalized}")\n'
'                raise HTTPException(\n'
'                    status_code=400,\n'
'                    detail="This email already has an account. Please log in instead.",\n'
'                )\n'
'\n'
'        user_id = email_lc\n'
)

new_text = text[:start] + replacement + text[end:]

sig = new_text.index("async def signup(")
nxt = new_text.index("\nasync def ", sig + 1)
body = new_text[sig:nxt]
body2 = body.replace('"email": user_data.email,', '"email": email_lc,', 1)
body2 = body2.replace('"_id": user_data.email,', '"_id": email_lc,', 1)
body2 = body2.replace(
    '"email_normalized": normalize_email(user_data.email)',
    '"email_normalized": normalize_email(email_lc)',
    1,
)
body2 = body2.replace(
    '"username": user_data.username or user_data.email.split("@")[0],',
    '"username": user_data.username or email_lc.split("@")[0],',
    1,
)
# Also fix logger/telegram that still reference user_data.email in signup — leave as-is (fine)

new_text = new_text[:sig] + body2 + new_text[nxt:]
p.write_text(new_text)

import ast
ast.parse(p.read_text())
assert "This email already has an account" in p.read_text()
print("patched + syntax ok")
