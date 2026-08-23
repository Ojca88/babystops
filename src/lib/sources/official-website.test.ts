import { describe, expect, test } from "vitest";
import { extractKeywordSignals } from "./official-website";

const NOW = new Date("2026-08-23T00:00:00Z");

describe("extractKeywordSignals", () => {
  test.each([
    ["Disponemos de trona para los más pequeños", "highchair"],
    ["Contamos con cambiador en los baños", "changing_table"],
    ["Ofrecemos menú infantil todos los días", "kids_menu"],
    ["Junto al restaurante hay un parque infantil", "outdoor_play_area"],
    ["Tenemos una zona infantil dentro del local", "indoor_play_area"],
    ["Fácil acceso para carritos sin escalones", "stroller_access"],
  ] as const)("detects %s -> %s", (text, featureType) => {
    const evidence = extractKeywordSignals(text, NOW);

    expect(evidence).toContainEqual(
      expect.objectContaining({ featureType, source: "OFFICIAL_WEBSITE", certainty: "explicit" }),
    );
  });

  test("is accent-insensitive", () => {
    const evidence = extractKeywordSignals("MENÚ INFANTIL disponible", NOW);

    expect(evidence).toContainEqual(expect.objectContaining({ featureType: "kids_menu" }));
  });

  test("plain text with no keywords produces no evidence", () => {
    expect(extractKeywordSignals("Bienvenidos a nuestro restaurante familiar", NOW)).toEqual([]);
  });

  test("can detect several signals in the same text", () => {
    const evidence = extractKeywordSignals("Tenemos trona y cambiador disponibles", NOW);

    expect(evidence).toHaveLength(2);
  });
});
