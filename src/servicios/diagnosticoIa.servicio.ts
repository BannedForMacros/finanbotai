import { config } from '../config';
import { bitacora } from '../utilitarios/bitacora';

export interface DiagnosticoIA {
  resumen_ejecutivo: string;
  analisis_rentabilidad: string;
  fortalezas: string[];
  areas_mejora: string[];
  recomendaciones_especificas: {
    compras: string[];
    ventas: string[];
    egresos: string[];
  };
  conclusion: string;
  score_financiero: number;
}

const safeNumber = (v: any, def = 0): number => {
  if (v === null || v === undefined) return def;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? def : n;
};
const safeArray = (v: any): any[] => (Array.isArray(v) ? v : []);

function construirPrompt(data: any): string {
  const ventasTotales = safeNumber(data?.utilidad_bruta?.ventas_totales_sin_igv);
  const costoVentas = safeNumber(data?.utilidad_bruta?.costo_ventas);
  const utilidadBruta = safeNumber(data?.utilidad_bruta?.utilidad_bruta);
  const margenBruto = safeNumber(data?.utilidad_bruta?.margen_bruto_porcentaje);
  const utilidadOperativa = safeNumber(data?.utilidad_operativa?.utilidad_operativa);
  const margenOperativo = safeNumber(data?.utilidad_operativa?.margen_operativo_porcentaje);
  const utilidadNeta = safeNumber(data?.utilidad_neta?.utilidad_neta);
  const margenNeto = safeNumber(data?.utilidad_neta?.margen_neto_porcentaje);
  const gastosAdm = safeNumber(data?.utilidad_neta?.gastos_administrativos);
  const gastosVen = safeNumber(data?.utilidad_neta?.gastos_ventas);
  const gastosFin = safeNumber(data?.utilidad_neta?.gastos_financieros);
  const gastosOper = safeNumber(data?.utilidad_operativa?.gastos_operativos);

  const totalCompras = safeArray(data?.detalles?.compras).length;
  const totalVentas = safeArray(data?.detalles?.ventas).length;
  const totalUsd = safeNumber(data?.resumen_monedas?.total_usd);
  const totalPen = safeNumber(data?.resumen_monedas?.total_pen);
  const tc = safeNumber(data?.resumen_monedas?.tipo_cambio_usado, 3.7);

  return `
Actua como un experto consultor financiero peruano especializado en comercio internacional, importaciones, exportaciones y gestion de egresos.

Analiza los siguientes datos financieros de un proyecto FinanBotAI y entrega un diagnostico:

PROYECTO:
- Nombre: ${data?.nombre_proyecto || 'Sin nombre'}
- ID: ${data?.proyecto_id || ''}

ESTADO DE RESULTADOS (USD):
- Ventas totales (sin IGV): $${ventasTotales.toFixed(2)}
- Costo de ventas: $${costoVentas.toFixed(2)}
- Utilidad bruta: $${utilidadBruta.toFixed(2)} (${margenBruto.toFixed(2)}%)
- Gastos operativos: $${gastosOper.toFixed(2)}
- Utilidad operativa: $${utilidadOperativa.toFixed(2)} (${margenOperativo.toFixed(2)}%)
- Gastos administrativos: $${gastosAdm.toFixed(2)}
- Gastos de ventas: $${gastosVen.toFixed(2)}
- Gastos financieros: $${gastosFin.toFixed(2)}
- Utilidad neta: $${utilidadNeta.toFixed(2)} (${margenNeto.toFixed(2)}%)

OPERACIONES:
- Compras internacionales y nacionales: ${totalCompras}
- Ventas internacionales y nacionales: ${totalVentas}

MULTI MONEDA:
- Total USD: $${totalUsd.toFixed(2)}
- Total PEN: S/${totalPen.toFixed(2)}
- Tipo de cambio referencia: ${tc.toFixed(4)}

Devuelve EXCLUSIVAMENTE un JSON con esta estructura exacta:

{
  "resumen_ejecutivo": "Resumen de hasta 150 palabras",
  "analisis_rentabilidad": "Analisis de margenes en hasta 200 palabras",
  "fortalezas": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
  "areas_mejora": ["area 1", "area 2", "area 3"],
  "recomendaciones_especificas": {
    "compras": ["recom 1", "recom 2"],
    "ventas": ["recom 1", "recom 2"],
    "egresos": ["recom 1", "recom 2"]
  },
  "conclusion": "Conclusion en hasta 100 palabras",
  "score_financiero": 7.5
}

CRITERIO DE SCORE (0 a 10):
- 9 a 10: excelente, margen neto mayor a 20 por ciento.
- 7 a 8.9: bueno, margen entre 15 y 20 por ciento.
- 5 a 6.9: moderado, margen entre 10 y 15 por ciento.
- 3 a 4.9: bajo, margen entre 5 y 10 por ciento.
- 0 a 2.9: critico, margen menor a 5 por ciento.

Responde solo con el JSON, sin texto adicional.
`;
}

export class DiagnosticoIaServicio {
  static async generarDiagnostico(data: any): Promise<DiagnosticoIA> {
    if (!config.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY no configurado en el servidor');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Datos de analisis invalidos');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;
    const prompt = construirPrompt(data);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
        ]
      })
    });

    if (!response.ok) {
      const detalle = await response.json().catch(() => ({}));
      bitacora.warn(`Gemini respondio estado ${response.status}`, detalle);
      throw new Error(`Gemini error ${response.status}`);
    }

    const result = (await response.json()) as any;
    if (!result.candidates?.length) {
      throw new Error('Gemini no devolvio candidatos');
    }
    const candidato = result.candidates[0];
    if (candidato.finishReason && candidato.finishReason !== 'STOP') {
      throw new Error(`Gemini bloqueo la respuesta: ${candidato.finishReason}`);
    }
    const texto: string = candidato?.content?.parts?.[0]?.text || '';
    if (!texto) throw new Error('Respuesta vacia de Gemini');

    let jsonStr = texto;
    const m1 = texto.match(/\{[\s\S]*\}/);
    if (m1) {
      jsonStr = m1[0];
    } else {
      const limpio = texto.replace(/```json|```|`/g, '');
      const m2 = limpio.match(/\{[\s\S]*\}/);
      if (m2) jsonStr = m2[0];
    }

    const parsed: DiagnosticoIA = JSON.parse(jsonStr);
    const requeridos: Array<keyof DiagnosticoIA> = [
      'resumen_ejecutivo', 'analisis_rentabilidad', 'fortalezas',
      'areas_mejora', 'recomendaciones_especificas', 'conclusion', 'score_financiero'
    ];
    const faltantes = requeridos.filter((f) => !(parsed as any)[f]);
    if (faltantes.length > 0) {
      throw new Error(`Campos faltantes en la respuesta IA: ${faltantes.join(', ')}`);
    }
    if (typeof parsed.score_financiero !== 'number') {
      parsed.score_financiero = parseFloat((parsed.score_financiero as any) || '0') || 0;
    }
    parsed.score_financiero = Math.max(0, Math.min(10, parsed.score_financiero));
    return parsed;
  }
}
