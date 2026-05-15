#!/usr/bin/env bash
# Restaura desde un backup creado por backup.sh
# Uso: bash scripts/restore.sh ./backups/2026-05-15-0300
set -euo pipefail

SRC="${1:?Pasa la ruta del backup como argumento}"
[[ -d "$SRC" ]] || { echo "ERROR: $SRC no existe"; exit 1; }

echo "→ Restaurando desde $SRC"
echo "  Esto BORRARÁ datos actuales. Ctrl+C para cancelar (5s)..."
sleep 5

# Postgres
if [[ -f "$SRC/postgres.pgc" ]]; then
  echo "  postgres..."
  docker compose cp "$SRC/postgres.pgc" postgres:/tmp/dump.pgc
  docker compose exec -T postgres dropdb -U fiscal --if-exists fiscal
  docker compose exec -T postgres createdb -U fiscal fiscal
  docker compose exec -T postgres pg_restore -U fiscal -d fiscal /tmp/dump.pgc
  docker compose exec -T postgres rm -f /tmp/dump.pgc
fi

# MinIO
if [[ -f "$SRC/minio.tar.gz" ]]; then
  echo "  minio..."
  docker compose stop minio
  docker run --rm \
    -v fiscal-webapp_minio_data:/dest \
    -v "$(pwd)/${SRC}":/src:ro \
    alpine sh -c "rm -rf /dest/* && tar xzf /src/minio.tar.gz -C /dest"
  docker compose start minio
fi

# Qdrant snapshot
QDRANT_SNAP="$(ls "$SRC"/qdrant-* 2>/dev/null | head -1 || true)"
if [[ -n "$QDRANT_SNAP" ]]; then
  echo "  qdrant snapshot: $QDRANT_SNAP"
  QDRANT_KEY="$(grep -E '^QDRANT_API_KEY=' .env | cut -d= -f2-)"
  curl -sS -X PUT \
    -H "api-key: ${QDRANT_KEY}" \
    -F "snapshot=@${QDRANT_SNAP}" \
    "http://localhost:6333/collections/fiscal_mx/snapshots/upload"
fi

echo "✓ Restore completo. Reinicia app: docker compose restart app"
