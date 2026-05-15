import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";

const FONT = "Montserrat";

interface ExportInput {
  membreteLine1?: string;
  membreteLine2?: string;
  titulo: string;
  expediente?: string;
  rfc?: string;
  razonSocial?: string;
  autoridad?: string;
  fechaGeneracion: Date;
  modelo: string;
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

function dateFmt(d: Date): string {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(d);
}

export async function generarDocxSintesis(input: ExportInput): Promise<Buffer> {
  const children: Paragraph[] = [];

  if (input.membreteLine1) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: input.membreteLine1, bold: true, size: 22 })],
      })
    );
  }
  if (input.membreteLine2) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: input.membreteLine2, size: 18 })],
        spacing: { after: 300 },
      })
    );
  }

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "SÍNTESIS EJECUTIVA — ANÁLISIS FISCAL" })],
      spacing: { after: 300 },
    })
  );

  // Encabezado expediente
  children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Datos del expediente")] })
  );
  const datos: Array<[string, string | undefined]> = [
    ["Caso", input.titulo],
    ["Expediente", input.expediente],
    ["RFC", input.rfc],
    ["Razón social", input.razonSocial],
    ["Autoridad", input.autoridad],
    ["Fecha generación", dateFmt(input.fechaGeneracion)],
    ["Modelo", input.modelo],
  ];

  children.push(
    new Paragraph({
      children: [],
      spacing: { after: 200 },
    })
  );

  const tableDatos = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: datos
      .filter(([, v]) => v)
      .map(
        ([k, v]) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: k, bold: true })] })],
              }),
              new TableCell({
                width: { size: 70, type: WidthType.PERCENTAGE },
                children: [new Paragraph(v as string)],
              }),
            ],
          })
      ),
  });
  // Workaround: Table no es Paragraph. Document children acepta cualquiera.
  // Lo añadimos vía hack con cast en sección.

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun("Resumen ejecutivo")],
      spacing: { before: 300 },
    })
  );

  const kv: Array<[string, string | undefined]> = [
    ["Estado procesal", input.estadoProcesal],
    ["Adeudo total", input.adeudoTotal ? formatter.format(input.adeudoTotal) : undefined],
    ["Acto impugnado", input.actoImpugnado],
    ["Defensa vigente", input.defensaVigente],
    ["Próximo plazo", input.proximoPlazo],
    ["Riesgo principal", input.riesgoPrincipal],
    ["Recomendación", input.recomendacion],
  ];
  for (const [k, v] of kv) {
    if (!v) continue;
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${k}: `, bold: true }),
          new TextRun({
            text: v,
            color: k.includes("Riesgo") ? "C00000" : k.includes("Recomendación") ? "0F5132" : "000000",
          }),
        ],
        spacing: { after: 100 },
      })
    );
  }

  if (input.fundamentosClave.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Fundamentos clave")],
        spacing: { before: 300 },
      })
    );
    children.push(
      new Paragraph({
        children: [new TextRun(input.fundamentosClave.map((f) => `Art. ${f}`).join(" · "))],
      })
    );
  }

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun("Análisis completo")],
      spacing: { before: 300 },
    })
  );

  // Convertir markdown a párrafos: cada línea → párrafo. ### → heading.
  for (const line of input.contenidoMarkdown.split("\n")) {
    const trimmed = line.trimEnd();
    if (/^###\s+/.test(trimmed)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun(trimmed.replace(/^###\s+/, ""))],
        })
      );
    } else if (/^##\s+/.test(trimmed)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun(trimmed.replace(/^##\s+/, ""))],
        })
      );
    } else if (/^#\s+/.test(trimmed)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun(trimmed.replace(/^#\s+/, ""))],
        })
      );
    } else if (/^[-*]\s+/.test(trimmed)) {
      children.push(
        new Paragraph({
          children: [new TextRun(trimmed.replace(/^[-*]\s+/, "• "))],
          indent: { left: 360 },
        })
      );
    } else {
      children.push(new Paragraph(trimmed));
    }
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "— FIN DEL ANÁLISIS —",
          italics: true,
          color: "808080",
        }),
      ],
      spacing: { before: 400 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD", space: 4 },
      },
    })
  );

  const doc = new Document({
    creator: "fiscal-webapp",
    title: input.titulo,
    description: "Síntesis fiscal generada",
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22 },
        },
        heading1: { run: { font: FONT, size: 32, bold: true } },
        heading2: { run: { font: FONT, size: 28, bold: true } },
        heading3: { run: { font: FONT, size: 24, bold: true } },
        title: { run: { font: FONT, size: 36, bold: true } },
      },
    },
    sections: [
      {
        properties: {},
        children: [...children.slice(0, datos.length === 0 ? 1 : 3), tableDatos, ...children.slice(3)],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
