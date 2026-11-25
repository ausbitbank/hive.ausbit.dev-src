#!/usr/bin/env bash
#
# Apply the canonical Content-Security-Policy to the live nginx vhost.
#
#   bash scripts/apply-csp-remote.sh [host] [apply|dry-run]
#
# Defaults: host=hurgenburgen, mode=dry-run.
#
# Only the `add_header Content-Security-Policy` line is replaced. Certbot SSL
# lines and every other directive in the live vhost stay untouched. The script
# backs up the live file, runs `nginx -t`, reloads, and restores the backup if
# the test fails.
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
POLICY="$(grep -m1 'add_header Content-Security-Policy' "$SRC_CONF" | sed 's/^[[:space:]]*//')"
[ -n "$POLICY" ] || { echo "error: no CSP line in $SRC_CONF" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
printf '%s\n' "$POLICY" > "$TMP/policy.txt"

cat > "$TMP/remote.sh" <<'REMOTE'
set -euo pipefail
MODE="$1"

LIVE="$(grep -rl 'server_name hive\.ausbit\.dev' /etc/nginx/sites-available 2>/dev/null \
  | grep -v '\.bak-' | head -1 || true)"
if [ -z "$LIVE" ]; then
  LIVE="$(grep -rl 'server_name hive\.ausbit\.dev' /etc/nginx/conf.d 2>/dev/null \
    | grep -v '\.bak-' | head -1 || true)"
fi
[ -n "$LIVE" ] || { echo "error: no nginx vhost with server_name hive.ausbit.dev" >&2; exit 1; }
echo "site config: $LIVE"

POLICY="$(cat /tmp/hive-csp-policy.txt)"
STAGE=/tmp/hive-csp.stage

python3 - "$LIVE" "$STAGE" "$POLICY" <<'PY'
import sys

live, stage, policy = sys.argv[1:4]
out = []
hits = 0
for line in open(live):
    if 'add_header Content-Security-Policy' in line:
        indent = line[:len(line) - len(line.lstrip())]
        out.append(indent + policy + '\n')
        hits += 1
    else:
        out.append(line)
if hits != 1:
    sys.exit('expected exactly one CSP add_header in %s, found %d' % (live, hits))
open(stage, 'w').write(''.join(out))
PY

echo "--- proposed diff ---"
diff -u "$LIVE" "$STAGE" || true
echo "---------------------"

if [ "$MODE" != "apply" ]; then
  echo "dry run: nothing was installed"
  exit 0
fi

BAK="$LIVE.bak-$(date -u +%Y%m%dT%H%M%SZ)"
cp -a "$LIVE" "$BAK"
install -m 644 "$STAGE" "$LIVE"

if ! nginx -t; then
  install -m 644 "$BAK" "$LIVE"
  echo "error: nginx -t failed, restored $BAK" >&2
  exit 1
fi

systemctl reload nginx
echo "reloaded nginx"
echo "backup: $BAK"
REMOTE

scp -q "$TMP/policy.txt" "$HOST:/tmp/hive-csp-policy.txt"
scp -q "$TMP/remote.sh" "$HOST:/tmp/hive-csp-apply.sh"

if [ "$MODE" = "apply" ]; then
  ssh -t "$HOST" "sudo bash /tmp/hive-csp-apply.sh apply; rc=\$?; sudo rm -f /tmp/hive-csp-apply.sh /tmp/hive-csp-policy.txt /tmp/hive-csp.stage; exit \$rc"
else
  ssh "$HOST" "bash /tmp/hive-csp-apply.sh dry-run; rc=\$?; rm -f /tmp/hive-csp-apply.sh /tmp/hive-csp-policy.txt /tmp/hive-csp.stage; exit \$rc"
fi
