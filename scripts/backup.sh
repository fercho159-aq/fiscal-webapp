#!/usr/bin/env bash
# Backup completo: Postgres dump + Qdrant snapshot + MinIO mirror.
# Correr DENTRO del VPS donde corre docker compose.
#
# Uso:
#   bash scripts/backup.sh [destino]
# Default destino: ./backups/YYYY-MM-DD
#
# Cron sugerido (diario 3AM):
#   0 3 * * * cd /home/USER/fiscal-webapp && bash scripts/backup.sh >> /var/log/fiscal-backup.log 2>&1
set -euo pipefail

STAMP="$(date +%F-%H%M)"
DEST="${1:-./backups/${STAMP}}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$DEST"

echo "→ Backup → $DEST"

# 1. Postgres dump
echo "  postgres..."
docker compose exec -T postgres pg_dump -U fiscal -F c -f /tmp/dump.pgc fiscal
docker compose cp postgres:/tmp/dump.pgc "$DEST/postgres.pgc"
docker compose exec -T postgres rm -f /tmp/dump.pgc

# 2. Qdrant snapshot
echo "  qdrant..."
QDRANT_KEY="$(grep -E '^QDRANT_API_KEY=' .env | cut -d= -f2-)"
SNAP_NAME="$(curl -sS -X POST "http://localhost:6333/collections/fiscal_mx/snapshots" \
  -H "api-key: ${QDRANT_KEY}" | grep -oP '"name":"\K[^"]+' || echo "")"
if [[ -n "$SNAP_NAME" ]]; then
  curl -sS -o "$DEST/qdrant-${SNAP_NAME}" \
    -H "api-key: ${QDRANT_KEY}" \
    "http://localhost:6333/collections/fiscal_mx/snapshots/${SNAP_NAME}"
  curl -sS -X DELETE \
    -H "api-key: ${QDRANT_KEY}" \
    "http://localhost:6333/collections/fiscal_mx/snapshots/${SNAP_NAME}" >/dev/null
else
  echo "  ⊘ qdrant snapshot falló (colección puede no existir aún)"
fi

# 3. MinIO mirror (rsync interno via mc o tar del volumen)
echo "  minio (tar del volumen)..."
docker run --rm \
  -v fiscal-webapp_minio_data:/source:ro \
  -v "$(pwd)/${DEST}":/dest \
  alpine tar czf /dest/minio.tar.gz -C /source .

# 4. .env config (sin secretos sensibles — solo estructura)
cp .env.example "$DEST/.env.example.copy" 2>/dev/null || true

# 5. Limpiar backups viejos
echo "→ Limpiando backups > ${RETENTION_DAYS} días"
find ./backups -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} \; 2>/dev/null || true

echo ""
echo "✓ Backup completo"
du -sh "$DEST"
