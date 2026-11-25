#!/usr/bin/env bash
#
# Deploy the SPA to the production host with a timestamped backup.
#
# Usage:
#   ./scripts/deploy.sh
#   REMOTE=myhost REMOTE_DIR=/var/www/example ./scripts/deploy.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE="${REMOTE:-hurgenburgen}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/hive.ausbit.dev}"
REMOTE_PARENT="$(dirname "$REMOTE_DIR")"
REMOTE_NAME="$(basename "$REMOTE_DIR")"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
STAGE="hive-deploy-$TS"
BACKUP="hive-backups/$REMOTE_NAME-$TS.tar.gz"
# Hashed asset files are never overwritten, only superseded. Keeping them for a
# while means a tab opened before this deploy can still lazy-load its chunks
# instead of failing the navigation.
KEEP_DAYS="${KEEP_DAYS:-45}"

echo "==> Lint"
bun run lint

echo "==> Build"
bun run build

echo "==> Prerender key routes (metadata only)"
node scripts/prerender.mjs || echo "Prerender skipped"

echo "==> Backing up $REMOTE:$REMOTE_DIR"
ssh "$REMOTE" "mkdir -p ~/hive-backups && tar -C '$REMOTE_PARENT' -czf ~/'$BACKUP' '$REMOTE_NAME' && sha256sum ~/'$BACKUP'"

echo "==> Uploading to $REMOTE:~/$STAGE"
rsync -az --delete --stats dist/spa/ "$REMOTE:~/$STAGE/"

echo "==> Activating release (keeping ${KEEP_DAYS}d of previous hashed assets)"
ssh "$REMOTE" "set -e
  rsync -a --checksum --delete-delay --delay-updates --exclude '/assets/' ~/'$STAGE'/ '$REMOTE_DIR'/
  rsync -a --checksum ~/'$STAGE'/assets/ '$REMOTE_DIR'/assets/
  find '$REMOTE_DIR'/assets -mindepth 1 -maxdepth 1 -type f -mtime +$KEEP_DAYS -delete
  find '$REMOTE_DIR'/assets -mindepth 1 -maxdepth 1 -type d -empty -delete
  sha256sum '$REMOTE_DIR'/index.html"

echo
echo "Backup:   $REMOTE:~/$BACKUP"
echo "Rollback: ./scripts/rollback.sh ~/$BACKUP"

echo "==> Verifying deployment"
ORIGIN_IP="${VERIFY_ORIGIN_IP:-$(ssh "$REMOTE" "hostname -I 2>/dev/null | awk '{print \$1}'" || true)}"
VERIFY_URL="${VERIFY_URL:-https://hive.ausbit.dev/}" \
  VERIFY_ORIGIN_IP="$ORIGIN_IP" \
  node scripts/verify-deploy.mjs

echo
echo "Deployed $REMOTE_DIR"
