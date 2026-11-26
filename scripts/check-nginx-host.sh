#!/usr/bin/env bash
# Verify the live nginx host before an SPA deploy.
#
# The production app is served by one shared vhost that owns both
# banksia.io/www.banksia.io and the legacy hive.ausbit.dev. Deploys are SPA-only
# and must never install or overwrite the nginx config, so this check fails
# before activation if the hostnames, docroot or shared-vhost invariant drift.
#
# Usage: bash scripts/check-nginx-host.sh [host]

set -euo pipefail

HOST="${1:-hurgenburgen}"

ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
CONF=/etc/nginx/sites-enabled/banksia.io
[ -f "$CONF" ] || { echo "error: $CONF is missing" >&2; exit 1; }
grep -Eq 'server_name[^;]*[[:space:]]banksia\.io([[:space:]]|;)' "$CONF" || {
  echo "error: $CONF must serve banksia.io" >&2
  exit 1
}
grep -Eq 'server_name[^;]*[[:space:]]hive\.ausbit\.dev([[:space:]]|;)' "$CONF" || {
  echo "error: $CONF must serve the legacy hive.ausbit.dev" >&2
  exit 1
}
grep -q 'root /var/www/banksia.io;' "$CONF" || {
  echo "error: $CONF root is not /var/www/banksia.io" >&2
  exit 1
}
grep -q 'location = /about' "$CONF" || {
  echo "error: $CONF is missing the /about location" >&2
  exit 1
}
for f in /etc/nginx/sites-enabled/*; do
  [ -e "$f" ] || continue
  [ "$f" = "$CONF" ] && continue
  if grep -Eq 'server_name[^;]*[[:space:]](banksia\.io|hive\.ausbit\.dev)([[:space:]]|;)' "$f"; then
    echo "error: another enabled vhost configures banksia.io or hive.ausbit.dev: $f" >&2
    exit 1
  fi
done

DOCROOT=/var/www/banksia.io
[ -d "$DOCROOT" ] || { echo "error: docroot $DOCROOT is missing" >&2; exit 1; }

# A directory in the docroot named like a route (/join/, /create/, /shorts/)
# makes nginx answer /join with 301 /join/, while the vhost's no-trailing-slash
# rule answers /join/ with 301 /join: the browser reports "page isn't
# redirecting properly". Probe the origin locally and fail before a deploy when
# a directory shadows its route. The edge route check in verify-deploy.mjs
# covers directories that only appear in the new build.
for dir in "$DOCROOT"/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  case "$name" in assets|statics) continue ;; esac
  headers="$(curl -ksS -m 10 --noproxy '*' -D - -o /dev/null --resolve "banksia.io:443:127.0.0.1" \
    "https://banksia.io/$name" 2>/dev/null || true)"
  status="$(printf '%s\n' "$headers" | awk '/^HTTP\//{ s=$2 } END { print s }')"
  # No local answer (nginx not reachable from this shell): the post-deploy edge
  # route check still covers it.
  [ -n "$status" ] || continue
  if { [ "$status" = 301 ] || [ "$status" = 308 ]; } && \
     printf '%s\n' "$headers" | grep -qiE "^location:[[:space:]]*https?://[^/]+/$name/[?[:space:]]*$"; then
    echo "error: docroot directory /$name shadows its route: /$name redirects to /$name/ and back (redirect loop); add an explicit location for /$name to $CONF" >&2
    exit 1
  fi
done

echo "nginx host config: shared banksia.io + hive.ausbit.dev vhost OK"
REMOTE
