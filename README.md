# fiscal-webapp

Web app interna para despacho fiscal mexicano. Análisis de oficios SAT/TFJA con IA, RAG sobre corpus legal, gestión de expedientes, síntesis ejecutiva con plazos calculados, chat streaming, export Word.

## Estado del sistema

✅ **Build verificado** — Next.js 15.5 + React 19 + TypeScript estricto. 16 rutas compiladas, middleware edge OK.

| Feature | Estado |
|---|---|
| Auth.js v5 magic links (Resend) — edge/node split correcto (JWT strategy) | ✅ |
| Dashboard casos + CRUD | ✅ |
| Upload PDF presigned URL → MinIO | ✅ |
| Extracción PDF + detección regex (RFC, expediente, montos, artículos) | ✅ |
| OCR worker Tesseract spa (FastAPI container) — fallback automático | ✅ |
| RAG: OpenAI embeddings + Qdrant search con filtros | ✅ |
| Síntesis 3 tipos: Ejecutiva (Sonnet) / Profunda (Opus) / Estrategia | ✅ |
| Chat streaming SSE con historial DB | ✅ |
| Búsqueda corpus directa | ✅ |
| Export `.docx` con membrete | ✅ |
| Healthcheck `/api/health` (DB + Qdrant + MinIO + OCR + Claude) | ✅ |
| Caddy reverse proxy TLS auto | ✅ |
| Prisma migración inicial + seed admin | ✅ |
| Backup/restore scripts (Postgres dump + Qdrant snapshot + MinIO tar) | ✅ |
| VPS bootstrap + deploy scripts | ✅ |

## Stack

- **Next.js 15.5** (App Router, RSC) + TypeScript estricto + Tailwind + shadcn/ui
- **Auth.js v5** magic links (Resend), JWT session strategy (edge-compatible)
- **Postgres 17** + Prisma 6
- **Qdrant** (corpus legal — 46 instrumentos vectorizados desde `fiscal-legal-mx-agent`)
- **MinIO** S3-compatible para PDFs
- **OCR worker** Python FastAPI con Tesseract `spa` (Docker)
- **LLM Layer abstracta**: Claude Sonnet 4.6 (default) + Opus 4.7 (deep) + DeepSeek (cheap, no-sensible)
- **Caddy** reverse proxy con TLS Let's Encrypt

## Arquitectura (1 VPS Ubuntu)

```
┌───────────────────────────────────────────────────────────────┐
│  Caddy :443 (TLS auto) — fiscal.tudominio.com                 │
│         ↓ reverse proxy                                       │
│  Next.js app :3000  (standalone, multi-stage Docker)          │
│  ├─ Auth.js JWT (Resend magic links)                          │
│  ├─ /dashboard (casos / chat / corpus / sintesis)             │
│  ├─ /api/upload/presigned     /api/documents                  │
│  ├─ /api/sintesis              /api/sintesis/[id]/export      │
│  ├─ /api/chat (SSE streaming)  /api/corpus/search             │
│  └─ /api/health                /api/auth/*                    │
│         ↓                                                     │
│  ┌──────────┬─────────┬──────────┬──────────────┐             │
│  │ Postgres │ Qdrant  │  MinIO   │  OCR (FastAPI)│             │
│  │ (Prisma) │ (RAG)   │ (PDFs)   │ Tesseract spa │             │
│  └──────────┴─────────┴──────────┴──────────────┘             │
│         ↓ outbound                                            │
│  Claude API + OpenAI embeddings + Resend                      │
└───────────────────────────────────────────────────────────────┘
```

## Estructura

```
fiscal-webapp/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── chat/route.ts                  ← SSE streaming
│   │   ├── corpus/search/route.ts         ← búsqueda vectorial
│   │   ├── documents/route.ts             ← registro post-upload
│   │   ├── health/route.ts                ← healthcheck multi-servicio
│   │   ├── sintesis/route.ts              ← generar síntesis
│   │   ├── sintesis/[id]/export/route.ts  ← DOCX export
│   │   └── upload/presigned/route.ts      ← presigned URL MinIO
│   ├── dashboard/
│   │   ├── casos/[id]/analizar/page.tsx
│   │   ├── casos/[id]/chat/page.tsx
│   │   ├── casos/[id]/page.tsx
│   │   ├── casos/[id]/sintesis/[sid]/page.tsx
│   │   ├── casos/[id]/upload/page.tsx
│   │   ├── casos/nuevo/page.tsx
│   │   ├── chat/page.tsx                  ← chat libre
│   │   ├── corpus/page.tsx                ← búsqueda corpus
│   │   ├── layout.tsx                     ← sidebar nav
│   │   └── page.tsx                       ← listado casos
│   ├── login/, error.tsx, not-found.tsx, layout.tsx
│
├── auth.config.ts                         ← edge-compatible (middleware)
├── middleware.ts                          ← protege rutas no-públicas
├── lib/
│   ├── auth.ts                            ← Node runtime (con Prisma)
│   ├── prisma.ts                          ← singleton
│   ├── llm/
│   │   ├── claude.ts                      ← Anthropic SDK + streaming
│   │   ├── deepseek.ts                    ← OpenAI-compatible
│   │   ├── index.ts                       ← router por tier
│   │   ├── system-prompt.ts               ← fiscal-legal-mx prompt
│   │   └── types.ts
│   ├── embeddings.ts                      ← OpenAI lazy init
│   ├── qdrant.ts                          ← cliente + searchCorpus
│   ├── rag.ts                             ← retrieveContext + inferFilters
│   ├── pdf.ts                             ← pdf-parse + detectFields regex
│   ├── ocr.ts                             ← cliente FastAPI worker
│   ├── s3.ts                              ← MinIO/S3 cliente
│   ├── sintesis.ts                        ← orquestador 10 pasos
│   ├── export-docx.ts                     ← generador DOCX
│   └── utils.ts                           ← formatMoney/Date/diasHabiles
│
├── components/
│   ├── ui/ (button, card, input)
│   ├── analizar-button.tsx
│   ├── chat.tsx                           ← SSE consumer
│   ├── corpus-search.tsx
│   └── upload-dropzone.tsx
│
├── prisma/
│   ├── schema.prisma                      ← User, Caso, Documento, Mensaje, Sintesis
│   ├── seed.ts                            ← admin inicial desde SEED_ADMIN_EMAIL
│   └── migrations/20260515000000_init/    ← SQL migración inicial
│
├── docker/
│   ├── Caddyfile                          ← TLS auto + headers seguridad
│   └── ocr/                               ← Dockerfile + main.py + requirements.txt
│
├── scripts/
│   ├── bootstrap-qdrant.ts                ← crea colección + índices
│   ├── ingest-corpus.ts                   ← chunking + embeddings → Qdrant
│   ├── download-corpus.sh                 ← descarga PDFs desde JSONs verificados
│   ├── deploy.sh                          ← rsync + docker rebuild
│   ├── backup.sh                          ← Postgres + Qdrant + MinIO
│   ├── restore.sh                         ← rollback completo
│   └── vps-bootstrap.sh                   ← bootstrap idempotente VPS
│
├── Dockerfile                             ← Next.js standalone multi-stage
├── docker-compose.yml                     ← caddy + app + postgres + qdrant + minio + ocr
├── next.config.ts
├── eslint.config.mjs
├── .env.example
└── package.json
```

## Despliegue completo en VPS Ubuntu

### Pre-requisitos
- Ubuntu 22.04+ con acceso SSH
- DNS A record: `fiscal.tudominio.com → IP_VPS`
- Puertos 80 + 443 abiertos
- Cuenta Anthropic (API key `sk-ant-...`)
- Cuenta Resend con dominio verificado
- Cuenta OpenAI (para embeddings RAG)

### Pasos

```bash
# 1. Local: deploy completo
VPS_USER=user VPS_HOST=tudominio.com bash scripts/deploy.sh

# 2. VPS primera vez:
ssh user@tudominio.com
cd ~/fiscal-webapp
bash scripts/vps-bootstrap.sh
# Genera .env con secretos. Edita variables faltantes. Re-ejecuta el script.
nano .env
bash scripts/vps-bootstrap.sh

# 3. Verificación
curl -fsS https://fiscal.tudominio.com/api/health | jq

# 4. Cargar corpus legal (si tienes fiscal-legal-mx-agent)
# Los JSONs metadata ya se sincronizan vía deploy.sh
docker compose exec app npm run corpus:download   # descarga PDFs
docker compose exec app npm run corpus:ingest     # embeddings → Qdrant
```

### Login inicial

1. Abre `https://fiscal.tudominio.com`
2. Ingresa email (debe estar en `ALLOWED_EMAIL_DOMAINS` si está configurado)
3. Revisa correo, click magic link
4. Si tu email coincide con `SEED_ADMIN_EMAIL`, eres ADMIN

## Comandos locales

```bash
npm install
cp .env.example .env.local
# editar variables

# Levantar solo infra (Postgres + Qdrant + MinIO + OCR)
docker compose up -d postgres qdrant minio ocr

# Migrar DB
npm run db:migrate

# Seed admin
npm run db:seed

# Dev server
npm run dev

# Build
npm run build

# Otros
npm run db:studio        # Prisma Studio UI
npm run bootstrap:qdrant # crear colección + índices payload
```

## Comandos VPS

```bash
# Deploy diff
VPS_USER=user VPS_HOST=tudominio.com bash scripts/deploy.sh

# Logs
docker compose logs -f app
docker compose logs -f ocr

# Backup manual
bash scripts/backup.sh

# Restore desde backup
bash scripts/restore.sh ./backups/2026-05-15-0300

# Reiniciar solo app (sin tocar volúmenes)
docker compose up -d --build app

# Healthcheck
curl -fsS http://localhost/api/health | jq
```

### Cron de backup diario

```bash
crontab -e
# Agrega:
0 3 * * * cd /home/USER/fiscal-webapp && bash scripts/backup.sh >> /var/log/fiscal-backup.log 2>&1
```

## Flujo de uso end-to-end

1. **Crear caso** — `/dashboard/casos/nuevo` (título, expediente, RFC, autoridad)
2. **Subir documentos** — drag&drop hasta 20MB por PDF. Tipo se auto-detecta del filename.
3. **Generar síntesis** — 3 opciones:
   - **Ejecutiva** (Sonnet 4.6, ~$0.05) — bloque CASO/ESTADO/ADEUDO/PLAZO/RIESGO/RECOMENDACIÓN
   - **Profunda** (Opus 4.7, ~$0.40) — tabla completa créditos + timeline + vicios artículo por artículo
   - **Estrategia defensa** (Opus 4.7, ~$0.40) — vías priorizadas + jurisprudencia + acciones próximas 72h
4. **Vista síntesis** — plazos urgentes en rojo, tags fundamentos detectados, export `.docx`
5. **Chat caso** — preguntas sobre el caso con RAG sobre corpus + historial conversación persistente
6. **Búsqueda corpus** — `/dashboard/corpus` con filtros por abreviatura (CFF, LFPCA, RMF, etc.)

## Seguridad

- ⚠️ Auth.js cookies httpOnly + secure (Caddy fuerza HTTPS)
- ⚠️ JWT signed con `AUTH_SECRET` (32 bytes random)
- ⚠️ `ALLOWED_EMAIL_DOMAINS` restringe magic links
- ⚠️ Cada API endpoint valida `session.user.id` y filtra por owner
- ⚠️ Zod validation en cada body
- ⚠️ Caddy headers: HSTS, X-Frame-Options, X-Content-Type-Options
- ⚠️ Postgres/Qdrant/MinIO NO expuestos a internet (solo red Docker `fiscal`)
- ⚠️ Datos confidenciales (RFC, montos, oficios) → **siempre Claude**. DeepSeek tier desactivado por defecto.
- ⚠️ MinIO presigned URLs expiran en 10 min

## Costos estimados mensuales (3-10 usuarios)

| Concepto | USD/mes |
|---|---|
| VPS 4GB (Hetzner/DigitalOcean) | $20-40 |
| Claude API (80% Sonnet + 20% Opus, ~500 análisis/mes) | $60-150 |
| OpenAI embeddings (ingest + RAG queries) | $5-15 |
| Resend magic links (hasta 3k/mes free) | $0-20 |
| Dominio | $1-2 |
| **TOTAL** | **$86-227** |

## Troubleshooting

**Caddy no obtiene TLS:**
- Verifica DNS A record propagado: `dig fiscal.tudominio.com`
- Puerto 80 abierto: `sudo ufw status`
- Logs: `docker compose logs caddy`

**App crashea al iniciar:**
- DB migration falla: `docker compose exec app npx prisma migrate deploy`
- Verifica `.env` completo: `bash scripts/vps-bootstrap.sh` valida vars críticas

**OCR no funciona:**
- `docker compose logs ocr` — debe responder en `http://ocr:8000/health`
- PDF muy grande: ajusta `OCR_MAX_PAGES` en docker-compose.yml

**Síntesis falla con "ningún documento legible":**
- PDF escaneado y OCR cayó. Verifica logs OCR. Aumenta DPI a 300.

**Búsqueda corpus vuelve vacío:**
- Colección Qdrant vacía. Ejecuta `npm run corpus:ingest` en el container.
- Verifica: `curl http://localhost:6333/collections/fiscal_mx | jq`

## Licencia

Uso interno.
