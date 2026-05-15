#!/usr/bin/env bash
# Auto-repara errores comunes en .env:
#   1. APP_DOMAIN con https:// o / final → solo hostname
#   2. AUTH_URL con / final → sin /
#   3. MEMBRETE_LINE_* sin comillas → agrega comillas
#   4. ALLOWED_EMAIL_DOMAINS con # comments inline → quita
#   5. OPENAI_API_KEY=sk-xxx # comment → mueve comment a línea anterior
#   6. Valida sintaxis con `bash -n` y `set -a; source`
#
# Uso: bash scripts/fix-env.sh [archivo]
# Default: ./.env
set -euo pipefail

ENV_FILE="${1:-.env}"

[[ -f "$ENV_FILE" ]] || { echo "ERROR: $ENV_FILE no existe"; exit 1; }

cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)"
echo "→ backup creado: ${ENV_FILE}.bak.*"

# Fix 1: APP_DOMAIN sin https:// ni / final
perl -i -pe 's|^APP_DOMAIN=https?://([^/\s]+)/?$|APP_DOMAIN=$1|' "$ENV_FILE"

# Fix 2: AUTH_URL sin / final
perl -i -pe 's|^(AUTH_URL=[^/\s]+)/$|$1|' "$ENV_FILE"

# Fix 3: MEMBRETE_* con espacios pero sin comillas → agrega comillas
perl -i -pe 's|^(MEMBRETE_[A-Z_0-9]+)=([^"\n][^\n]*[^"\n])$|$1="$2"|' "$ENV_FILE"

# Fix 4: ALLOWED_EMAIL_DOMAINS con # inline → corta
perl -i -pe 's|^(ALLOWED_EMAIL_DOMAINS=[^#\s]*)\s*#.*$|$1|' "$ENV_FILE"

# Fix 5: OPENAI_API_KEY=sk-xxx # comment → quita comment inline
perl -i -pe 's|^(OPENAI_API_KEY=\S+)\s+#.*$|$1|' "$ENV_FILE"
perl -i -pe 's|^(ANTHROPIC_API_KEY=\S+)\s+#.*$|$1|' "$ENV_FILE"
perl -i -pe 's|^(DEEPSEEK_API_KEY=)\s+#.*$|$1|' "$ENV_FILE"

# Fix 6: quitar espacios al final de cada línea (puede confundir bash)
perl -i -pe 's|\s+$|\n|' "$ENV_FILE"

# Validar sintaxis
echo "→ validando sintaxis..."
if ! ( set -a; source "$ENV_FILE"; set +a ) 2>/tmp/env-test-error; then
  echo ""
  echo "✗ ERROR en $ENV_FILE:"
  cat /tmp/env-test-error
  echo ""
  echo "Líneas con problema potencial (sin comillas y con espacios):"
  grep -nE '^[A-Z_]+=[^"][^=]*\s[^=]*$' "$ENV_FILE" || true
  exit 1
fi

echo "✓ $ENV_FILE válido"

# Validar vars críticas no vacías
REQUIRED=(APP_DOMAIN AUTH_SECRET AUTH_URL ANTHROPIC_API_KEY OPENAI_API_KEY POSTGRES_PASSWORD QDRANT_API_KEY MINIO_ROOT_PASSWORD)
PLACEHOLDER_PATTERNS=("sk-ant-xxx" "sk-xxx" "re_xxx" "fiscal.tudominio.com" "tudominio.com")

MISSING=()
PLACEHOLDER=()

set -a; source "$ENV_FILE"; set +a

for var in "${REQUIRED[@]}"; do
  val="${!var:-}"
  if [[ -z "$val" ]]; then
    MISSING+=("$var")
    continue
  fi
  for ph in "${PLACEHOLDER_PATTERNS[@]}"; do
    if [[ "$val" == *"$ph"* ]]; then
      PLACEHOLDER+=("$var (valor: $val)")
      break
    fi
  done
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  echo "✗ Variables FALTANTES:"
  printf '  - %s\n' "${MISSING[@]}"
fi

if [[ ${#PLACEHOLDER[@]} -gt 0 ]]; then
  echo ""
  echo "⚠ Variables con PLACEHOLDER (debes llenarlas con valores reales):"
  printf '  - %s\n' "${PLACEHOLDER[@]}"
fi

if [[ ${#MISSING[@]} -gt 0 || ${#PLACEHOLDER[@]} -gt 0 ]]; then
  echo ""
  echo "Edita $ENV_FILE y re-ejecuta."
  exit 1
fi

echo "✓ todas las variables críticas configuradas"
