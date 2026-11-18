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

echo "==> Activating release"
ssh "$REMOTE" "rsync -a --checksum --delete-delay --delay-updates ~/'$STAGE'/ '$REMOTE_DIR'/ && sha256sum '$REMOTE_DIR'/index.html"

echo
echo "Deployed $REMOTE_DIR"
echo "Backup:   $REMOTE:~/$BACKUP"
echo "Rollback: ./scripts/rollback.sh ~/$BACKUP"
