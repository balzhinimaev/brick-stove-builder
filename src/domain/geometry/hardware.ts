import { damperGeometryError } from "../../../shared/profileXZ.js";
import { MM_PER_CELL } from "../constants";
import type { BrickFootprint, PlacedBrick } from "../types";
import { footprintSizeOf, type BrickBox } from "./bounds";
import type { BrickSolid } from "./collisions";

export { damperGeometryError };
export type HardwarePart = { solid: BrickSolid; role: "frame" | "blade" | "bar" };
type MovingHardware = BrickFootprint & Partial<Pick<PlacedBrick, "damperOpen">>;
const openFraction = (brick: MovingHardware) =>
  Math.max(
    0,
    Math.min(1, typeof brick.damperOpen === "number" && Number.isFinite(brick.damperOpen) ? brick.damperOpen : 0)
  );
const sizeMm = (brick: BrickFootprint) => {
  const size = footprintSizeOf({ ...brick, orientation: "h" });
  return { width: size.w * MM_PER_CELL, depth: size.h * MM_PER_CELL };
};

function localBox(brick: BrickFootprint, x1: number, y1: number, x2: number, y2: number): BrickBox {
  const { depth } = sizeMm(brick);
  const box = brick.orientation === "h" ? { x1, y1, x2, y2 } : { x1: depth - y2, y1: x1, x2: depth - y1, y2: x2 };
  return {
    x1: brick.x + box.x1 / MM_PER_CELL,
    y1: brick.y + box.y1 / MM_PER_CELL,
    x2: brick.x + box.x2 / MM_PER_CELL,
    y2: brick.y + box.y2 / MM_PER_CELL
  };
}

/** Fixed rim is outside the clear aperture. Small legacy parts use a proportional rim. */
export function damperFrameMm(brick: BrickFootprint): number {
  const { width, depth } = sizeMm(brick);
  return (
    brick.custom?.damperFrameMm ?? (brick.custom?.damperPlane === "vertical" ? 0 : Math.min(10, width / 4, depth / 4))
  );
}

export type DamperAperture = {
  box: BrickBox;
  z1: number;
  z2: number;
  widthMm: number;
  heightMm: number;
  openAreaMm2: number;
  fullAreaMm2: number;
};
/** Measured gate aperture; an intermediate slider value never means 'entire frame removed'. */
export function damperAperture(brick: MovingHardware): DamperAperture {
  const error = damperGeometryError(brick.custom);
  if (error) throw new Error(error);
  const { width, depth } = sizeMm(brick);
  const open = openFraction(brick);
  if (brick.custom?.damperPlane === "vertical") {
    const frame = verticalFrame(brick);
    const rim = damperFrameMm(brick);
    const clearTravel = frame.uLength - 2 * rim;
    const opening = frame.solid(rim, rim, rim + clearTravel * open, frame.vLength - rim, 0, frame.thickness);
    const widthMm = Math.max(width, depth) - 2 * rim;
    const heightMm = frame.height - 2 * rim;
    return {
      box: opening.box,
      z1: opening.z1,
      z2: opening.z2,
      widthMm,
      heightMm,
      openAreaMm2: widthMm * heightMm * open,
      fullAreaMm2: widthMm * heightMm
    };
  }
  const rim = damperFrameMm(brick);
  const widthMm = width - 2 * rim;
  const heightMm = depth - 2 * rim;
  const seat = brick.custom?.seatZMm ?? 65;
  return {
    box: localBox(brick, rim, rim, rim + widthMm * open, depth - rim),
    z1: seat,
    z2: seat + (brick.custom?.thicknessMm ?? 20),
    widthMm,
    heightMm,
    openAreaMm2: widthMm * heightMm * open,
    fullAreaMm2: widthMm * heightMm
  };
}

/** Actual moving plate + retained slotted frame. All dimensions and solids also drive rendering. */
export function damperParts(brick: MovingHardware): HardwarePart[] {
  const error = damperGeometryError(brick.custom);
  if (error) throw new Error(error);
  const { width, depth } = sizeMm(brick);
  const open = openFraction(brick);
  if (brick.custom?.damperPlane === "vertical") return verticalDamperParts(brick);
  const rim = damperFrameMm(brick);
  const seat = brick.custom?.seatZMm ?? 65;
  const thickness = brick.custom?.thicknessMm ?? 20;
  const bladeThickness = Math.min(5, thickness * 0.35);
  const bladeBottom = seat + (thickness - bladeThickness) / 2;
  const bladeTop = bladeBottom + bladeThickness;
  const result: HardwarePart[] = [];
  const part = (role: HardwarePart["role"], x1: number, y1: number, x2: number, y2: number, z1: number, z2: number) => {
    if (x2 > x1 && y2 > y1 && z2 > z1) result.push({ role, solid: { box: localBox(brick, x1, y1, x2, y2), z1, z2 } });
  };
  part("frame", 0, 0, width, rim, seat, seat + thickness);
  part("frame", 0, depth - rim, width, depth, seat, seat + thickness);
  part("frame", 0, rim, rim, depth - rim, seat, seat + thickness);
  // The blade slides through this real slot. Upper/lower rails do not intersect it.
  part("frame", width - rim, rim, width, depth - rim, seat, bladeBottom);
  part("frame", width - rim, rim, width, depth - rim, bladeTop, seat + thickness);
  const travel = open * (width - 2 * rim);
  // Closed blade extends through the rim slot so that the slot cannot become an air shortcut.
  part("blade", rim + travel, rim, width + travel, depth - rim, bladeBottom, bladeTop);
  return result;
}

/** Grate bars are physical solids; air crosses real slots, not a deleted full plate. */
export function grateParts(brick: BrickFootprint): HardwarePart[] {
  const { width, depth } = sizeMm(brick);
  const thickness = brick.custom?.thicknessMm ?? 22;
  const seat = brick.custom?.seatZMm ?? 65 - thickness;
  const rim = Math.min(10, width / 4, depth / 4);
  const result: HardwarePart[] = [];
  const part = (role: HardwarePart["role"], x1: number, y1: number, x2: number, y2: number) =>
    result.push({ role, solid: { box: localBox(brick, x1, y1, x2, y2), z1: seat, z2: seat + thickness } });
  part("frame", 0, 0, width, rim);
  part("frame", 0, depth - rim, width, depth);
  part("frame", 0, rim, rim, depth - rim);
  part("frame", width - rim, rim, width, depth - rim);
  const apertureDepth = depth - 2 * rim;
  const barCount = Math.max(1, Math.floor(apertureDepth / 25));
  const pitch = apertureDepth / (barCount + 1);
  for (let i = 1; i <= barCount; i++) {
    const center = rim + i * pitch;
    part("bar", rim, center - pitch / 4, width - rim, center + pitch / 4);
  }
  return result;
}

/** Local frame: U follows the blade motion, V lies in its plane, N is sheet/frame thickness. */
function verticalFrame(brick: MovingHardware) {
  const { width, depth } = sizeMm(brick);
  const broadX = width >= depth;
  const wide = Math.max(width, depth);
  const thickness = Math.min(width, depth);
  const height = brick.custom?.heightMm;
  if (height === undefined || !Number.isFinite(height) || height <= 0)
    throw new Error("Vertical gate requires positive heightMm");
  const seat = brick.custom?.seatZMm ?? 0;
  const slide = brick.custom?.damperSlide ?? "up";
  const upward = slide === "up";
  const negative = slide.endsWith("negative");
  const uLength = upward ? height : wide;
  const vLength = upward ? wide : height;
  const solid = (u1: number, v1: number, u2: number, v2: number, n1: number, n2: number): BrickSolid => {
    const s1 = upward ? v1 : negative ? wide - u2 : u1;
    const s2 = upward ? v2 : negative ? wide - u1 : u2;
    return {
      box: broadX ? localBox(brick, s1, n1, s2, n2) : localBox(brick, n1, s1, n2, s2),
      z1: seat + (upward ? u1 : v1),
      z2: seat + (upward ? u2 : v2)
    };
  };
  return { uLength, vLength, thickness, height, solid };
}

function verticalDamperParts(brick: MovingHardware): HardwarePart[] {
  const { uLength, vLength, thickness, solid } = verticalFrame(brick);
  const rim = damperFrameMm(brick);
  const travel = openFraction(brick) * (uLength - 2 * rim);
  if (rim === 0) return [{ role: "blade", solid: solid(travel, 0, uLength + travel, vLength, 0, thickness) }];
  const bladeThickness = Math.min(5, thickness * 0.35);
  const bladeFront = (thickness - bladeThickness) / 2;
  const bladeBack = bladeFront + bladeThickness;
  return [
    { role: "frame", solid: solid(0, 0, uLength, rim, 0, thickness) },
    { role: "frame", solid: solid(0, vLength - rim, uLength, vLength, 0, thickness) },
    { role: "frame", solid: solid(0, rim, rim, vLength - rim, 0, thickness) },
    { role: "frame", solid: solid(uLength - rim, rim, uLength, vLength - rim, 0, bladeFront) },
    { role: "frame", solid: solid(uLength - rim, rim, uLength, vLength - rim, bladeBack, thickness) },
    { role: "blade", solid: solid(rim + travel, rim, uLength + travel, vLength - rim, bladeFront, bladeBack) }
  ];
}
