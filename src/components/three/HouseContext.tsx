import { Html } from "@react-three/drei";
import { HOUSE_DESIGN } from "../../domain/houseRussianDesign";
import type { GridSpec } from "../../domain/types";

function Block({
  x,
  y,
  z,
  w,
  d,
  h,
  color,
  opacity = 1,
  wire = false
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  opacity?: number;
  wire?: boolean;
}) {
  return (
    <mesh position={[x / 125, z / 125, y / 125]}>
      <boxGeometry args={[w / 125, h / 125, d / 125]} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity === 1}
        wireframe={wire}
        roughness={0.9}
      />
    </mesh>
  );
}
function Label({ x = 0, y = 0, z, children }: { x?: number; y?: number; z: number; children: string }) {
  return (
    <Html center position={[x / 125, z / 125, y / 125]} style={{ pointerEvents: "none" }}>
      <span
        style={{
          display: "block",
          background: "#fff9edeb",
          border: "1px solid #8e7761",
          borderRadius: 6,
          padding: "3px 6px",
          whiteSpace: "nowrap",
          fontSize: 11,
          color: "#30281e"
        }}
      >
        {children}
      </span>
    </Html>
  );
}
/** Render-only assumed building context. Never adds invisible bricks to the
 * order, the undo stack or BOM. The model's own concrete cap remains visible. */
export function HouseContext({ grid }: { grid: GridSpec }) {
  const cx = 375 - (grid.cols * 125) / 2,
    cy = 585 - (grid.rows * 125) / 2;
  const gapX = (HOUSE_DESIGN.shaftWidthMm + 2 * HOUSE_DESIGN.penetrationGapMm) / 2;
  const gapY = (HOUSE_DESIGN.shaftDepthMm + 2 * HOUSE_DESIGN.penetrationGapMm) / 2;
  const left = cx - gapX,
    right = cx + gapX,
    front = cy - gapY,
    back = cy + gapY;
  const pitch = (HOUSE_DESIGN.roofPitchDeg * Math.PI) / 180;
  return (
    <group name="assumed-house-6x9-view-only">
      {[
        [-2025, 0, 1950, 9000],
        [2025, 0, 1950, 9000],
        [0, -2837.5, 2100, 3325],
        [0, 2837.5, 2100, 3325]
      ].map(([x, y, w, d]) => (
        <Block key={`${x}-${y}`} x={x} y={y} z={-50} w={w} d={d} h={100} color="#bdab8a" opacity={0.45} />
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Block x={s * 3125} y={0} z={1250} w={250} d={9500} h={2500} color="#976640" opacity={0.14} />
          <Block x={0} y={s * 4625} z={1250} w={6000} d={250} h={2500} color="#976640" opacity={0.14} />
          {[-2300, 2300].map((y) => (
            <Block key={y} x={s * 3125} y={y} z={1450} w={255} d={1600} h={1250} color="#326f8b" wire />
          ))}
          <mesh position={[(s * 1500) / 125, (2800 + 1500 * Math.tan(pitch)) / 125, 0]} rotation={[0, 0, -s * pitch]}>
            <boxGeometry args={[3000 / Math.cos(pitch) / 125, 30 / 125, 9500 / 125]} />
            <meshBasicMaterial color="#737974" wireframe />
          </mesh>
        </group>
      ))}
      <Block x={1500} y={-4625} z={1000} w={1000} d={255} h={2000} color="#805733" wire />
      {/* Ceiling panels stop at the complete exclusion boundary measured from the internal flue. */}
      {[
        [(-3000 + left) / 2, 0, left + 3000, 9000],
        [(right + 3000) / 2, 0, 3000 - right, 9000],
        [cx, (-4500 + front) / 2, right - left, front + 4500],
        [cx, (back + 4500) / 2, right - left, 4500 - back]
      ].map(([x, y, w, d]) => (
        <Block key={`${x}-${y}`} x={x} y={y} z={2525} w={w} d={d} h={50} color="#d0ac70" opacity={0.1} wire />
      ))}
      <Block x={cx} y={cy} z={2650} w={1260} d={1380} h={500} color="#b64e31" wire />
      <Block x={0} y={0} z={-1100} w={1900} d={2200} h={1500} color="#a8aca7" opacity={0.75} />
      <Block x={0} y={0} z={-2025} w={2000} d={2300} h={350} color="#8b918b" />
      <Label y={-4300} z={80}>
        6×9 м внутри · 54 м² · вход
      </Label>
      <Label x={1900} y={3000} z={120}>
        Спальная зона · без закрытой перегородки
      </Label>
      <Label x={-1900} y={-2500} z={120}>
        Общая комната / кухня
      </Label>
      <Label x={cx} y={cy} z={2950}>
        Зона разделки 1,26×1,38 м · без горючей засыпки
      </Label>
      <Label x={2200} y={0} z={2500}>
        Деревянный потолок +2,500
      </Label>
      <Label x={0} y={0} z={-2200}>
        Подошва −2,200 · расчётный грунт, не обследованный
      </Label>
      <Label x={cx} y={cy} z={6320}>
        Оголовок +6,225
      </Label>
    </group>
  );
}
