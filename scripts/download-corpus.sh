#!/usr/bin/env bash
# Descarga PDFs/HTML del corpus legal desde URLs verificadas en los JSONs.
# Espera estructura:
#   ./corpus-metadata/*.json  ← JSONs con url_oficial
# Genera:
#   ./corpus-raw/<item_id>.pdf|html
set -euo pipefail

METADATA_DIR="${METADATA_DIR:-./corpus-metadata}"
CORPUS_DIR="${CORPUS_DIR:-./corpus-raw}"

mkdir -p "$CORPUS_DIR"

command -v jq >/dev/null || { echo "ERROR: instalar jq (apt install jq)"; exit 1; }

echo "→ descargando corpus a $CORPUS_DIR"
echo "  desde metadata en $METADATA_DIR"

count=0
fail=0
skip=0

shopt -s nullglob
for json in "$METADATA_DIR"/*.json; do
  id="$(basename "$json" .json)"
  url="$(jq -r '.url_oficial // empty' "$json" 2>/dev/null || echo "")"

  if [[ -z "$url" || "$url" == "null" || "$url" == "[uncertain]" || "$url" == *"[uncertain]"* ]]; then
    skip=$((skip + 1))
    continue
  fi

  fmt="$(jq -r '.formato // "pdf"' "$json" 2>/dev/null | tr '[:upper:]' '[:lower:]')"
  ext="pdf"
  [[ "$fmt" == *"docx"* ]] && ext="docx"
  [[ "$fmt" == *"html"* ]] && ext="html"

  out="$CORPUS_DIR/${id}.${ext}"
  if [[ -f "$out" && -s "$out" ]]; then
    echo "  ✓ existe $id"
    continue
  fi

  echo "  ↓ $id"
  if curl -fsSL --retry 2 --connect-timeout 15 --max-time 180 -o "$out" "$url" 2>/dev/null; then
    if command -v sha256sum >/dev/null; then
      sha256sum "$out" > "${out}.sha256"
    else
      shasum -a 256 "$out" > "${out}.sha256"
    fi
    count=$((count + 1))
  else
    echo "  ✗ falló $id ($url)"
    fail=$((fail + 1))
    rm -f "$out"
  fi
done

echo ""
echo "RESUMEN:"
echo "  $count descargados"
echo "  $skip saltados (sin URL)"
echo "  $fail fallidos"
echo "Destino: $CORPUS_DIR"
