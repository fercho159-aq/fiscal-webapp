#!/usr/bin/env bash
# Setup NGINX site + Certbot TLS para fiscal.yaakob.com.
# Asume:
#   - NGINX ya instalado y corriendo (host)
#   - Certbot ya instalado (apt install -y certbot python3-certbot-nginx)
#   - DNS A record fiscal.yaakob.com → IP VPS configurado y propagado
#
# Uso: sudo bash scripts/setup-nginx.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOMAIN="${APP_DOMAIN:-}"

# Cargar APP_DOMAIN desde .env si no se pasó por env
if [[ -z "$DOMAIN" ]] && [[ -f "$PROJECT_DIR/.env" ]]; then
  DOMAIN="$(grep -E '^APP_DOMAIN=' "$PROJECT_DIR/.env" | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi

if [[ -z "$DOMAIN" ]]; then
  echo "ERROR: APP_DOMAIN no configurado en .env"
  exit 1
fi

if [[ "$DOMAIN" =~ ^[0-9.]+$ ]]; then
  echo "ERROR: APP_DOMAIN es IP. Necesitas un dominio para TLS auto."
  exit 1
fi

echo "→ Setup NGINX + Certbot para $DOMAIN"

# 1. Verificar dependencias
for cmd in nginx certbot; do
  command -v "$cmd" >/dev/null || { echo "ERROR: $cmd no instalado. Instala con: apt install -y nginx certbot python3-certbot-nginx"; exit 1; }
done

# 2. Verificar DNS apunta acá
PUBLIC_IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || echo "")"
RESOLVED="$(dig @8.8.8.8 +short "$DOMAIN" | head -1 || true)"

if [[ -z "$RESOLVED" ]]; then
  echo "ERROR: DNS no resuelve $DOMAIN. Configura A record → $PUBLIC_IP"
  exit 1
fi

if [[ -n "$PUBLIC_IP" && "$RESOLVED" != "$PUBLIC_IP" ]]; then
  echo "⚠ DNS desfasado: $DOMAIN → $RESOLVED (esperado $PUBLIC_IP)"
  read -p "  ¿Continuar? (y/N): " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]] || exit 1
fi

echo "✓ DNS OK: $DOMAIN → $RESOLVED"

# 3. Generar config NGINX con dominio sustituido
SITE_TEMPLATE="$PROJECT_DIR/docker/nginx-site.conf"
SITE_DEST="/etc/nginx/sites-available/fiscal-webapp"

sed "s/fiscal\.yaakob\.com/$DOMAIN/g" "$SITE_TEMPLATE" > "$SITE_DEST"

# 4. Symlink en sites-enabled (idempotente)
ln -sf "$SITE_DEST" /etc/nginx/sites-enabled/fiscal-webapp

# 5. ANTES de TLS — config temporal solo HTTP para que certbot pueda hacer challenge
cat > "$SITE_DEST" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto http;
        client_max_body_size 25M;
        proxy_read_timeout 300s;
    }
}
EOF

# 6. Test + reload
nginx -t || { echo "ERROR: config NGINX inválida"; exit 1; }
systemctl reload nginx
echo "✓ NGINX site temporal (HTTP) activo"

# 7. Esperar app esté arriba antes de certbot
echo "  Verificando que la app responde..."
for i in $(seq 1 15); do
  if curl -fsS --max-time 3 "http://127.0.0.1:3010/api/health" >/dev/null 2>&1; then
    echo "  ✓ app responde en :3010"
    break
  fi
  if [[ $i -eq 15 ]]; then
    echo "  ⚠ app no responde aún. Levanta el stack primero:"
    echo "    docker compose up -d"
    echo "  Luego re-ejecuta este script."
    exit 1
  fi
  sleep 2
done

# 8. Obtener certificado TLS
echo "  Obteniendo certificado Let's Encrypt..."
certbot --nginx \
  --non-interactive \
  --agree-tos \
  --redirect \
  --email "${CERTBOT_EMAIL:-admin@$DOMAIN}" \
  -d "$DOMAIN" \
  || { echo "ERROR: certbot falló. Revisa logs en /var/log/letsencrypt/"; exit 1; }

echo ""
echo "✓ TLS configurado para $DOMAIN"
echo ""
echo "Verifica: curl -fsS https://$DOMAIN/api/health"
