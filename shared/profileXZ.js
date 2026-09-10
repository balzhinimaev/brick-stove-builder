/** Shared by the editor and strict Project/Draft schemas. Lengths are millimetres. */
export function profileXZError(spec) {
  if (spec?.material !== undefined && spec.material !== "steel") return "Unsupported custom solid material";
  const profile = spec?.profileXZ;
  if (profile === undefined) return null;
  if (!Array.isArray(profile) || profile.length < 3 || profile.length > 32)
    return "A convex profile needs 3–32 vertices";
  if (!Number.isFinite(spec.w) || spec.w <= 0 || !Number.isFinite(spec.h) || spec.h <= 0)
    return "Invalid prism footprint";
  if (
    spec.notch ||
    spec.notchDepthMm != null ||
    spec.heightMm != null ||
    spec.thicknessMm != null ||
    spec.seatZMm != null ||
    spec.flush === true
  )
    return "A vertical profile cannot also have a seat, notch or height override";
  if (profile.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.z)))
    return "Profile coordinates must be finite";
  const eps = 1e-6;
  const minX = Math.min(...profile.map((p) => p.x));
  const maxX = Math.max(...profile.map((p) => p.x));
  const minZ = Math.min(...profile.map((p) => p.z));
  const maxZ = Math.max(...profile.map((p) => p.z));
  if (Math.abs(minX) > eps || Math.abs(maxX - spec.w * 125) > eps || minZ < 0 || maxZ - minZ <= eps)
    return "Profile bounds must match w × 125 mm and lie above the course baseline";
  let winding = 0;
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i];
    const b = profile[(i + 1) % profile.length];
    for (let j = 0; j < profile.length; j++) {
      if (j === i || j === (i + 1) % profile.length) continue;
      const p = profile[j];
      const cross = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
      if (Math.abs(cross) <= eps) return "Profile edges must form a strictly convex polygon";
      if (!winding) winding = Math.sign(cross);
      if (Math.sign(cross) !== winding) return "Profile must be convex and non-self-intersecting";
    }
  }
  return null;
}

/** Vertical mouth plates use actual thin plan dimensions, not a 125 mm door placeholder. */
export function damperGeometryError(spec) {
  if (spec?.damperPlane === undefined && spec?.damperSlide === undefined && spec?.damperFrameMm === undefined)
    return null;
  const plane = spec.damperPlane ?? "horizontal";
  if (plane !== "horizontal" && plane !== "vertical") return "Invalid damper plane";
  if (!Number.isFinite(spec.w) || spec.w <= 0 || !Number.isFinite(spec.h) || spec.h <= 0)
    return "Invalid damper footprint";
  if (spec.profileXZ || spec.notch) return "A damper cannot use a masonry profile or notch";
  if (spec.seatZMm != null && (!Number.isFinite(spec.seatZMm) || spec.seatZMm < 0)) return "Invalid damper elevation";
  if (spec.thicknessMm != null && (!Number.isFinite(spec.thicknessMm) || spec.thicknessMm <= 0))
    return "Invalid damper thickness";
  if (plane === "vertical" && (!Number.isFinite(spec.heightMm) || spec.heightMm <= 0))
    return "A vertical damper needs a positive heightMm";
  const allowed = ["up", "x-positive", "x-negative", "y-positive", "y-negative"];
  if (spec.damperSlide != null && !allowed.includes(spec.damperSlide)) return "Invalid damper slide direction";
  if (plane === "horizontal" && spec.damperSlide != null && spec.damperSlide !== "x-positive")
    return "Horizontal dampers slide along local +X";
  if (plane === "vertical" && spec.damperSlide != null && spec.damperSlide !== "up") {
    const broadAxis = spec.w >= spec.h ? "x" : "y";
    if (!spec.damperSlide.startsWith(broadAxis)) return "Vertical side slide must follow the broad plan dimension";
  }
  if (spec.damperFrameMm != null) {
    const span =
      plane === "vertical" ? Math.min(Math.max(spec.w, spec.h) * 125, spec.heightMm) : Math.min(spec.w, spec.h) * 125;
    if (!Number.isFinite(spec.damperFrameMm) || spec.damperFrameMm < 0 || 2 * spec.damperFrameMm >= span)
      return "Damper rim must leave a positive clear aperture";
  }
  return null;
}
