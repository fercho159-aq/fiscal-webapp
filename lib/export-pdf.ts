import puppeteer from "puppeteer";

export interface PdfExportInput {
  membreteLine1?: string;
  membreteLine2?: string;
  titulo: string;
  expediente?: string;
  rfc?: string;
  razonSocial?: string;
  autoridad?: string;
  fechaGeneracion: Date;
  modelo: string;
  tipoSintesis: string;
  adeudoTotal?: number;
  estadoProcesal?: string;
  actoImpugnado?: string;
  defensaVigente?: string;
  proximoPlazo?: string;
  riesgoPrincipal?: string;
  recomendacion?: string;
  fundamentosClave: string[];
  contenidoMarkdown: string;
}

const formatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const dateFormatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "long" });

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Conversión muy básica de Markdown a HTML.
 * Para producción usar marked o remark, pero esto cubre lo que genera Claude.
 */
function markdownToHtml(md: string): string {
  let html = md;

  // Tablas GFM
  html = html.replace(
    /^\|(.+)\|\s*\n\|([\s|:-]+)\|\s*\n((?:\|.*\|\s*\n?)*)/gm,
    (_match, header: string, _sep: string, body: string) => {
      const headers = header.split("|").map((h) => h.trim()).filter((h) => h.length > 0);
      const rows = body.trim().split("\n").map((row) =>
        row.split("|").map((c) => c.trim()).filter((c, i, arr) => !(i === 0 && c === "") && !(i === arr.length - 1 && c === ""))
      );
      const thead = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>`;
      return `<table>${thead}${tbody}</table>`;
    }
  );

  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/^---$/gm, "<hr>");
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  // Listas
  html = html.replace(/(?:^[-*] .+(?:\n|$))+/gm, (block) => {
    const items = block.trim().split("\n").map((line) => line.replace(/^[-*] /, ""));
    return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
  });

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+?)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Párrafos: bloques separados por doble newline que NO son ya HTML
  html = html
    .split(/\n\n+/)
    .map((block) => {
      const t = block.trim();
      if (!t) return "";
      if (/^<(h[1-6]|ul|ol|table|blockquote|hr|p)/.test(t)) return t;
      return `<p>${t.replace(/\n/g, " ")}</p>`;
    })
    .join("\n");

  return html;
}

function buildHtml(input: PdfExportInput): string {
  const fundamentos = input.fundamentosClave.length > 0
    ? `<div class="kv-row"><span class="kv-label">Fundamentos clave</span><span class="kv-value">${input.fundamentosClave.map((f) => `<code>Art. ${escapeHtml(f)}</code>`).join(" ")}</span></div>`
    : "";

  const datos = [
    ["Expediente", input.expediente],
    ["RFC", input.rfc],
    ["Razón social", input.razonSocial],
    ["Autoridad", input.autoridad],
    ["Fecha generación", dateFormatter.format(input.fechaGeneracion)],
    ["Modelo", input.modelo],
    ["Tipo análisis", input.tipoSintesis],
  ].filter(([, v]) => v).map(([k, v]) => `<tr><th>${escapeHtml(k as string)}</th><td>${escapeHtml(v as string)}</td></tr>`).join("");

  const resumen = [
    ["Adeudo total", input.adeudoTotal ? formatter.format(input.adeudoTotal) : null],
    ["Estado procesal", input.estadoProcesal],
    ["Acto impugnado", input.actoImpugnado],
    ["Defensa vigente", input.defensaVigente],
    ["Próximo plazo", input.proximoPlazo],
    ["Riesgo principal", input.riesgoPrincipal, "danger"],
    ["Recomendación", input.recomendacion, "primary"],
  ].filter((r) => r[1]).map((r) => {
    const [k, v, cls] = r as [string, string, string?];
    return `<div class="kv-row${cls ? ` kv-${cls}` : ""}"><span class="kv-label">${escapeHtml(k)}</span><span class="kv-value">${escapeHtml(v)}</span></div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(input.titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Montserrat", "Helvetica Neue", Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
  }
  .page { padding: 28mm 22mm; }
  .membrete {
    text-align: center;
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 12px;
    margin-bottom: 24px;
  }
  .membrete h1 { font-size: 12pt; font-weight: 700; margin: 0; letter-spacing: 0.5px; }
  .membrete p { font-size: 9pt; color: #555; margin: 4px 0 0; }
  h1.titulo {
    font-size: 18pt;
    font-weight: 700;
    margin: 0 0 4px;
    letter-spacing: -0.3px;
  }
  .subtitulo {
    text-transform: uppercase;
    font-size: 8pt;
    letter-spacing: 1.5px;
    color: #666;
    margin-bottom: 24px;
  }
  table.meta {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
    font-size: 9pt;
  }
  table.meta th, table.meta td {
    padding: 6px 10px;
    border: 1px solid #ddd;
    text-align: left;
    vertical-align: top;
  }
  table.meta th {
    background: #f5f5f5;
    font-weight: 600;
    width: 32%;
  }
  h2.section {
    font-size: 13pt;
    font-weight: 600;
    margin: 24px 0 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #ddd;
  }
  .kv-row {
    display: flex;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid #eee;
    font-size: 10pt;
  }
  .kv-row:last-child { border-bottom: none; }
  .kv-label {
    font-weight: 600;
    width: 30%;
    text-transform: uppercase;
    font-size: 8pt;
    letter-spacing: 0.8px;
    color: #666;
  }
  .kv-value { flex: 1; }
  .kv-danger .kv-value { color: #c00; font-weight: 600; }
  .kv-primary .kv-value { color: #0a5; font-weight: 600; }
  article.contenido {
    margin-top: 16px;
  }
  article.contenido h1 {
    font-size: 14pt;
    font-weight: 700;
    margin: 18px 0 8px;
    border-bottom: 1px solid #999;
    padding-bottom: 4px;
  }
  article.contenido h2 {
    font-size: 12pt;
    font-weight: 600;
    margin: 16px 0 6px;
  }
  article.contenido h3 {
    font-size: 10pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 14px 0 4px;
    color: #444;
  }
  article.contenido p { margin: 6px 0; }
  article.contenido ul, article.contenido ol { padding-left: 22px; margin: 6px 0; }
  article.contenido li { margin: 2px 0; }
  article.contenido strong { font-weight: 600; }
  article.contenido code {
    background: #f0f0f0;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: "Courier New", monospace;
    font-size: 9pt;
  }
  article.contenido blockquote {
    border-left: 3px solid #888;
    margin: 8px 0;
    padding: 4px 12px;
    background: #fafafa;
    font-style: italic;
    color: #444;
  }
  article.contenido hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
  article.contenido table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 9pt;
  }
  article.contenido table th, article.contenido table td {
    padding: 5px 8px;
    border: 1px solid #ccc;
    text-align: left;
  }
  article.contenido table th { background: #f0f0f0; font-weight: 600; }
  footer.pie {
    margin-top: 24px;
    padding-top: 10px;
    border-top: 1px solid #ddd;
    font-size: 8pt;
    color: #999;
    text-align: center;
  }
  @page { margin: 0; size: letter; }
</style>
</head>
<body>
<div class="page">
  ${input.membreteLine1 ? `<div class="membrete"><h1>${escapeHtml(input.membreteLine1)}</h1>${input.membreteLine2 ? `<p>${escapeHtml(input.membreteLine2)}</p>` : ""}</div>` : ""}
  <div class="subtitulo">${escapeHtml(input.tipoSintesis)}</div>
  <h1 class="titulo">${escapeHtml(input.titulo)}</h1>
  ${datos ? `<table class="meta">${datos}</table>` : ""}
  ${resumen ? `<h2 class="section">Resumen ejecutivo</h2><div class="kv-block">${resumen}</div>` : ""}
  ${fundamentos ? `<h2 class="section">Fundamentos</h2><div class="kv-block">${fundamentos}</div>` : ""}
  <h2 class="section">Análisis completo</h2>
  <article class="contenido">${markdownToHtml(input.contenidoMarkdown)}</article>
  <footer class="pie">Documento generado por fiscal-webapp · ${dateFormatter.format(input.fechaGeneracion)}</footer>
</div>
</body>
</html>`;
}

export async function generarPdfSintesis(input: PdfExportInput): Promise<Buffer> {
  const html = buildHtml(input);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60000 });
    // Espera explícita a que cargue Montserrat
    await page.evaluateHandle("document.fonts.ready");
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
