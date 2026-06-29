import { describe, expect, it } from "vitest";
import { clamp, PARAM_BOUNDS, PARAMETER_FIELDS, validateParameters } from "../parameters";
import { translations } from "../../i18n";
import type { Parameters } from "../types";

const t = (key: keyof typeof translations.ru) => translations.ru[key];

describe("clamp", () => {
  it("bounds values to the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
  it("falls back to min for NaN", () => {
    expect(clamp(Number.NaN, 3, 10)).toBe(3);
  });
});

describe("PARAM_BOUNDS", () => {
  it("covers every parameter field with sane min < max", () => {
    expect(PARAMETER_FIELDS).toEqual(["foundationWidth", "foundationLength", "foundationThickness", "roomHeight"]);
    for (const field of PARAMETER_FIELDS) {
      const bound = PARAM_BOUNDS[field];
      expect(bound.min).toBeLessThan(bound.max);
      expect(bound.step).toBeGreaterThan(0);
    }
  });
});

describe("validateParameters", () => {
  const base: Parameters = { foundationWidth: 120, foundationLength: 160, foundationThickness: 25, roomHeight: 260 };
  it("accepts a reasonable stove", () => {
    expect(validateParameters(base, t).ok).toBe(true);
  });
  it("rejects too-low usable height", () => {
    expect(validateParameters({ ...base, roomHeight: 200, foundationThickness: 25 }, t).ok).toBe(false);
  });
  it("rejects an over-stretched footprint", () => {
    expect(validateParameters({ ...base, foundationWidth: 70, foundationLength: 260 }, t).ok).toBe(false);
  });
});

describe("translations", () => {
  it("keeps en and lt complete relative to ru", () => {
    const ruKeys = Object.keys(translations.ru).sort();
    expect(Object.keys(translations.en).sort()).toEqual(ruKeys);
    expect(Object.keys(translations.lt).sort()).toEqual(ruKeys);
  });
});
