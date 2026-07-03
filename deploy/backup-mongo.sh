#!/usr/bin/env bash
# Ежедневный бэкап базы brickstove (проекты печников, лиды, черновики).
# Запускается кроном; держит последние 14 архивов.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/brick-stove}"
CONTAINER="brick-stove-builder-mongo"
KEEP=14

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
ARCHIVE="$BACKUP_DIR/brickstove-$STAMP.archive.gz"

docker exec "$CONTAINER" mongodump --db brickstove --archive --quiet | gzip > "$ARCHIVE"

# пустой дамп — признак проблемы, не считаем его успехом
if [ ! -s "$ARCHIVE" ]; then
  echo "ERROR: empty backup $ARCHIVE" >&2
  rm -f "$ARCHIVE"
  exit 1
fi

# ротация
ls -1t "$BACKUP_DIR"/brickstove-*.archive.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "$(date -Is) OK $(du -h "$ARCHIVE" | cut -f1) $ARCHIVE"
