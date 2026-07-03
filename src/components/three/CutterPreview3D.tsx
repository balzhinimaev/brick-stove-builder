import { Canvas } from "@react-three/fiber";
import { Edges, OrbitControls, Text } from "@react-three/drei";
import { COLORS } from "../../theme/colors";
import { brickBoxes, notchBox, type BrickBox } from "../../domain/geometry";
import type { CustomBrickSpec, PlacedBrick } from "../../domain/types";

/** Заготовка: целый кирпич 250×120×65 мм в ячейках (1 ячейка = 125 мм). */
const BLANK_W = 2;
const BLANK_D = 0.96;
const BRICK_H = 0.52;
const DIM = "#7a1f1f";

/**
 * Объёмное превью резака: полупрозрачный призрак заготовки, из него —
 * плотный результат с вырезом и посадочной полкой, размеры в мм.
 * Модель можно вращать мышью/пальцем.
 */
export default function CutterPreview3D({ spec }: { spec: CustomBrickSpec }) {
  const brick: PlacedBrick = { id: "cutter", row: 1, x: 0, y: 0, kind: "custom", orientation: "h", custom: spec };
  const boxes = brickBoxes(brick);
  const notch = notchBox(brick);
  // центрируем по заготовке, чтобы модель не «уезжала» при резах
  const cx = BLANK_W / 2;
  const cz = BLANK_D / 2;

  const boxMesh = (box: BrickBox, height: number, y0: number, color: string, key: string | number, opacity = 1) => (
    <mesh key={key} position={[(box.x1 + box.x2) / 2 - cx, y0 + height / 2, (box.y1 + box.y2) / 2 - cz]} castShadow receiveShadow>
      <boxGeometry args={[Math.max(0.02, box.x2 - box.x1), height, Math.max(0.02, box.y2 - box.y1)]} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0.02} transparent={opacity < 1} opacity={opacity} />
      <Edges color={COLORS.charcoal} threshold={20} />
    </mesh>
  );

  const notchLenMm = notch ? Math.round((notch.x2 - notch.x1) * 125) : 0;
  const notchWidMm = notch ? Math.round((notch.y2 - notch.y1) * 125) : 0;
  const label = (text: string, x: number, z: number, color: string = COLORS.charcoal, size = 0.11) => (
    <Text position={[x, 0.006, z]} rotation={[-Math.PI / 2, 0, 0]} fontSize={size} color={color} anchorX="center" anchorY="middle">
      {text}
    </Text>
  );

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [1.7, 1.6, 2.1], fov: 34 }}>
      <color attach="background" args={[COLORS.skyCream]} />
      <ambientLight intensity={1.25} />
      <directionalLight position={[3, 5, 4]} intensity={1.2} castShadow />
      <directionalLight position={[-4, 3, -3]} intensity={0.5} />

      {/* подложка-«верстак» */}
      <mesh position={[0, -0.035, 0]} receiveShadow>
        <boxGeometry args={[BLANK_W + 1.3, 0.06, BLANK_D + 1.3]} />
        <meshStandardMaterial color={COLORS.foundation} roughness={0.9} />
      </mesh>

      {/* призрак заготовки 250×120: видно, что отпиливается */}
      <mesh position={[0, BRICK_H / 2, 0]}>
        <boxGeometry args={[BLANK_W, BRICK_H, BLANK_D]} />
        <meshStandardMaterial color={COLORS.brickOrange} transparent opacity={0.1} depthWrite={false} />
        <Edges color={COLORS.charcoal} />
      </mesh>

      {/* результат: занятые боксы на полную высоту */}
      {boxes.map((box, index) => boxMesh(box, BRICK_H, 0, COLORS.customBrick, index))}
      {/* полка в вырезе */}
      {notch && spec.ledge !== false ? boxMesh(notch, BRICK_H * 0.5, 0, COLORS.cutBrick, "ledge") : null}

      {/* размеры, мм */}
      {label(`${Math.round(spec.w * 125)} мм`, spec.w / 2 - cx, BLANK_D - cz + 0.3)}
      {label(`${Math.round(spec.h * 125)} мм`, -cx - 0.32, spec.h / 2 - cz)}
      {notch ? label(`${notchLenMm}×${notchWidMm} мм`, (notch.x1 + notch.x2) / 2 - cx, (notch.y1 + notch.y2) / 2 - cz, DIM, 0.1) : null}

      <OrbitControls enablePan={false} minDistance={1.4} maxDistance={4.5} target={[0, BRICK_H / 2, 0]} />
    </Canvas>
  );
}
