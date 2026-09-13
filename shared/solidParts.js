/** One physical, axis-aligned cut brick; never a group of disconnected offcuts. */
export function solidPartsError(spec) {
  const parts = spec?.solidParts;
  if (parts === undefined) return null;
  if (!Array.isArray(parts) || !parts.length || parts.length > 32) return "A cut brick needs 1–32 solid parts";
  if (!Number.isFinite(spec.w) || !Number.isFinite(spec.h) || spec.w <= 0 || spec.h <= 0)
    return "Invalid cut brick footprint";
  if (
    spec.profileXZ ||
    spec.notch ||
    spec.notchDepthMm != null ||
    spec.heightMm != null ||
    spec.thicknessMm != null ||
    spec.seatZMm != null ||
    spec.flush === true ||
    spec.material ||
    spec.damperPlane
  )
    return "Solid parts cannot also have a profile, notch, seat, hardware or material override";
  const eps = 1e-6;
  const keys = ["x1", "y1", "z1", "x2", "y2", "z2"];
  if (
    parts.some(
      (p) =>
        !p ||
        keys.some((k) => !Number.isFinite(p[k])) ||
        ["x", "y", "z"].some((k) => p[`${k}1`] < -eps || p[`${k}2`] - p[`${k}1`] <= eps)
    )
  )
    return "Invalid solid part coordinates";
  const bounds = ["x", "y", "z"].map((k) => [
    Math.min(...parts.map((p) => p[`${k}1`])),
    Math.max(...parts.map((p) => p[`${k}2`]))
  ]);
  if (
    Math.abs(bounds[0][0]) > eps ||
    Math.abs(bounds[1][0]) > eps ||
    Math.abs(bounds[0][1] - spec.w * 125) > eps ||
    Math.abs(bounds[1][1] - spec.h * 125) > eps
  )
    return "Solid parts must match the brick footprint";
  const dimensions = bounds.map(([a, b]) => b - a).sort((a, b) => a - b);
  if (dimensions.some((d, i) => d > [65, 120, 250][i] + eps)) return "Cut brick exceeds a 250×120×65 stock blank";
  const graph = parts.map(() => []);
  for (let i = 0; i < parts.length; i++)
    for (let j = i + 1; j < parts.length; j++) {
      const spans = ["x", "y", "z"].map(
        (k) => Math.min(parts[i][`${k}2`], parts[j][`${k}2`]) - Math.max(parts[i][`${k}1`], parts[j][`${k}1`])
      );
      if (spans.every((s) => s > eps)) return "Solid parts must not overlap";
      if (spans.filter((s) => Math.abs(s) <= eps).length === 1 && spans.filter((s) => s > eps).length === 2) {
        graph[i].push(j);
        graph[j].push(i);
      }
    }
  const seen = new Set([0]),
    queue = [0];
  for (let i = 0; i < queue.length; i++)
    for (const j of graph[queue[i]])
      if (!seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
  return seen.size === parts.length ? null : "Solid parts must form one face-connected brick";
}
