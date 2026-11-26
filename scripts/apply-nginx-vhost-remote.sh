#!/usr/bin/env bash
#
# Install deploy/nginx/banksia.io.conf on the production host.
#
# SPA deploys never touch nginx, so route additions stay invisible until this
# vhost is synced. A docroot directory named like a route (join/, create/, …)
# then loops /path -> /path/ -> /path in the browser. Use this script after
# changing route shells or the vhost itself.
#
#   bash scripts/apply-nginx-vhost-remote.sh            # dry run, shows the diff
#   bash scripts/apply-nginx-vhost-remote.sh hurgenburgen apply
#
# The script backs up the live file, installs the repo copy, runs `nginx -t`,
# reloads, and restores the backup automatically if the test fails.

set -euo pipefail

HOST="${1:-hurgenburgen}"
MODE="${2:-dry-run}"

case "$MODE" in
  apply|dry-run) ;;
  *) echo "usage: $0 [host] [apply|dry-run]" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SRC_CONF=deploy/nginx/banksia.io.conf
[ -f "$SRC_CONF" ] || { echo "error: missing $SRC_CONF (run from the repo)" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp "$SRC_CONF" "$TMP/banksia-vhost.conf"

cat > "$TMP/banksia-vhost-apply.sh" <<'REMOTE'
set -euo pipefail
MODE="${1:-dry-run}"
STAGED="${2:?staged vhost path missing}"

LIVE=/etc/nginx/sites-enabled/banksia.io
if [ ! -e "$LIVE" ]; then
  LIVE=/etc/nginx/sites-available/banksia.io
fi
[ -e "$LIVE" ] || { echo "error: no banksia.io vhost found" >&2; exit 1; }
# Write through the symlink target so sites-enabled keeps pointing at the
# canonical file. Back up outside sites-enabled: the include is
# `sites-enabled/*`, so a .bak file there would be loaded as a second vhost.
TARGET="$(readlink -f "$LIVE")"
echo "site config: $LIVE -> $TARGET"

echo "--- proposed diff ---"
diff -u "$TARGET" "$STAGED" || true
echo "---------------------"

if [ "$MODE" != "apply" ]; then
  echo "dry run: nothing was installed"
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BAK="/etc/nginx/$(basename "$TARGET").bak-$STAMP"
cp -a "$TARGET" "$BAK"
install -m 644 "$STAGED" "$TARGET"

NGINX_BIN="$(command -v nginx || echo /usr/sbin/nginx)"
if ! "$NGINX_BIN" -t; then
  echo "error: nginx -t failed, restoring $BAK" >&2
  install -m 644 "$BAK" "$TARGET"
  exit 1
fi

systemctl reload nginx
echo "reloaded nginx"
echo "backup: $BAK"
REMOTE

echo "==> $HOST ($MODE)"
scp -q "$TMP/banksia-vhost.conf" "$HOST:/tmp/banksia-vhost.conf"
scp -q "$TMP/banksia-vhost-apply.sh" "$HOST:/tmp/banksia-vhost-apply.sh"
ssh -t "$HOST" "sudo bash /tmp/banksia-vhost-apply.sh $MODE /tmp/banksia-vhost.conf; rc=\$?; rm -f /tmp/banksia-vhost-apply.sh /tmp/banksia-vhost.conf; exit \$rc"
