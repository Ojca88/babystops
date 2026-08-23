import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { BABY_FEATURE_TYPES } from "@/lib/domain/types";
import type { FeatureExtractionResult } from "./map-extraction-to-evidence";

const ExtractionSchema = z.object({
  features: z.array(
    z.object({
      featureType: z.enum(BABY_FEATURE_TYPES),
      value: z.enum(["yes", "no", "limited"]),
      evidenceQuote: z.string(),
      confidence: z.enum(["explicit", "implied"]),
    }),
  ),
});

const SYSTEM_PROMPT = `Extraes señales objetivas sobre características para bebés a partir de texto (reseñas o el contenido de una web oficial).

Reglas:
- Solo reportas lo que el texto afirma explícitamente o implica con claridad.
- Si el texto no menciona una característica, no la incluyas — la ausencia de mención NO es evidencia de ausencia del servicio.
- "confidence: explicit" solo si el texto lo dice literalmente (p.ej. "nos dieron una trona").
- "confidence: implied" si se infiere razonablemente pero no se afirma literalmente (p.ej. "nos sentamos en la terraza con la niña" implica aceptación de niños, no lo dice explícitamente).
- "evidenceQuote" debe ser la frase exacta del texto de entrada que sustenta la extracción.`;

// Modelo económico (docs/baby-stops/03-fuentes-y-extraccion.md, 09-estimacion-costes.md):
// extracción estructurada de texto corto, alto volumen — Haiku 4.5 es la
// elección coste-eficiente para esta tarea concreta, no una recomendación
// general de modelo para el resto de la aplicación.
const MODEL = "claude-haiku-4-5";

export async function extractBabyFeatures(texts: string[]): Promise<FeatureExtractionResult[]> {
  if (texts.length === 0) return [];

  const client = new Anthropic();

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: texts.map((text, i) => `[Texto ${i + 1}]\n${text}`).join("\n\n"),
      },
    ],
    output_config: {
      format: zodOutputFormat(ExtractionSchema),
    },
  });

  return response.parsed_output?.features ?? [];
}
