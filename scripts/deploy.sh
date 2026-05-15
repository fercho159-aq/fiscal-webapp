#!/usr/bin/env bash
# Despliega fiscal-webapp a VPS via rsync + docker compose rebuild.
# Uso:
#   VPS_USER=user VPS_HOST=vps.tudominio.com bash scripts/deploy.sh
#
# Variables opcionales:
#   VPS_PATH      ruta remota (default: ~/fiscal-webapp)
#   SKIP_BUILD=1  no reconstruye después de rsync
#   SKIP_CORPUS=1 no sincroniza fiscal-legal-mx-agent corpus
set -euo pipefail

VPS_USER="${VPS_USER:?Set VPS_USER env}"
VPS_HOST="${VPS_HOST:?Set VPS_HOST env}"
VPS_PATH="${VPS_PATH:-~/fiscal-webapp}"

LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ Desplegando a ${VPS_USER}@${VPS_HOST}:${VPS_PATH}"

# 1. Rsync proyecto
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='*.log' \
  --exclude='corpus_raw' \
  --exclude='corpus-raw' \
  --exclude='corpus-metadata' \
  --exclude='.git' \
  --exclude='.DS_Store' \
  "${LOCAL_DIR}/" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"

# 2. Sincronizar corpus metadata desde fiscal-legal-mx-agent si existe
if [[ "${SKIP_CORPUS:-0}" != "1" ]]; then
  CORPUS_AGENT_DIR="$(dirname "$LOCAL_DIR")/fiscal-legal-mx-agent/research/corpus-fiscal-mx/results"
  if [[ -d "$CORPUS_AGENT_DIR" ]]; then
    echo "→ Sincronizando metadata del corpus (${CORPUS_AGENT_DIR})"
    ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${VPS_PATH}/corpus-metadata"
    rsync -avz "${CORPUS_AGENT_DIR}/" \
      "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/corpus-metadata/"
  else
    echo "  ⊘ corpus-metadata no encontrado en local (skip)"
  fi
fi

# 3. Rebuild en VPS
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "→ Reconstruyendo stack en VPS"
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_PATH} && docker compose up -d --build app caddy"
  echo "→ Esperando que la app levante..."
  sleep 8
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_PATH} && docker compose ps"
fi

echo ""
echo "✓ Deploy completo"
echo "  Verifica: curl -fsS https://\${APP_DOMAIN}/api/health | jq"
