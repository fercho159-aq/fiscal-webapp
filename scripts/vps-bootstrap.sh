#!/usr/bin/env bash
# Bootstrap inicial en VPS Ubuntu para fiscal-webapp.
# Asume Ubuntu 22.04+ y acceso sudo.
# Idempotente — se puede correr múltiples veces.
set -euo pipefail

echo "→ VPS bootstrap para fiscal-webapp"

# 1. Verificar Docker
if ! command -v docker >/dev/null; then
  echo "  Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "  ⚠ Cierra sesión y vuelve a entrar para usar docker sin sudo"
fi

# 2. Generar .env si no existe
if [[ ! -f .env ]]; then
  if [[ ! -f .env.example ]]; then
    echo "ERROR: ejecuta este script desde la raíz de fiscal-webapp"
    exit 1
  fi
  echo "  Generando .env desde .env.example..."
  cp .env.example .env

  AUTH_SECRET="$(openssl rand -hex 32)"
  POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  QDRANT_API_KEY="$(openssl rand -hex 32)"
  MINIO_ROOT_PASSWORD="$(openssl rand -hex 24)"

  # macOS y Linux sed difieren con -i; usamos perl portable
  perl -pi -e "s|^AUTH_SECRET=.*|AUTH_SECRET=${AUTH_SECRET}|" .env
  perl -pi -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
  perl -pi -e "s|^QDRANT_API_KEY=.*|QDRANT_API_KEY=${QDRANT_API_KEY}|" .env
  perl -pi -e "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}|" .env

  echo "  ✓ .env generado con secretos. Edita ahora:"
  echo "    - APP_DOMAIN"
  echo "    - ANTHROPIC_API_KEY"
  echo "    - RESEND_API_KEY + AUTH_EMAIL_FROM"
  echo "    - OPENAI_API_KEY"
  echo "    - ALLOWED_EMAIL_DOMAINS"
  echo "    - SEED_ADMIN_EMAIL"
  echo "    - MEMBRETE_LINE_1 / MEMBRETE_LINE_2"
  echo ""
  echo "  Edita: nano .env"
  echo "  Luego corre: bash scripts/vps-bootstrap.sh   (de nuevo, esta vez sí levantará todo)"
  exit 0
fi

# 3. Validar que .env tiene lo crítico
source .env
for var in APP_DOMAIN AUTH_SECRET POSTGRES_PASSWORD ANTHROPIC_API_KEY RESEND_API_KEY OPENAI_API_KEY; do
  val="${!var:-}"
  if [[ -z "$val" || "$val" == *"_xxx" || "$val" == "sk-xxx" || "$val" == "fiscal.tudominio.com" ]]; then
    echo "  ⚠ Variable sin configurar: $var=$val"
    exit 1
  fi
done

# 4. Build + arranque
echo "  docker compose build..."
docker compose build

echo "  docker compose up -d..."
docker compose up -d

# 5. Esperar health
echo "  Esperando que app esté ready (max 60s)..."
for i in $(seq 1 30); do
  if docker compose exec -T app sh -c "curl -fsS http://localhost:3000/api/health" >/dev/null 2>&1; then
    echo "  ✓ app responde"
    break
  fi
  sleep 2
done

# 6. Seed admin
echo "  Seed admin user..."
docker compose exec -T app npm run db:seed || true

# 7. Mostrar status
echo ""
echo "✓ VPS bootstrap completo"
echo ""
docker compose ps
echo ""
echo "Siguientes pasos:"
echo "  1. Verifica DNS A record: ${APP_DOMAIN} → IP del VPS"
echo "  2. Espera ~30s a que Caddy obtenga TLS"
echo "  3. Abre https://${APP_DOMAIN}"
echo "  4. Login con ${SEED_ADMIN_EMAIL:-tu correo}"
echo ""
echo "Si tienes corpus:"
echo "  bash scripts/download-corpus.sh"
echo "  docker compose exec app npm run corpus:ingest"
