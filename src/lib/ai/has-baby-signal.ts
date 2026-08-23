// Pre-filtro barato antes de llamar al LLM — docs/baby-stops/03-fuentes-y-extraccion.md
const SIGNAL_WORDS = [
  "bebe",
  "bebes",
  "nino",
  "ninos",
  "nina",
  "ninas",
  "familia",
  "familias",
  "carrito",
  "cochecito",
  "trona",
  "cambiador",
  "panal",
  "biberon",
  "lactancia",
  "jugar",
  "parque",
  "zona infantil",
  "pequenos",
  "hijos",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function hasBabySignal(text: string): boolean {
  const normalized = normalize(text);
  return SIGNAL_WORDS.some((word) => normalized.includes(word));
}
