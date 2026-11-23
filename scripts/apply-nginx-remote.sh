#!/usr/bin/env bash
# Apply the real-IP + JSON access-log changes to a remote nginx host.
#
#   bash scripts/apply-nginx-remote.sh [host] [apply|dry-run]
#
# Defaults: host=hurgenburgen, mode=dry-run (shows the diff, changes nothing).
#
# What it does:
#   1. extracts the http-level block from deploy/nginx/hive.ausbit.dev.conf
#   2. installs /etc/nginx/cloudflare-realip.conf on the host
#   3. inserts the include + map + log_format before the first `server {`
#   4. inserts the access_log line after `index index.html;`
#   5. backs up the live config, runs `nginx -t`, reloads, and restores the
#      backup automatically if the test fails
#
# Safe to run twice: existing markers are detected and skipped.

set -euo pipefail

HOST="${1:-hurgenburgen}"
MODE="${2:-dry-run}"

case "$MODE" in
  apply|dry-run) ;;
  *) echo "usage: $0 [host] [apply|dry-run]" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SRC_CONF=deploy/nginx/hive.ausbit.dev.conf
SRC_IPS=deploy/nginx/cloudflare-realip.conf
[ -f "$SRC_CONF" ] || { echo "error: missing $SRC_CONF (run from the repo)" >&2; exit 1; }
[ -f "$SRC_IPS" ] || { echo "error: missing $SRC_IPS" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Single source of truth: take the block straight out of the repo config.
awk '/^# ---- Real client IPs/{f=1} /^# Friendly names for the dynamic sort routes\./{f=0} f' \
  "$SRC_CONF" > "$TMP/block.conf"
[ -s "$TMP/block.conf" ] || { echo "error: could not extract the real-IP block" >&2; exit 1; }

cat > "$TMP/remote.sh" <<'REMOTE'
set -euo pipefail
MODE="${1:-dry-run}"

LIVE="${LIVE_CONF:-}"
if [ -z "$LIVE" ]; then
  LIVE="$(grep -rl 'server_name hive\.ausbit\.dev' /etc/nginx/sites-available 2>/dev/null \
    | grep -v '\.bak-' | head -1 || true)"
fi
if [ -z "$LIVE" ]; then
  LIVE="$(grep -rl 'server_name hive\.ausbit\.dev' /etc/nginx/conf.d 2>/dev/null \
    | grep -v '\.bak-' | head -1 || true)"
fi
if [ -z "$LIVE" ]; then
  echo "error: no nginx config with 'server_name hive.ausbit.dev' found" >&2
  exit 1
fi
echo "site config: $LIVE"

STAGE=/tmp/hive-site.stage
cp "$LIVE" "$STAGE"
BLOCK="${BLOCK_CONF:-/tmp/hive-cf-block.conf}"

# The remote script runs as root, so it owns these temp files and must clean
# them up itself; the SSH user cannot remove them afterwards.
trap 'rm -f /tmp/hive-site.stage /tmp/hive-site.stage.2' EXIT

if grep -q '^# ---- Real client IPs' "$LIVE"; then
  # Replace the existing block so label changes reach the server too. The block
  # ends at the closing line of log_format; if that anchor ever moves, awk
  # exits non-zero and nothing is installed.
  if ! awk -v blockfile="$BLOCK" '
    BEGIN { while ((getline line < blockfile) > 0) block = block line "\n"; sub(/\n+$/, "\n", block) }
    /^# ---- Real client IPs/ { if (!done) { printf "%s", block; done = 1; skip = 1; next } }
    skip && /"ua":"\$http_user_agent"\}/ { skip = 0; next }
    skip { next }
    { print }
    END { if (skip || !done) exit 1 }
  ' "$STAGE" > "$STAGE.2"; then
    echo "error: could not locate the end of the existing analytics block" >&2
    exit 1
  fi
  mv "$STAGE.2" "$STAGE"
  if cmp -s "$LIVE" "$STAGE"; then
    echo "  real-IP block: up to date"
  else
    echo "  real-IP block: will update"
  fi
elif grep -q 'cloudflare-realip\.conf' "$LIVE"; then
  echo "  real-IP include: present but block markers missing, leaving it alone"
else
  awk -v blockfile="$BLOCK" '
    BEGIN { while ((getline line < blockfile) > 0) block = block line "\n"; sub(/\n+$/, "\n", block) }
    !done && /^# Friendly names for the dynamic sort routes\./ { printf "%s", block; done = 1 }
    !done && /^map[[:space:]]/ { printf "%s", block; done = 1 }
    !done && /^server[[:space:]]*\{/ { printf "\n%s", block; done = 1 }
    { print }
  ' "$STAGE" > "$STAGE.2"
  mv "$STAGE.2" "$STAGE"
  echo "  real-IP include: will insert"
fi

if grep -q 'hive_analytics' "$LIVE"; then
  echo "  access_log: already present"
else
  awk '
    !done && /^[[:space:]]*index[[:space:]]+index\.html;[[:space:]]*$/ {
      indent = $0
      sub(/[^[:space:]].*$/, "", indent)
      print
      print ""
      print indent "# JSON log for traffic analysis. Keep the default log too if other tooling"
      print indent "# reads it; this one is additive."
      print indent "access_log /var/log/nginx/hive.ausbit.dev.access.log hive_analytics;"
      done = 1
      next
    }
    { print }
  ' "$STAGE" > "$STAGE.2"
  mv "$STAGE.2" "$STAGE"
  echo "  access_log: will insert"
fi

echo "--- proposed diff ---"
diff -u "$LIVE" "$STAGE" || true
echo "---------------------"

if [ "$MODE" != "apply" ]; then
  echo "dry run: nothing was installed"
  exit 0
fi

install -m 644 /tmp/hive-cloudflare-realip.conf /etc/nginx/cloudflare-realip.conf
echo "installed /etc/nginx/cloudflare-realip.conf"

STAMP="$(date +%Y%m%d-%H%M%S)"
BAK="$LIVE.bak-$STAMP"
cp -a "$LIVE" "$BAK"
install -m 644 "$STAGE" "$LIVE"

if ! nginx -t; then
  echo "error: nginx -t failed, restoring $BAK" >&2
  install -m 644 "$BAK" "$LIVE"
  exit 1
fi

systemctl reload nginx
echo "reloaded nginx"
echo "backup: $BAK"
echo "log:    /var/log/nginx/hive.ausbit.dev.access.log"
REMOTE

echo "==> $HOST ($MODE)"
scp -q "$SRC_IPS" "$HOST:/tmp/hive-cloudflare-realip.conf"
scp -q "$TMP/block.conf" "$HOST:/tmp/hive-cf-block.conf"
scp -q "$TMP/remote.sh" "$HOST:/tmp/hive-nginx-apply.sh"
ssh -t "$HOST" "sudo bash /tmp/hive-nginx-apply.sh $MODE; rc=\$?; rm -f /tmp/hive-nginx-apply.sh /tmp/hive-cf-block.conf /tmp/hive-cloudflare-realip.conf /tmp/hive-site.stage /tmp/hive-site.stage.2; exit \$rc"
