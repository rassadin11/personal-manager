#!/usr/bin/env bash
# Daily SQLite backup with 14-day rotation.
# Usage (host cron): 0 4 * * * /opt/personal-manager/scripts/backup.sh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_FILE="$PROJECT_DIR/data/data.db"
BACKUP_DIR="$PROJECT_DIR/backups"
KEEP_DAYS=14

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$DB_FILE" ]]; then
  echo "DB not found: $DB_FILE" >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/data-$STAMP.db"

# Online backup via container (sqlite3 may not be on host).
docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T app \
  node -e "const{DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/data.db').exec(\"VACUUM INTO '/data/.backup.tmp'\");"

mv "$PROJECT_DIR/data/.backup.tmp" "$OUT"
gzip -9 "$OUT"

find "$BACKUP_DIR" -name 'data-*.db.gz' -mtime "+$KEEP_DAYS" -delete

echo "Backup OK: $OUT.gz"
