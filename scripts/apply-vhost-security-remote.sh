#!/usr/bin/env bash
#
# Apply the repo's security directives to the live nginx vhost.
#
#   bash scripts/apply-vhost-security-remote.sh [host] [apply|dry-run]
#
# Defaults: host=hurgenburgen, mode=dry-run.
#
# Patches, idempotently:
#   - Content-Security-Policy (replaced with the repo policy)
#   - Report-To + Reporting-Endpoints for /csp-report
#   - server_tokens off
#   - a dotfile-deny location (except /.well-known)
#
# Certbot SSL lines and every other directive in the live vhost stay untouched.
# The script backs up the live file, runs `nginx -t`, reloads, and restores the
# backup if the test fails.
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
POLICY="$(grep -m1 'add_header Content-Security-Policy' "$SRC_CONF" | sed 's/^[[:space:]]*//')"
[ -n "$POLICY" ] || { echo "error: no CSP line in $SRC_CONF" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
printf '%s\n' "$POLICY" > "$TMP/policy.txt"

cat > "$TMP/remote.sh" <<'REMOTE'
set -euo pipefail
MODE="$1"

LIVE="${LIVE_CONF:-}"
if [ -z "$LIVE" ]; then
  LIVE="$(grep -rlE 'server_name (banksia\.io|hive\.ausbit\.dev)' /etc/nginx/sites-available 2>/dev/null \
    | grep -v '\.bak-' | head -1 || true)"
fi
if [ -z "$LIVE" ]; then
  LIVE="$(grep -rlE 'server_name (banksia\.io|hive\.ausbit\.dev)' /etc/nginx/conf.d 2>/dev/null \
    | grep -v '\.bak-' | head -1 || true)"
fi
[ -n "$LIVE" ] || { echo "error: no nginx vhost with server_name banksia.io" >&2; exit 1; }
echo "site config: $LIVE"

STAGE=/tmp/banksia-vhost.stage

python3 - "$LIVE" "$STAGE" /tmp/banksia-csp-policy.txt <<'PY'
import sys

live, stage, policy_file = sys.argv[1:4]
policy = open(policy_file).read().strip()
text = open(live).read()

report_to = (
    "add_header Report-To '{\"group\":\"csp-endpoint\",\"max_age\":10886400,"
    "\"endpoints\":[{\"url\":\"https://banksia.io/csp-report\"}]}' always;"
)
endpoints = (
    "add_header Reporting-Endpoints "
    "'csp-endpoint=\"https://banksia.io/csp-report\"' always;"
)

has_report_to = 'add_header Report-To' in text
has_endpoints = 'add_header Reporting-Endpoints' in text

out = []
hits = 0
for line in text.splitlines(True):
    if line.lstrip().startswith('add_header Content-Security-Policy'):
        indent = line[:len(line) - len(line.lstrip())]
        out.append(indent + policy + '\n')
        if not has_report_to:
            out.append(indent + report_to + '\n')
        if not has_endpoints:
            out.append(indent + endpoints + '\n')
        hits += 1
    else:
        out.append(line)
if hits != 1:
    sys.exit('expected exactly one CSP add_header in %s, found %d' % (live, hits))
text = ''.join(out)

if 'server_tokens' not in text:
    marker = 'server_name banksia.io www.banksia.io hive.ausbit.dev;\n'
    if marker not in text:
        sys.exit('could not find the server_name line')
    text = text.replace(marker, marker + '    server_tokens off;\n', 1)

if 'location ~ /\\.' not in text:
    marker = 'error_page 404 =404 @spa404;\n'
    if marker not in text:
        sys.exit('could not find the error_page marker')
    block = (
        '\n'
        '    # Never serve dotfiles. ACME/well-known handlers stay reachable.\n'
        '    location ~ /\\.(?!well-known) {\n'
        '        deny all;\n'
        '    }\n'
    )
    text = text.replace(marker, marker + block, 1)

open(stage, 'w').write(text)
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

scp -q "$TMP/policy.txt" "$HOST:/tmp/banksia-csp-policy.txt"
scp -q "$TMP/remote.sh" "$HOST:/tmp/banksia-vhost-apply.sh"

if [ "$MODE" = "apply" ]; then
  ssh -t "$HOST" "sudo bash /tmp/banksia-vhost-apply.sh apply; rc=\$?; sudo rm -f /tmp/banksia-vhost-apply.sh /tmp/banksia-csp-policy.txt /tmp/banksia-vhost.stage; exit \$rc"
else
  ssh "$HOST" "bash /tmp/banksia-vhost-apply.sh dry-run; rc=\$?; rm -f /tmp/banksia-vhost-apply.sh /tmp/banksia-csp-policy.txt /tmp/banksia-vhost.stage; exit \$rc"
fi
