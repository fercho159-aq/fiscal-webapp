#!/usr/bin/env bash
# Bootstrap inicial en VPS Ubuntu para fiscal-webapp.
# Idempotente — se puede correr múltiples veces.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "→ VPS bootstrap para fiscal-webapp"

# 1. Verificar Docker
if ! command -v docker >/dev/null; then
  echo "  Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if ! docker ps >/dev/null 2>&1; then
  echo "  ⚠ Docker daemon no responde. Verifica:"
  echo "    systemctl status docker"
  exit 1
fi

# 2. Detener servicios que bloquean puertos 80/443
for svc in nginx coturn apache2; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    echo "  ⚠ $svc está corriendo y bloquea puertos. Deteniendo..."
    systemctl stop "$svc"
    systemctl disable "$svc" 2>/dev/null || true
  fi
done

# 3. Generar .env si no existe
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

  perl -pi -e "s|^AUTH_SECRET=.*|AUTH_SECRET=${AUTH_SECRET}|" .env
  perl -pi -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
  perl -pi -e "s|^QDRANT_API_KEY=.*|QDRANT_API_KEY=${QDRANT_API_KEY}|" .env
  perl -pi -e "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}|" .env

  echo "  ✓ .env generado con secretos auto."
  echo ""
  echo "  EDITA AHORA estas variables en .env:"
  echo "    - APP_DOMAIN          (hostname puro, sin https://)"
  echo "    - AUTH_URL            (https://hostname, sin / final)"
  echo "    - ANTHROPIC_API_KEY"
  echo "    - OPENAI_API_KEY"
  echo "    - RESEND_API_KEY + AUTH_EMAIL_FROM"
  echo "    - ALLOWED_EMAIL_DOMAINS"
  echo "    - SEED_ADMIN_EMAIL"
  echo "    - MEMBRETE_LINE_1 / MEMBRETE_LINE_2 (con comillas si tienen espacios)"
  echo ""
  echo "  Comando: nano .env"
  echo "  Luego: bash scripts/vps-bootstrap.sh   (otra vez)"
  exit 0
fi

# 4. Auto-fix .env errores comunes + validar
echo "  Validando .env..."
if ! bash "$SCRIPT_DIR/fix-env.sh" .env; then
  echo ""
  echo "✗ .env tiene errores. Corrige y vuelve a ejecutar."
  exit 1
fi

# Cargar vars
set -a
source .env
set +a

# 5. DNS check
if [[ "${APP_DOMAIN:-}" =~ ^[0-9.]+$ ]]; then
  echo "  ⚠ APP_DOMAIN es IP — Caddy no obtendrá TLS automático."
  echo "    Para producción, configura un dominio."
elif command -v dig >/dev/null; then
  RESOLVED="$(dig +short "$APP_DOMAIN" | head -1 || true)"
  PUBLIC_IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null || echo "")"
  if [[ -z "$RESOLVED" ]]; then
    echo "  ⚠ DNS no resuelve $APP_DOMAIN — Caddy fallará al obtener TLS."
    echo "    Configura A record: $APP_DOMAIN → $PUBLIC_IP"
    read -p "  ¿Continuar de todos modos? (y/N): " ans
    [[ "$ans" == "y" || "$ans" == "Y" ]] || exit 1
  elif [[ -n "$PUBLIC_IP" && "$RESOLVED" != "$PUBLIC_IP" ]]; then
    echo "  ⚠ DNS desfasado: $APP_DOMAIN → $RESOLVED (esperado $PUBLIC_IP)"
    read -p "  ¿Continuar de todos modos? (y/N): " ans
    [[ "$ans" == "y" || "$ans" == "Y" ]] || exit 1
  else
    echo "  ✓ DNS OK: $APP_DOMAIN → $RESOLVED"
  fi
fi

# 6. Verificar puertos libres
for port in 80 443; do
  if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
    PROC="$(ss -tlnp 2>/dev/null | grep ":${port} " | head -1)"
    echo "  ⚠ Puerto $port ocupado:"
    echo "    $PROC"
    echo "    Detén el proceso antes de continuar (systemctl stop <svc>)"
    exit 1
  fi
done

# 7. Verificar corpus-metadata
if [[ ! -d corpus-metadata ]] || [[ -z "$(ls -A corpus-metadata 2>/dev/null)" ]]; then
  echo "  ⚠ corpus-metadata/ vacío — funcionará sin RAG hasta ingestar corpus."
  echo "    Después: docker compose exec app npm run corpus:ingest"
fi

# 8. Build + arranque
echo "  docker compose build (puede tardar 5-10 min primera vez)..."
docker compose build

echo "  docker compose up -d..."
docker compose up -d

# 9. Esperar health
echo "  Esperando que app esté ready (max 90s)..."
for i in $(seq 1 45); do
  if docker compose exec -T app sh -c "wget -qO- http://localhost:3000/api/health 2>/dev/null | head -c 20" 2>/dev/null | grep -q "ok\|checks"; then
    echo "  ✓ app responde"
    break
  fi
  sleep 2
done

# 10. Migrate + seed admin
echo "  Aplicando migraciones DB..."
docker compose exec -T app npx prisma migrate deploy 2>&1 | tail -5 || echo "  ⚠ migrate falló (puede que ya esté aplicado)"

echo "  Seed admin user..."
docker compose exec -T app npm run db:seed 2>&1 | tail -3 || echo "  ⚠ seed falló"

# 11. Status
echo ""
echo "✓ VPS bootstrap completo"
echo ""
docker compose ps
echo ""
echo "Verifica acceso:"
if [[ "${APP_DOMAIN:-}" =~ ^[0-9.]+$ ]]; then
  echo "  curl -fsS http://${APP_DOMAIN}/api/health | head -30"
else
  echo "  curl -fsS https://${APP_DOMAIN}/api/health | head -30"
fi
echo ""
echo "Login: visita el sitio e ingresa con ${SEED_ADMIN_EMAIL:-admin email}"
echo ""
echo "Si tienes corpus catalogado:"
echo "  bash scripts/download-corpus.sh"
echo "  docker compose exec app npm run corpus:ingest"
