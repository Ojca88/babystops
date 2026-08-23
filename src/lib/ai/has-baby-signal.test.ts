import { describe, expect, test } from "vitest";
import { hasBabySignal } from "./has-baby-signal";

describe("hasBabySignal", () => {
  test.each([
    "Fuimos con nuestra niña de 10 meses y nos pusieron una trona.",
    "Tienen cambiador en el baño familiar.",
    "Perfecto para ir con carrito, sin escalones.",
    "Muy buen ambiente para familias con bebés.",
  ])("detects a signal in: %s", (text) => {
    expect(hasBabySignal(text)).toBe(true);
  });

  test.each([
    "La comida estaba fría y el servicio fue lento.",
    "Buena relación calidad-precio, volveremos.",
    "",
  ])("finds no signal in: %s", (text) => {
    expect(hasBabySignal(text)).toBe(false);
  });

  test("is case-insensitive and accent-insensitive", () => {
    expect(hasBabySignal("EXCELENTE ZONA INFANTIL")).toBe(true);
    expect(hasBabySignal("tienen biberón disponible")).toBe(true);
  });
});
