import type { DraftSnapshot } from "./editor";

/** Same-lineage document diff. No inference about R1↔R2 brick provenance or structural equivalence. */
export function compareDocuments(before: DraftSnapshot, after: DraftSnapshot) {
  const a = new Map(
    Object.values(before.rows)
      .flat()
      .map((b) => [b.id, b])
  );
  const b = new Map(
    Object.values(after.rows)
      .flat()
      .map((b) => [b.id, b])
  );
  const added: string[] = [],
    removed: string[] = [],
    moved: string[] = [],
    changed: string[] = [];
  for (const [id, part] of b) {
    const old = a.get(id);
    if (!old) {
      added.push(id);
      continue;
    }
    if (part.x !== old.x || part.y !== old.y || part.row !== old.row || part.orientation !== old.orientation)
      moved.push(id);
    if (
      part.kind !== old.kind ||
      part.notchCorner !== old.notchCorner ||
      part.damperOpen !== old.damperOpen ||
      JSON.stringify(part.custom) !== JSON.stringify(old.custom)
    )
      changed.push(id);
  }
  for (const id of a.keys()) if (!b.has(id)) removed.push(id);
  return {
    added,
    removed,
    moved,
    changed,
    parametersChanged: JSON.stringify(before.parameters) !== JSON.stringify(after.parameters),
    rowsChanged: before.rowCount !== after.rowCount
  };
}
