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

# Fix 0: detectar VARNAME=VARNAME=valor (nano paste bug)
perl -i -pe 's|^([A-Z_]+)=\1=(.+)$|$1=$2|' "$ENV_FILE"

# Fix 1: APP_DOMAIN sin https:// ni / final
perl -i -pe 's|^APP_DOMAIN=https?://([^/\s]+)/?$|APP_DOMAIN=$1|' "$ENV_FILE"

# Fix 2a: AUTH_URL sin / final
perl -i -pe 's|^(AUTH_URL=[^/\s]+)/$|$1|' "$ENV_FILE"

# Fix 2b: AUTH_URL sin protocolo → agrega https://
perl -i -pe 's|^AUTH_URL=([^h\s][^\s]*)$|AUTH_URL=https://$1|' "$ENV_FILE"

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
# Solo lo mínimo crítico para que arranque la infraestructura
REQUIRED=(APP_DOMAIN AUTH_SECRET AUTH_URL ANTHROPIC_API_KEY POSTGRES_PASSWORD QDRANT_API_KEY MINIO_ROOT_PASSWORD SEED_ADMIN_EMAIL)
# OPCIONALES (warning pero no bloquean): OPENAI_API_KEY, RESEND_API_KEY, MEMBRETE_*
OPTIONAL=(OPENAI_API_KEY RESEND_API_KEY)
PLACEHOLDER_PATTERNS=("sk-ant-xxx" "sk-xxx" "fiscal.tudominio.com" "tudominio.com")

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
  echo "✗ Variables CRÍTICAS faltantes:"
  printf '  - %s\n' "${MISSING[@]}"
fi

if [[ ${#PLACEHOLDER[@]} -gt 0 ]]; then
  echo ""
  echo "✗ Variables con PLACEHOLDER (llena con valores reales):"
  printf '  - %s\n' "${PLACEHOLDER[@]}"
fi

# Warnings opcionales
OPT_WARNINGS=()
for var in "${OPTIONAL[@]}"; do
  val="${!var:-}"
  if [[ -z "$val" || "$val" == *"_xxx"* || "$val" == *"xxx"* ]]; then
    OPT_WARNINGS+=("$var")
  fi
done

if [[ ${#OPT_WARNINGS[@]} -gt 0 ]]; then
  echo ""
  echo "⚠ Opcionales sin configurar (la app arranca pero con limitaciones):"
  for var in "${OPT_WARNINGS[@]}"; do
    case "$var" in
      OPENAI_API_KEY) echo "  - $var → sin búsqueda en corpus (RAG)" ;;
      RESEND_API_KEY) echo "  - $var → magic link va a docker logs en vez de email" ;;
      *) echo "  - $var" ;;
    esac
  done
fi

if [[ ${#MISSING[@]} -gt 0 || ${#PLACEHOLDER[@]} -gt 0 ]]; then
  echo ""
  echo "Edita $ENV_FILE y re-ejecuta."
  exit 1
fi

echo ""
echo "✓ todas las variables críticas configuradas"
