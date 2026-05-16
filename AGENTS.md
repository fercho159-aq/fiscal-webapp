# AGENTS.md — fiscal-webapp

Briefing para agentes de IA (Claude Code, Cursor, otros) que trabajen en este proyecto.
Lee esto **antes** de hacer cambios. Vive en este vault Obsidian + copia en repo root.

---

## TL;DR

Sistema interno para despacho fiscal mexicano. Analiza oficios SAT / TFJA / amparo con IA + RAG sobre corpus legal mexicano vectorizado. Genera síntesis ejecutiva, profunda o estrategia de defensa. Export PDF con Montserrat. Login email+password directo o magic link.

- **Repos:**
  - `~/Developer/fiscal-webapp/` → https://github.com/fercho159-aq/fiscal-webapp
  - `~/Developer/fiscal-legal-mx-agent/` → https://github.com/fercho159-aq/fiscal-legal-mx-agent
- **VPS Hostinger:** `ssh root@31.220.109.7` · stack en `/root/fiscal-webapp/`
- **App pública:** https://fiscal.yaakob.com
- **Login:** `ADMIN_EMAIL` + `ADMIN_PASSWORD` del `.env` en VPS
- **Convive con:** n8n, PM2 (despechadas-*, api-mensajeria), spreed-webrtc, traefik (no usa)

---

## Stack

| Capa | Tech | Versión clave |
|---|---|---|
| Frontend | Next.js App Router | 15.5 (estable) |
| React | Estable | 19.x |
| TS | Estricto | 5.6 |
| Styling | Tailwind + shadcn/ui custom | 3.4 |
| Tipografía | Montserrat vía `next/font/google` | 300-700 |
| Auth | Auth.js v5 beta + Credentials + Resend | 5.0.0-beta.25 |
| ORM | Prisma | **6.19.3 pinned** (no 7.x) |
| DB | Postgres | 17-alpine |
| Vector DB | Qdrant | latest |
| Storage | MinIO (S3-compatible) | latest |
| OCR | Tesseract `spa` en FastAPI Python | 0.115 |
| LLM | Anthropic SDK (Claude) | 0.35 |
| Embeddings | OpenAI `text-embedding-3-large` | 3072 dim |
| PDF export | Puppeteer + Chromium Alpine | 23.8 |
| Reverse proxy | NGINX host (existente VPS) | — |
| TLS | Certbot Let's Encrypt | — |

---

## Decisiones críticas (no cambiar sin entender el porqué)

### 1. JWT strategy, NO database session

Auth.js v5 con `session.strategy = "jwt"`. Razón: middleware corre en **edge runtime** que no puede usar PrismaAdapter. Si cambias a `"database"` rompe el middleware.

Split en dos archivos:
- `auth.config.ts` (root) — config edge-safe sin providers ni adapter
- `lib/auth.ts` (node) — config completa con Prisma + Credentials + Resend

### 2. Claude default, NO DeepSeek/Kimi/OpenAI para datos sensibles

`lib/llm/index.ts` tiene tiers:
- `default` → Sonnet 4.6 (síntesis, chat)
- `deep` → Opus 4.7 (análisis profundo, estrategia defensa)
- `fast` → Haiku 4.5
- `cheap` → DeepSeek (SOLO si key configurada, para queries no-confidenciales)

**Razón:** datos confidenciales fiscales (RFC, montos, oficios) → jurisdicción US (Anthropic), no China.

### 3. NGINX host, NO Caddy en el stack

VPS ya tenía NGINX manejando otros dominios (n8n, despechadas, etc.). Caddy fue removido. La app expone solo `127.0.0.1:3010` y NGINX hace proxy con Certbot TLS.

Si cambias docker-compose para exponer 80/443, chocas con todo.

### 4. Upload PDF raw body, NO FormData

Endpoint `/api/upload/direct` recibe el binary del PDF directo en `req.arrayBuffer()`. Metadata viaja en query params.

**Razón:** Next.js 15 limita FormData a 10MB por default. Raw body bypassa esa restricción (límite real 25MB).

### 5. Prisma 6.x pinned, NO 7.x

Schema usa `url = env("DATABASE_URL")` dentro del datasource. Prisma 7 eliminó esa sintaxis (la movió a `prisma.config.ts`). Si actualizas, el schema necesita migración manual.

Lock file `package-lock.json` está committeado. NO uses `npm update` sin pensar.

### 6. Runtime Docker copia node_modules COMPLETO

`Dockerfile` runner stage hace `COPY --from=builder /app/node_modules ./node_modules`. NO copies selectivo — Prisma 6 tiene deps profundas (`effect`, `@prisma/config`, WASM binaries) que rompen si faltan.

Tradeoff: imagen ~400MB más grande. Vale la robustez.

### 7. OCR worker separado como container

`docker/ocr/` es un container Python FastAPI con Tesseract `spa`. Webapp lo llama vía red interna (`http://ocr:8000/ocr`) cuando `pdf-parse` extrae menos de 200 chars (PDF escaneado).

No metas Tesseract en el Dockerfile de Next.js. Separado escala mejor.

### 8. Sin emojis en respuestas de LLM

System prompt (`lib/llm/system-prompt.ts`) prohibe emojis explícitamente. UI también sin emojis (usa Lucide icons + badges + colores semánticos).

**Razón:** contexto fiscal/legal serio + render inconsistente entre plataformas + pictogramas no son tokens semánticos.

### 9. Markdown estructurado + stripMarkdown en previews

LLM genera Markdown limpio (GFM tables, headers, lists). Render con `<SintesisRender>` (react-markdown + remark-gfm).

**Para previews/estado procesal usa `stripMarkdown()` de `lib/strip-markdown.ts`** — convierte tablas a `· dot ·` y quita bold/italic. Sin eso ves `** texto **` y `| --- | --- |` en interfaz.

### 10. PDF export con Puppeteer + Chromium Alpine

`/api/sintesis/[id]/export` → `lib/export-pdf.ts` genera HTML con Montserrat embedded (Google Fonts CDN) y Puppeteer renderiza Letter. Dockerfile instala `chromium` + fonts + `PUPPETEER_EXECUTABLE_PATH`.

Antes era DOCX. Cambiado porque PDF garantiza tipografía y layout consistente sin depender del editor del cliente.

---

## Estructura del proyecto

```
fiscal-webapp/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/        ← Auth.js handler
│   │   ├── chat/                       ← SSE streaming Claude
│   │   ├── corpus/search/              ← vector search Qdrant
│   │   ├── documents/                  ← upload registry
│   │   ├── documents/[id]/             ← GET descarga + DELETE
│   │   ├── health/                     ← multi-service healthcheck
│   │   ├── sintesis/                   ← generar
│   │   ├── sintesis/[id]/              ← DELETE
│   │   ├── sintesis/[id]/export/       ← PDF Puppeteer
│   │   ├── upload/direct/              ← raw body → MinIO (USAR ESTE)
│   │   └── upload/presigned/           ← deprecado, no usar
│   ├── dashboard/                      ← protegido por middleware
│   ├── login/                          ← credentials + magic link
│   ├── error.tsx, not-found.tsx, layout.tsx, page.tsx
│
├── auth.config.ts                      ← edge-safe (middleware)
├── middleware.ts                       ← protege rutas no-públicas
│
├── lib/
│   ├── auth.ts                         ← Node con PrismaAdapter
│   ├── prisma.ts                       ← singleton
│   ├── llm/
│   │   ├── claude.ts                   ← Anthropic SDK + streaming
│   │   ├── deepseek.ts                 ← OpenAI-compatible
│   │   ├── index.ts                    ← getLLM(tier) router
│   │   ├── system-prompt.ts            ← fiscal-legal-mx prompt
│   │   └── types.ts
│   ├── embeddings.ts                   ← lazy init + embeddingsEnabled()
│   ├── qdrant.ts                       ← searchCorpus()
│   ├── rag.ts                          ← retrieveContext + inferFilters
│   ├── pdf.ts                          ← pdf-parse + detectFields regex
│   ├── ocr.ts                          ← cliente FastAPI worker
│   ├── s3.ts                           ← MinIO/S3 client + presigned + delete
│   ├── sintesis.ts                     ← orquestador 10 pasos
│   ├── export-pdf.ts                   ← Puppeteer + Montserrat
│   ├── export-docx.ts                  ← (alternativo, no usado activamente)
│   ├── strip-markdown.ts               ← helper anti-markdown
│   └── utils.ts                        ← formatMoney/Date/diasHabiles
│
├── components/
│   ├── ui/                             ← shadcn/ui custom (button, card, input, badge, separator)
│   ├── analizar-button.tsx
│   ├── chat.tsx                        ← SSE consumer + SintesisRender
│   ├── confirm-delete-button.tsx       ← modal confirmación
│   ├── corpus-search.tsx
│   ├── empty-state.tsx
│   ├── sidebar-nav.tsx                 ← active state
│   ├── sintesis-render.tsx             ← react-markdown con estilos Montserrat
│   └── upload-dropzone.tsx
│
├── prisma/
│   ├── schema.prisma                   ← User, Caso, Documento, Mensaje, Sintesis
│   ├── seed.ts                         ← admin desde SEED_ADMIN_EMAIL
│   └── migrations/20260515000000_init/
│
├── docker/
│   ├── Caddyfile                       ← DEPRECADO, no usado
│   ├── nginx-site.conf                 ← template para setup-nginx.sh
│   └── ocr/                            ← Python FastAPI Tesseract spa
│
├── scripts/
│   ├── vps-bootstrap.sh                ← idempotente, genera .env + valida + levanta stack
│   ├── setup-nginx.sh                  ← crea vhost + certbot
│   ├── fix-env.sh                      ← auto-repara .env (comillas, slashes, duplicados)
│   ├── deploy.sh                       ← rsync local → VPS
│   ├── backup.sh, restore.sh           ← Postgres + Qdrant + MinIO
│   ├── bootstrap-qdrant.ts             ← crea colección
│   ├── ingest-corpus.ts                ← chunking + embeddings
│   └── download-corpus.sh
│
├── Dockerfile                          ← multi-stage Next standalone + Chromium runtime
├── docker-compose.yml                  ← app+postgres+qdrant+minio+ocr (sin Caddy)
├── next.config.ts                      ← output:standalone, eslint ignore, body 25mb
├── eslint.config.mjs
├── tailwind.config.ts                  ← Montserrat sans + tokens semánticos
└── .env.example
```

---

## Convenciones de código

### TS estricto
- Sin `any` (usa `unknown` + narrow)
- `as unknown as Type` solo para cast Prisma JSON (`Prisma.InputJsonValue`)
- Server Components default, `"use client"` solo si necesita hooks/eventos

### Estilos
- Tailwind con tokens semánticos (`bg-card`, `text-muted-foreground`, `border-border`)
- **NO** hexadecimales en componentes — usa CSS vars en `globals.css`
- Tipografía: numbers con `.tabular`, headings `tracking-tight`
- Animaciones: `animate-fade-in`, `animate-slide-up`, `animate-scale-in` (definidas en tailwind.config)
- Respetar `prefers-reduced-motion` (ya en globals.css)

### Componentes
- Badge variants: `default`, `outline`, `primary`, `gold`, `destructive`, `success`, `muted`
- EmptyState para estados vacíos
- ConfirmDeleteButton para borrados (modal con backdrop)
- SintesisRender para markdown del LLM

### API endpoints
- Auth siempre primero: `const session = await auth()` + check `userId`
- Filtros por `userId` en todas las queries
- Zod validation en bodies
- Errores: `NextResponse.json({ error: "..." }, { status: 4xx })`
- `runtime = "nodejs"` explícito en routes que usan Prisma/SDK
- `dynamic = "force-dynamic"` si usa searchParams o session

### Prisma
- Migración: `npm run db:migrate -- --name descripcion`
- No queries N+1 — usa `include` o `select`
- JSON fields → cast con `as unknown as Prisma.InputJsonValue`

---

## Modelos de datos clave

```
User (USER | ADMIN)
  └─ Caso ──┬─ Documento (tipoDocumento enum, storageKey MinIO, textoExtraido cache)
            ├─ Mensaje (rol USER|ASSISTANT, modelo, tokens)
            └─ Sintesis (tipo EJECUTIVA|PROFUNDA|ESTRATEGIA_DEFENSA, datosEstructurados JSON)
```

`Caso.estadoProcesal` se llena automáticamente con `stripMarkdown()` desde la primera síntesis.

`Documento.textoExtraido` cachea el texto post pdf-parse/OCR para no re-procesar al re-analizar.

`Sintesis.datosEstructurados` es `SintesisEstructurada` (caso, estadoProcesal, adeudoTotal, actoImpugnado, defensaVigente, proximoPlazo, riesgoPrincipal, recomendacion, fundamentosClave[]...).

---

## Pipeline de síntesis (10 pasos, `lib/sintesis.ts`)

1. Cargar Caso + Documentos de Postgres
2. Por cada doc sin `textoExtraido`:
   - Descargar PDF de MinIO
   - `extractPdfText(buffer)` con pdf-parse
   - Si texto < 200 chars → OCR worker fallback
   - `detectFields()` regex (RFC, expediente, montos, fechas, artículos)
   - Persistir `textoExtraido` + `metadatos` JSON
3. Si TODOS los docs fallan → throw. Si solo algunos → log warning + continúa.
4. Consolidar texto con headers `--- TIPO · NOMBRE ---`
5. `inferFilters(textoConsolidado)` → heurística decide qué leyes buscar
6. `retrieveContext(...)` → embedding query + Qdrant top-8 con filtros (si OpenAI configurado, si no skip)
7. Construir userPrompt con: caso info + docs detectados + RAG context + tipo instruction
8. `llm.complete()` con system prompt fiscal-legal-mx
9. `parsearSintesis(markdown)` extrae bloque `CASO: ... RECOMENDACIÓN:` a estructura tipada
10. Persistir Sintesis + actualizar Caso (montoTotal, estadoProcesal cleaned, plazoProximo, RFC, expediente) solo si están vacíos

---

## Comandos útiles

### Local
```bash
npm install
docker compose up -d postgres qdrant minio ocr
cp .env.example .env.local && nano .env.local
npm run db:migrate
npm run dev          # http://localhost:3000
npm run build        # verificar build
DATABASE_URL="x" npx next build   # build offline para CI
```

### VPS
```bash
ssh root@31.220.109.7
cd /root/fiscal-webapp
git pull
docker compose build app
docker compose up -d app
docker compose logs app -f
curl http://127.0.0.1:3010/api/health | jq
```

### Deploy desde Mac
```bash
cd ~/Developer/fiscal-webapp
git add . && git commit -m "..." && git push
# luego en VPS: git pull + rebuild
```

### Corpus
```bash
# en VPS
docker compose exec app npm run corpus:download   # descarga 46 PDFs oficiales
docker compose exec app npm run corpus:ingest     # chunks + embeddings → Qdrant
```

### Backup
```bash
bash scripts/backup.sh         # crea backups/YYYY-MM-DD-HHMM/
bash scripts/restore.sh <dir>  # rollback
```

---

## Variables de entorno críticas

| Var | Función | Notas |
|---|---|---|
| `APP_DOMAIN` | Hostname puro | sin `https://`, sin `/` |
| `AUTH_URL` | URL Auth.js | con `https://`, sin `/` final |
| `AUTH_SECRET` | JWT signing | 32 bytes hex |
| `DATABASE_URL` | Postgres | auto-set por docker-compose |
| `ANTHROPIC_API_KEY` | Claude | **obligatorio** |
| `OPENAI_API_KEY` | Embeddings | opcional, sin esto RAG deshabilitado |
| `RESEND_API_KEY` | Magic links | opcional, sin esto magic link → docker logs |
| `AUTH_EMAIL_FROM` | Remitente | `onboarding@resend.dev` si dominio no verificado |
| `ALLOWED_EMAIL_DOMAINS` | CSV o vacío | filtra magic link |
| `SEED_ADMIN_EMAIL` | Admin inicial | seed script crea User con role ADMIN |
| `ADMIN_EMAIL` + `ADMIN_PASSWORD` | Login directo | credentials provider |
| `MEMBRETE_LINE_1` + `LINE_2` | PDF export | con comillas si tiene espacios |

### Reglas .env (importantes)
- Valores con espacios → **comillas dobles obligatorias**: `MEMBRETE_LINE_1="Tu Despacho"`
- Comments inline solo en líneas vacías o después de valor sin espacios
- Sin `#` dentro de valores sin comillas (bash interpreta como comment)
- `fix-env.sh` auto-detecta y repara los errores comunes

---

## Troubleshooting frecuente

### App no levanta
1. `docker compose logs app --tail=60` — buscar stack trace
2. `curl http://127.0.0.1:3010/api/health` — qué servicio falla
3. Si Prisma error → verifica `DATABASE_URL` y que `postgres` healthy
4. Si MinIO `UnknownError` → bucket no existe (healthcheck lo crea ahora)

### Build falla
1. `DATABASE_URL="x" npx next build` para reproducir local
2. Errores de tipo Prisma → verifica que migraste DB (`npm run db:migrate`)
3. Errors de import → ¿agregaste `"use client"` donde necesitabas?
4. ENOENT prisma WASM → falta `COPY node_modules` completo en Dockerfile

### Upload falla 500 / 413
- ≤25MB? — UI valida `maxSize: 25 * 1024 * 1024`
- NGINX `client_max_body_size 25M` debe estar en server block (no solo location)
- App usa raw body, NO FormData

### "Invalid PDF structure"
- PDF corrupto o truncado (verifica `tamanoBytes` vs original)
- `tail -c 30 archivo.pdf` debe terminar en `%%EOF`
- Pipeline tolera fallos: si un doc falla, sigue con los demás

### Síntesis muestra markdown raw
- Aplicar `stripMarkdown()` o `stripMarkdownShort()` antes de mostrar
- Texto LLM crudo va al renderer `<SintesisRender markdown={...}>`
- Texto en stats / cards → usar `stripMarkdown`

### Login no funciona
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` configurados en `.env`?
- Magic link: revisa `docker compose logs app | grep "MAGIC LINK"` (sin Resend)
- Resend configurado pero no llega → `AUTH_EMAIL_FROM` debe estar en dominio verificado o usar `onboarding@resend.dev`

---

## Lo que NO debes hacer

- ❌ Cambiar `session.strategy` de `"jwt"` a `"database"` (rompe middleware)
- ❌ Actualizar Prisma a 7.x sin migrar schema sintaxis
- ❌ Reactivar Caddy / exponer puertos 80/443 (choca con NGINX existente del VPS)
- ❌ Cambiar `/api/upload/direct` a `formData()` parsing (10MB limit)
- ❌ Cambiar Dockerfile a `COPY` selectivo de node_modules (rompe Prisma)
- ❌ Default LLM a DeepSeek/Kimi (datos confidenciales clientes)
- ❌ Agregar emojis en respuestas IA o UI (legal/fiscal serio)
- ❌ Hexadecimales en componentes (usa tokens CSS vars)
- ❌ Mostrar markdown raw en interfaz (siempre `stripMarkdown` o renderer)
- ❌ Modificar el `.env` en VPS sin `bash scripts/fix-env.sh` después
- ❌ Push directo a main sin probar `npx next build` local

---

## Lo que SÍ debes hacer

- ✅ Build local antes de push: `DATABASE_URL="x" npx next build`
- ✅ Probar UI en `Cmd+Shift+R` después de cada deploy (cache)
- ✅ Commits con conventional commits: `feat(area):`, `fix(area):`, `refactor:`
- ✅ Mensaje commit explica el **porqué**, no el **qué**
- ✅ Confirma con user antes de borrar/modificar config sensible
- ✅ Lee este archivo + el README + el archivo target antes de editar
- ✅ Si añades dependencia → justifica en commit + valida que funciona en build Docker (Alpine)
- ✅ Para cambios grandes → propone arquitectura primero, no implementes directo
- ✅ Tests manuales con curl/browser antes de declarar "listo"

---

## Contactos / acceso

- **Owner:** Fernando Trejo · `fernandotrejo@solucionesmaw.com`
- **GitHub user:** `fercho159-aq`
- **Hostinger VPS:** `srv1077453.hstgr.cloud`
- **Dominio:** `yaakob.com` (subdomain `fiscal.`)
- **Caso piloto:** Súper Servicio Bomberos S.A. de C.V. (RFC SSB0109103Y4, expediente TFJA 4380/24-06-04-1-OT)

---

## Tags

#agents-md #fiscal-webapp #briefing #convenciones
