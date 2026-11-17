#!/usr/bin/env bash
#
# Restore a previously deployed build from a backup created by deploy.sh.
# The current (bad) deployment is backed up automatically before restoring.
#
# Usage:
#   ./scripts/rollback.sh ~/hive-backups/hive.ausbit.dev-20261117T074127Z.tar.gz
#   REMOTE=myhost ./scripts/rollback.sh /path/on/remote/backup.tar.gz
#
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <remote-backup.tar.gz>" >&2
  exit 1
fi

REMOTE="${REMOTE:-hurgenburgen}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/hive.ausbit.dev}"
REMOTE_PARENT="$(dirname "$REMOTE_DIR")"
REMOTE_NAME="$(basename "$REMOTE_DIR")"
BACKUP="$1"
REMOTE_BACKUP="$BACKUP"
if [[ "$REMOTE_BACKUP" == "~/"* ]]; then
  REMOTE_BACKUP='$HOME/'"${REMOTE_BACKUP#\~/}"
fi

echo "==> Saving the current deployment before rollback"
ssh "$REMOTE" "set -e
  mkdir -p ~/hive-backups
  TS=\$(date -u +%Y%m%dT%H%M%SZ)
  tar -C '$REMOTE_PARENT' -czf ~/hive-backups/pre-rollback-\$TS.tar.gz '$REMOTE_NAME'
  echo \"pre-rollback backup: ~/hive-backups/pre-rollback-\$TS.tar.gz\""

echo "==> Restoring $BACKUP"
ssh "$REMOTE" "set -e
  test -f \"$REMOTE_BACKUP\"
  TMP=\$(mktemp -d)
  tar -xzf \"$REMOTE_BACKUP\" -C \"\$TMP\"
  rsync -a --checksum --delete-delay --delay-updates \"\$TMP/$REMOTE_NAME/\" '$REMOTE_DIR'/
  rm -rf \"\$TMP\"
  sha256sum '$REMOTE_DIR'/index.html"

echo
echo "Rolled back $REMOTE_DIR from $BACKUP"
