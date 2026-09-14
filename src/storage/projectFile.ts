import { profileXZError, damperGeometryError } from "../../shared/profileXZ.js";
import { solidPartsError } from "../../shared/solidParts.js";
import type { DraftSnapshot } from "../domain/editor";
import type { ReadyProject } from "../domain/types";

export const PROJECT_FILE_FORMAT = "stove-project-v1";
export const MAX_PROJECT_BYTES = 20 * 1024 * 1024;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, min = 0, max = 100000): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const text = (v: unknown, max = 500): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const kinds = new Set([
  "standard",
  "cut",
  "trim",
  "firebrick",
  "vent",
  "cleanout",
  "grate",
  "rebate",
  "plate",
  "damper",
  "custom"
]);

/** Validate, never repair/truncate an imported document. A failed import leaves work intact. */
export function validateSnapshot(value: unknown): asserts value is DraftSnapshot {
  const fail = (detail: string): never => {
    throw new Error(`Файл проекта: ${detail}`);
  };
  if (!record(value) || !record(value.parameters) || !record(value.rows)) fail("нет параметров или рядов");
  const d = value as Record<string, unknown> & { parameters: Record<string, unknown>; rows: Record<string, unknown> };
  for (const key of ["foundationWidth", "foundationLength", "foundationThickness", "roomHeight"])
    if (!finite(d.parameters[key], 1, 10000)) fail(`некорректный параметр ${key}`);
  if (!finite(d.rowCount, 1, 2000) || !Number.isInteger(d.rowCount)) fail("некорректное число рядов");
  const count = d.rowCount as number;
  if (!finite(d.currentRow, 1, count) || !Number.isInteger(d.currentRow)) fail("некорректный текущий ряд");
  if (!Array.isArray(d.lockedRows) || d.lockedRows.some((r) => !finite(r, 1, count) || !Number.isInteger(r)))
    fail("некорректные блокировки рядов");
  const ids = new Set<string>();
  for (const [key, row] of Object.entries(d.rows)) {
    const r = Number(key);
    if (!Number.isInteger(r) || r < 1 || r > count || String(r) !== key || !Array.isArray(row))
      fail("некорректный ряд");
    for (const item of row as unknown[]) {
      if (!record(item)) fail("некорректная деталь");
      const b = item as Record<string, unknown>;
      if (!text(b.id) || ids.has(b.id as string)) fail("пустой или повторный номер детали");
      ids.add(b.id as string);
      if (ids.size > 50000) fail("более 50 000 деталей");
      if (
        b.row !== r ||
        !finite(b.x, -1000, 10000) ||
        !finite(b.y, -1000, 10000) ||
        !kinds.has(String(b.kind)) ||
        !["h", "v"].includes(String(b.orientation))
      )
        fail(`некорректная деталь ${b.id}`);
      if (b.damperOpen !== undefined && !finite(b.damperOpen, 0, 1)) fail("некорректная задвижка");
      if (b.notchCorner !== undefined && !["nw", "ne", "sw", "se", "n", "e", "s", "w"].includes(String(b.notchCorner)))
        fail("некорректный угол выреза");
      if (b.custom !== undefined) {
        if (!record(b.custom)) fail("некорректная форма");
        const c = b.custom as Record<string, unknown>;
        if (
          typeof c.name !== "string" ||
          c.name.length > 500 ||
          !finite(c.w, 0.00001, 1000) ||
          !finite(c.h, 0.00001, 1000)
        )
          fail("некорректные размеры формы");
        for (const k of ["heightMm", "thicknessMm", "notchDepthMm", "damperFrameMm", "seatZMm"])
          if (c[k] !== undefined && !finite(c[k], k === "seatZMm" ? -10000 : 0, 100000))
            fail(`некорректный размер ${k}`);
        if (c.notch != null) {
          if (
            !record(c.notch) ||
            ["x1", "y1", "x2", "y2"].some((k) => !finite((c.notch as Record<string, unknown>)[k]))
          )
            fail("некорректный вырез");
          const p = c.notch as Record<string, number>;
          if (p.x1 >= p.x2 || p.y1 >= p.y2 || p.x2 > (c.w as number) || p.y2 > (c.h as number))
            fail("вырез за пределами детали");
        }
        if (c.material !== undefined && c.material !== "steel") fail("неизвестный материал");
        if (c.cutFrom !== undefined && !["standard", "cut", "firebrick"].includes(String(c.cutFrom)))
          fail("неизвестная заготовка");
        for (const k of ["flush", "ledge"])
          if (c[k] !== undefined && typeof c[k] !== "boolean") fail(`некорректное поле ${k}`);
        const error = profileXZError(c) || solidPartsError(c) || damperGeometryError(c);
        if (error) fail(error);
      } else if (b.kind === "custom") fail("у детали нет формы");
    }
  }
}

export type ProjectFile = {
  format: typeof PROJECT_FILE_FORMAT;
  title: string;
  revision: number;
  sourceId?: string;
  snapshot: DraftSnapshot;
};
export function parseProjectFile(raw: string): ProjectFile {
  if (new Blob([raw]).size > MAX_PROJECT_BYTES) throw new Error("Файл больше 20 МБ");
  const data: unknown = JSON.parse(raw);
  if (
    !record(data) ||
    data.format !== PROJECT_FILE_FORMAT ||
    !text(data.title, 200) ||
    !finite(data.revision, 1) ||
    !Number.isInteger(data.revision)
  )
    throw new Error("Нужен полный файл проекта stove-project-v1, а не отчёт раскладки или физики");
  validateSnapshot(data.snapshot);
  return {
    format: PROJECT_FILE_FORMAT,
    title: data.title,
    revision: data.revision,
    sourceId: text(data.sourceId) ? data.sourceId : undefined,
    snapshot: data.snapshot
  };
}

export function projectSnapshot(project: ReadyProject, currentRow = 1): DraftSnapshot {
  return {
    parameters: project.parameters,
    rows: project.rows,
    rowCount: project.rowCount,
    lockedRows: project.lockedRows,
    currentRow
  };
}

export function downloadFile(name: string, body: string, mime = "application/json") {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
