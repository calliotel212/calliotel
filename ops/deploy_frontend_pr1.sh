#!/usr/bin/env bash
# Build and ship the PR #1 website changes (Turnstile box, email banner, 2FA field)
# from the Mac frontend folder. Stops before building if any file differs from
# GitHub main in a way we can't safely replace.
#
# Usage (on the Mac):  bash deploy_frontend_pr1.sh [path-to-frontend-folder]
set -uo pipefail

DIR="${1:-$HOME/Projects/calliotel-frontend}"
RAW="https://raw.githubusercontent.com/calliotel212/calliotel"
BASE="main"
NEW="cursor/welcome5-atoz-security-42bc"
SITE_KEY="0x4AAAAAAFCjLHJ6krxE2Aqd"
SERVER="root@159.223.99.35"
REMOTE_BUILD="/var/www/calliotel/build"
FILES="src/App.js src/context/AuthContext.jsx src/pages/LoginPage.jsx src/pages/SignupPage.jsx src/components/TurnstileWidget.jsx src/components/EmailConfirmBanner.jsx"

cd "$DIR" || { echo "STOP: folder $DIR not found"; exit 1; }
[ -f package.json ] || { echo "STOP: $DIR has no package.json"; exit 1; }

TMP="$(mktemp -d)"
blocked=0
edit_app=0
echo "== checking files in $DIR =="
for f in $FILES; do
  mkdir -p "$TMP/base/$(dirname "$f")" "$TMP/new/$(dirname "$f")"
  if ! curl -fsS "$RAW/$NEW/$f" -o "$TMP/new/$f"; then
    echo "STOP: could not download $f"; exit 1
  fi
  has_base=1
  curl -fsS "$RAW/$BASE/$f" -o "$TMP/base/$f" 2>/dev/null || has_base=0
  if [ ! -f "$f" ]; then
    echo "ADD   $f"
  elif cmp -s "$f" "$TMP/new/$f"; then
    echo "OK    $f (already updated)"
  elif [ "$has_base" = 1 ] && cmp -s "$f" "$TMP/base/$f"; then
    echo "COPY  $f"
  elif [ "$f" = "src/App.js" ] && grep -q "EmailConfirmBanner" "$f"; then
    echo "OK    $f (banner already wired in)"
    cp "$f" "$TMP/new/$f"
  elif [ "$f" = "src/App.js" ] \
       && [ "$(grep -c 'const MobileAppBanner' "$f")" = 1 ] \
       && [ "$(grep -c '<AnnouncementBanner />' "$f")" = 1 ]; then
    echo "EDIT  $f (adds 2 lines for the email banner; keeps your other edits)"
    edit_app=1
  else
    echo "DIFF  $f  <- your Mac copy has other edits; not overwriting"
    blocked=1
  fi
done

if [ "$blocked" = 1 ]; then
  echo
  echo "STOPPED before building. Nothing changed. Send Boss AI the DIFF lines above."
  exit 1
fi

if [ "$edit_app" = 1 ]; then
  cp src/App.js "$TMP/new/src/App.js"
  perl -0pi -e 's/(const MobileAppBanner[^\n]*\n)/$1const EmailConfirmBanner     = lazy(() => import(".\/components\/EmailConfirmBanner"));\n/' "$TMP/new/src/App.js"
  perl -0pi -e 's/^([ \t]*)<AnnouncementBanner \/>/$1<EmailConfirmBanner \/>\n$1<AnnouncementBanner \/>/m' "$TMP/new/src/App.js"
  if [ "$(grep -c 'EmailConfirmBanner' "$TMP/new/src/App.js")" != 2 ]; then
    echo "STOP: could not add the banner to src/App.js. Nothing changed."
    exit 1
  fi
fi

mkdir -p "$TMP/mac_backup"
for f in $FILES; do
  [ -f "$f" ] && { mkdir -p "$TMP/mac_backup/$(dirname "$f")"; cp "$f" "$TMP/mac_backup/$f"; }
  mkdir -p "$(dirname "$f")"
  cp "$TMP/new/$f" "$f"
done
echo "Mac source backup: $TMP/mac_backup"

ENVF=".env.production"
touch "$ENVF"
if grep -q "^REACT_APP_TURNSTILE_SITE_KEY=" "$ENVF"; then
  sed -i '' "s|^REACT_APP_TURNSTILE_SITE_KEY=.*|REACT_APP_TURNSTILE_SITE_KEY=$SITE_KEY|" "$ENVF"
else
  printf '\nREACT_APP_TURNSTILE_SITE_KEY=%s\n' "$SITE_KEY" >> "$ENVF"
fi
echo "Site key set in $ENVF"

echo "== building (a few minutes) =="
if ! yarn build > "$TMP/build.log" 2>&1; then
  tail -30 "$TMP/build.log"
  echo "STOP: build failed. Live site untouched. Restoring Mac source files."
  for f in $FILES; do
    if [ -f "$TMP/mac_backup/$f" ]; then cp "$TMP/mac_backup/$f" "$f"; else rm -f "$f"; fi
  done
  exit 1
fi
ls build/static/js/main.*.js >/dev/null 2>&1 || { echo "STOP: build has no main JS. Live site untouched."; exit 1; }
grep -rq "$SITE_KEY" build/static/js/ || { echo "STOP: site key missing from build. Live site untouched."; exit 1; }
echo "build OK"

STAMP="$(date +%Y%m%d-%H%M%S)"
echo "== backing up live site to $REMOTE_BUILD.bak-$STAMP =="
ssh "$SERVER" "cp -a $REMOTE_BUILD $REMOTE_BUILD.bak-$STAMP" || { echo "STOP: could not reach server. Live site untouched."; exit 1; }

echo "== uploading =="
if ! rsync -az --delete build/ "$SERVER:$REMOTE_BUILD/"; then
  ssh "$SERVER" "rm -rf $REMOTE_BUILD && cp -a $REMOTE_BUILD.bak-$STAMP $REMOTE_BUILD"
  echo "STOP: upload failed. Live site restored from backup."
  exit 1
fi

code="$(curl -s -o /dev/null -w '%{http_code}' https://calliotel.com/signup)"
if [ "$code" != "200" ]; then
  ssh "$SERVER" "rm -rf $REMOTE_BUILD && cp -a $REMOTE_BUILD.bak-$STAMP $REMOTE_BUILD"
  echo "STOP: site answered $code after upload. Live site restored from backup."
  exit 1
fi
echo
echo "WEBSITE DEPLOYED OK. Live backup: $REMOTE_BUILD.bak-$STAMP"
echo "Undo:  ssh $SERVER \"rm -rf $REMOTE_BUILD && cp -a $REMOTE_BUILD.bak-$STAMP $REMOTE_BUILD\""
