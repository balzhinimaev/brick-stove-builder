import { expect, it } from "vitest";
import { CLASSIC_RUSSIAN_STOVE } from "../../domain/classicRussianStove";
import {
  CLASSIC_ARCH_NAMES,
  archAddress,
  classicArchAssembly,
  archAssemblyFrame
} from "../builder/classicArchAssembly";

it("shows actual supports, then timber, symmetric bonded parts and locks without changing the document", () => {
  const rows = structuredClone(CLASSIC_RUSSIAN_STOVE.rows);
  const before = JSON.stringify(rows);
  const document = Object.values(rows).flat();
  for (const name of CLASSIC_ARCH_NAMES) {
    const assembly = classicArchAssembly(document, name)!;
    expect(assembly).not.toBeNull();
    expect(archAssemblyFrame(assembly, 0).centering).toBe(false);
    expect(archAssemblyFrame(assembly, 1).centering).toBe(true);
    expect(archAssemblyFrame(assembly, 1).parts.every((b) => !archAddress(b))).toBe(true);
    const count = Math.max(...assembly.wedges.map((b) => archAddress(b)!.radial));
    const seen = new Set<string>();
    let locks = false;
    for (let step = 0; step < assembly.steps.length; step++) {
      const frame = archAssemblyFrame(assembly, step);
      expect(frame.parts.every((b) => document.includes(b))).toBe(true);
      for (const b of frame.active) {
        expect(seen.has(b.id)).toBe(false);
        seen.add(b.id);
      }
      const wedges = frame.active.filter((b) => archAddress(b));
      if (!wedges.length) continue;
      const key = wedges.every((b) => archAddress(b)!.radial === (count + 1) / 2);
      if (key) {
        locks = true;
        expect(
          assembly.wedges.filter((b) => archAddress(b)!.radial !== (count + 1) / 2).every((b) => seen.has(b.id))
        ).toBe(true);
      } else {
        expect(locks).toBe(false);
        expect(wedges).toHaveLength(2);
        expect(archAddress(wedges[0])!.radial + archAddress(wedges[1])!.radial).toBe(count + 1);
      }
    }
    expect(assembly.wedges.every((b) => seen.has(b.id))).toBe(true);
    const dry = assembly.steps.length - 3;
    expect(archAssemblyFrame(assembly, dry).centering).toBe(true);
    expect(archAssemblyFrame(assembly, dry).active).toEqual([]);
    expect(archAssemblyFrame(assembly, dry).parts.filter((b) => archAddress(b))).toHaveLength(assembly.wedges.length);
    expect(archAssemblyFrame(assembly, dry + 1).centering).toBe(false);
    expect(archAssemblyFrame(assembly, dry + 1).parts).toEqual(archAssemblyFrame(assembly, dry).parts);
    expect(archAssemblyFrame(assembly, dry + 2).centering).toBe(false);
    expect(archAssemblyFrame(assembly, dry + 2).active.every((b) => b.custom?.name.endsWith("пята / пазуха"))).toBe(
      true
    );
    expect(new Set(assembly.numbers.values()).size).toBe(seen.size);
    // Scrubbing backward/forward is only a projection; no history/draft action.
    archAssemblyFrame(assembly, 2);
    archAssemblyFrame(assembly, 0);
    expect(JSON.stringify(rows)).toBe(before);
  }
});
it("does not present fixed-source centering for a deleted or moved wedge", () => {
  const document = Object.values(structuredClone(CLASSIC_RUSSIAN_STOVE.rows)).flat();
  const b = document.find((b) => archAddress(b)?.name === "Арка устья")!;
  b.x += 0.5;
  expect(classicArchAssembly(document, "Арка устья")).toBeNull();
  expect(
    classicArchAssembly(
      document.filter((part) => part !== b),
      "Арка устья"
    )
  ).toBeNull();
});
