import { it, expect } from "vitest";
import { RUSSIAN_STOVE } from "../russianStove";
it("preserves the exact pre-integration Teplushka JSON", async () => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(RUSSIAN_STOVE)));
  const hash = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
  expect(hash).toBe("eff9e34b1865b4a4a22ea4a9a2692b07b43d4310fc6ed43e2857a2c512f4fb12");
  expect(RUSSIAN_STOVE.id).toBe("russian-stove-hob");
  expect(RUSSIAN_STOVE.rowCount).toBe(33);
  expect(Object.values(RUSSIAN_STOVE.rows).flat()).toHaveLength(2544);
});
