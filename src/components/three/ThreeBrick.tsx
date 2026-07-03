import { memo } from "react";
import { Text } from "@react-three/drei";
import { COLORS } from "../../theme/colors";
import { BRICK_LAYER_HEIGHT, BRICK_GAP } from "../../domain/constants";
import { brickBounds, brickBoxes, brickSizeFor, brickWorldGeometry, cellToWorld, footprintSizeOf, notchBox, type BrickBox } from "../../domain/geometry";
import { getToolColor } from "../../domain/tools";
import type { GridSpec, PlacedBrick } from "../../domain/types";

/** Размер в см: сотые показываются, когда они есть («19», «6,25», «8,5»). */
function fmtCm(cells: number): string {
  return (cells * 12.5).toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}

export const ThreeBrick = memo(function ThreeBrick({ grid, brick, currentRow, unit }: { grid: GridSpec; brick: PlacedBrick; currentRow: number; unit: string }) {
  if (brick.kind === "grate") return <ThreeGrate grid={grid} brick={brick} currentRow={currentRow} unit={unit} />;
  if (brick.kind === "rebate" || brick.kind === "custom") return <ThreeRebate grid={grid} brick={brick} currentRow={currentRow} />;
  if (brick.kind === "plate") return <ThreePlate grid={grid} brick={brick} currentRow={currentRow} />;
  if (brick.kind === "cleanout") return <ThreeDoor grid={grid} brick={brick} currentRow={currentRow} />;

  const geometry = brickWorldGeometry(brick, grid);
  const color = getToolColor(brick.kind);
  const isCurrent = brick.row === currentRow;
  const label = brick.kind === "vent" ? "V" : "";
  return (
    <group>
      <mesh position={geometry.position} castShadow receiveShadow><boxGeometry args={geometry.scale} /><meshStandardMaterial color={color} roughness={0.82} metalness={0.02} /></mesh>
      <mesh position={[geometry.position[0], geometry.position[1] + geometry.scale[1] / 2 + 0.006, geometry.position[2]]}><boxGeometry args={[geometry.scale[0] * 0.96, 0.01, geometry.scale[2] * 0.08]} /><meshBasicMaterial color={COLORS.mortar} transparent opacity={0.65} /></mesh>
      {isCurrent && <mesh position={[geometry.position[0], geometry.position[1] + geometry.scale[1] / 2 + 0.014, geometry.position[2]]}><boxGeometry args={[geometry.scale[0] + 0.035, 0.018, geometry.scale[2] + 0.035]} /><meshBasicMaterial color={COLORS.sage} transparent opacity={0.23} /></mesh>}
      {label && <Text position={[geometry.position[0], geometry.position[1] + geometry.scale[1] / 2 + 0.025, geometry.position[2]]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.28} color={COLORS.cream} anchorX="center" anchorY="middle">{label}</Text>}
      {/* измеритель: габарит кирпича текущего ряда в см (сотые после запятой) */}
      {isCurrent && (
        <Text position={[geometry.position[0], geometry.position[1] + geometry.scale[1] / 2 + 0.03, geometry.position[2] + footprintSizeOf(brick).h / 2 + 0.16]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.19} color={COLORS.sageDark} outlineWidth={0.012} outlineColor="#FFF7E8" anchorX="center" anchorY="middle">
          {`${fmtCm(footprintSizeOf(brick).w)}×${fmtCm(footprintSizeOf(brick).h)} см`}
        </Text>
      )}
    </group>
  );
});

/**
 * Кирпич с выбранной четвертью: Г-образное тело (два бокса на полную высоту
 * ряда) + посадочная полка в вырезе на ~45% высоты. На полку ложится колосник,
 * плита или кирпич следующего элемента — вырез в коллизиях свободен.
 */
export function ThreeRebate({ grid, brick, currentRow, opacity = 1 }: { grid: GridSpec; brick: PlacedBrick; currentRow: number; opacity?: number }) {
  const color = getToolColor(brick.kind);
  // глубина реза по высоте: из резака (notchDepthMm), для «четверти» — полвысоты
  const depthMm = brick.custom?.notchDepthMm ?? (brick.custom?.ledge === false ? 65 : 32.5);
  const ledgeFrac = Math.max(0, 1 - depthMm / 65);
  const outer = brickBounds(brick);
  const notch = notchBox(brick);
  const bounds = brickWorldGeometry(brick, grid);
  const isCurrent = brick.row === currentRow;
  const transparent = opacity < 1;

  // Растворный шов ужимает только ВНЕШНИЕ грани кирпича; внутренние границы
  // Г-частей остаются заподлицо — кирпич выглядит монолитом с вырезом,
  // а не двумя кирпичами рядом.
  const g = BRICK_GAP / 2;
  const shave = (box: BrickBox): BrickBox => ({
    x1: box.x1 + (box.x1 === outer.x1 ? g : 0),
    x2: box.x2 - (box.x2 === outer.x2 ? g : 0),
    y1: box.y1 + (box.y1 === outer.y1 ? g : 0),
    y2: box.y2 - (box.y2 === outer.y2 ? g : 0)
  });
  const boxMesh = (box: BrickBox, height: number, bottomY: number, meshColor: string, key: number | string) => {
    const center = cellToWorld((box.x1 + box.x2) / 2, (box.y1 + box.y2) / 2, grid);
    return (
      <mesh key={key} position={[center.x, bottomY + height / 2, center.z]} castShadow receiveShadow>
        <boxGeometry args={[Math.max(0.06, box.x2 - box.x1), height, Math.max(0.06, box.y2 - box.y1)]} />
        <meshStandardMaterial color={meshColor} roughness={0.85} metalness={0.02} transparent={transparent} opacity={opacity} />
      </mesh>
    );
  };
  const rowBottom = (brick.row - 1) * BRICK_LAYER_HEIGHT + BRICK_LAYER_HEIGHT * 0.04;
  const fullHeight = BRICK_LAYER_HEIGHT * 0.92;

  return (
    <group>
      {brickBoxes(brick).map((box, index) => boxMesh(shave(box), fullHeight, rowBottom, color, index))}
      {/* ступень среза в вырезе: высота = 65 мм минус глубина реза */}
      {notch && ledgeFrac > 0.03 ? boxMesh(shave(notch), fullHeight * ledgeFrac, rowBottom, COLORS.cutBrick, "ledge") : null}
      {isCurrent && !transparent && (
        <mesh position={[bounds.position[0], bounds.position[1] + bounds.scale[1] / 2 + 0.014, bounds.position[2]]}>
          <boxGeometry args={[bounds.scale[0] + 0.035, 0.018, bounds.scale[2] + 0.035]} />
          <meshBasicMaterial color={COLORS.sage} transparent opacity={0.23} />
        </mesh>
      )}
      {/* измерители: габарит в см и размер выреза (красным) */}
      {isCurrent && (
        <Text position={[bounds.position[0], rowBottom + fullHeight + 0.03, bounds.position[2] + (outer.y2 - outer.y1) / 2 + 0.16]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.19} color={COLORS.sageDark} outlineWidth={0.012} outlineColor="#FFF7E8" anchorX="center" anchorY="middle" fillOpacity={opacity >= 0.95 ? 1 : 0.6}>
          {`${fmtCm(outer.x2 - outer.x1)}×${fmtCm(outer.y2 - outer.y1)} см`}
        </Text>
      )}
      {isCurrent && notch && (
        <Text position={[cellToWorld((notch.x1 + notch.x2) / 2, (notch.y1 + notch.y2) / 2, grid).x, rowBottom + fullHeight + 0.03, cellToWorld((notch.x1 + notch.x2) / 2, (notch.y1 + notch.y2) / 2, grid).z]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.16} color="#9b2c2c" outlineWidth={0.01} outlineColor="#FFF7E8" anchorX="center" anchorY="middle" fillOpacity={opacity >= 0.95 ? 1 : 0.6}>
          {`${fmtCm(notch.x2 - notch.x1)}×${fmtCm(notch.y2 - notch.y1)}`}
        </Text>
      )}
    </group>
  );
}

/** ≈70 мм на ряд кладки (кирпич на плашку + шов). */
const MM_PER_COURSE = 70;

/**
 * Дверца (топочная/поддувальная/прочистная): чугунная рамка с полотном и
 * ручкой. Стоит вертикально от низа своего ряда на высоту heightMm — проём
 * поднимается через несколько рядов, как в реальной кладке.
 */
export function ThreeDoor({ grid, brick, currentRow, opacity = 1 }: { grid: GridSpec; brick: PlacedBrick; currentRow: number; opacity?: number }) {
  const geometry = brickWorldGeometry(brick, grid);
  const size = footprintSizeOf(brick);
  const heightMm = brick.custom?.heightMm ?? 140;
  const height = (heightMm / MM_PER_COURSE) * BRICK_LAYER_HEIGHT;
  const bottom = (brick.row - 1) * BRICK_LAYER_HEIGHT + BRICK_LAYER_HEIGHT * 0.04;
  const centerY = bottom + height / 2;
  const isCurrent = brick.row === currentRow;
  const transparent = opacity < 1;
  // полотно смотрит вдоль короткой стороны следа
  const alongX = size.w >= size.h;
  const frameW = alongX ? size.w - 0.08 : size.h * 0.42;
  const frameD = alongX ? size.h * 0.42 : size.w - 0.08;
  const mat = (color: string, metal = 0.5) => <meshStandardMaterial color={color} roughness={0.5} metalness={metal} transparent={transparent} opacity={opacity} />;

  return (
    <group>
      {/* рамка */}
      <mesh position={[geometry.position[0], centerY, geometry.position[2]]} castShadow receiveShadow>
        <boxGeometry args={[frameW, height, frameD]} />
        {mat("#2b2f33")}
      </mesh>
      {/* полотно дверцы чуть выступает */}
      <mesh position={[geometry.position[0], centerY, geometry.position[2]]} castShadow>
        <boxGeometry args={[frameW * 0.78, height * 0.78, frameD + 0.05]} />
        {mat("#3a4046", 0.6)}
      </mesh>
      {/* ручка */}
      <mesh position={[geometry.position[0] + (alongX ? frameW * 0.26 : 0), centerY - height * 0.05, geometry.position[2] + (alongX ? 0 : frameW * 0.26)]}>
        <boxGeometry args={alongX ? [0.1, 0.1, frameD + 0.14] : [frameD + 0.14, 0.1, 0.1]} />
        {mat("#15181a", 0.7)}
      </mesh>
      {isCurrent && !transparent && (
        <mesh position={[geometry.position[0], bottom + height + 0.02, geometry.position[2]]}>
          <boxGeometry args={[size.w + 0.05, 0.012, size.h + 0.05]} />
          <meshBasicMaterial color={COLORS.sage} transparent opacity={0.2} />
        </mesh>
      )}
      <Text position={[geometry.position[0], bottom + height + 0.06, geometry.position[2]]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.15} color={COLORS.sageDark} anchorX="center" anchorY="middle" fillOpacity={opacity >= 0.95 ? 1 : 0.55}>
        {`Дверца ${Math.round((alongX ? size.w : size.h) * 125)}×${heightMm} мм`}
      </Text>
    </group>
  );
}

/**
 * Варочная плита: тонкая чугунная панель заподлицо с верхом ряда, две
 * конфорки. Края визуально ложатся на полки четвертей соседних кирпичей.
 */
export function ThreePlate({ grid, brick, currentRow, opacity = 1 }: { grid: GridSpec; brick: PlacedBrick; currentRow: number; opacity?: number }) {
  const geometry = brickWorldGeometry(brick, grid);
  const size = footprintSizeOf(brick);
  const thicknessMm = brick.custom?.thicknessMm ?? 14;
  const flush = brick.custom?.flush === true;
  const plateHeight = (thicknessMm / 65) * BRICK_LAYER_HEIGHT * 0.92;
  const rowTopY = (brick.row - 0.5) * BRICK_LAYER_HEIGHT + (BRICK_LAYER_HEIGHT * 0.92) / 2;
  // «Заподлицо»: верх плиты = верх ряда (утоплена в вырезы кирпичей);
  // «Поверх»: лежит на ряду, кирпичи под ней не пересекают её объём.
  const plateY = flush ? rowTopY - plateHeight / 2 + 0.004 : rowTopY + plateHeight / 2 - 0.008;
  const topY = plateY + plateHeight / 2;
  const isCurrent = brick.row === currentRow;
  const transparent = opacity < 1;
  const longX = size.w >= size.h;
  const longSide = Math.max(size.w, size.h);
  // короткие плиты — одноконфорочные; конфорки вдоль длинной оси
  const twoBurners = longSide * 125 >= 550;
  const burnerOffset = longSide / 4;
  const burners: Array<[number, number]> = twoBurners
    ? longX
      ? [[-burnerOffset, 0], [burnerOffset, 0]]
      : [[0, -burnerOffset], [0, burnerOffset]]
    : [[0, 0]];
  const burnerR = Math.min(0.72, Math.min(size.w, size.h) * 0.27);

  return (
    <group>
      <mesh position={[geometry.position[0], plateY, geometry.position[2]]} castShadow receiveShadow>
        <boxGeometry args={[size.w - 0.06, plateHeight, size.h - 0.06]} />
        <meshStandardMaterial color={COLORS.plate} roughness={0.45} metalness={0.55} transparent={transparent} opacity={opacity} />
      </mesh>
      {burners.map(([dx, dz], index) => (
        <group key={index} position={[geometry.position[0] + dx, topY + 0.006, geometry.position[2] + dz]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[burnerR * 0.86, burnerR, 32]} />
            <meshStandardMaterial color="#1e2124" roughness={0.4} metalness={0.6} transparent={transparent} opacity={opacity} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[burnerR * 0.7, 32]} />
            <meshStandardMaterial color="#26292d" roughness={0.5} metalness={0.5} transparent={transparent} opacity={opacity} />
          </mesh>
        </group>
      ))}
      {isCurrent && !transparent && (
        <mesh position={[geometry.position[0], topY + 0.03, geometry.position[2]]}>
          <boxGeometry args={[size.w + 0.05, 0.012, size.h + 0.05]} />
          <meshBasicMaterial color={COLORS.sage} transparent opacity={0.18} />
        </mesh>
      )}
      <Text position={[geometry.position[0], topY + 0.05, geometry.position[2] + size.h / 2 - 0.35]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.16} color="#e6d7bd" anchorX="center" anchorY="middle" fillOpacity={opacity >= 0.95 ? 1 : 0.55}>
        {`Плита ${Math.round(size.w * 125)}×${Math.round(size.h * 125)}×${thicknessMm} мм${flush ? " · заподлицо" : ""}`}
      </Text>
    </group>
  );
}

export function ThreeGrate({ grid, brick, currentRow, opacity = 1, unit }: { grid: GridSpec; brick: PlacedBrick; currentRow: number; opacity?: number; unit: string }) {
  const geometry = brickWorldGeometry(brick, grid);
  const grateSize = brickSizeFor("grate", brick.orientation);
  // Grate should not inherit full brick mortar gaps; keep it almost flush with support cuts.
  const grateScaleX = Math.max(0.1, grateSize.w - BRICK_GAP * 0.12);
  const grateScaleZ = Math.max(0.1, grateSize.h - BRICK_GAP * 0.12);
  const grateHeight = BRICK_LAYER_HEIGHT * 0.22; // thinner cast-iron grate profile
  const supportTopY = (brick.row - 0.5) * BRICK_LAYER_HEIGHT + (BRICK_LAYER_HEIGHT * 0.92) / 2;
  const grateSeatEmbed = 0.004; // tiny embed removes "floating" seam
  const grateY = supportTopY + grateHeight / 2 - grateSeatEmbed;
  const isCurrent = brick.row === currentRow;
  const bars = 5;
  const longX = grateScaleX >= grateScaleZ;
  const span = longX ? grateScaleZ : grateScaleX;
  const barSize = span / (bars * 1.7);
  const gap = (span - barSize * bars) / Math.max(1, bars - 1);
  const supportRailHeight = Math.max(0.02, grateHeight * 0.58);
  const supportRailWidth = 0.12;
  const supportRailY = supportTopY - supportRailHeight / 2;
  const halfX = grateScaleX / 2;
  const halfZ = grateScaleZ / 2;
  const alongXCm = brick.orientation === "h" ? 38 : 25.2;
  const alongZCm = brick.orientation === "h" ? 25.2 : 38;
  const topLabelY = grateY + grateHeight / 2 + 0.035;
  const labelOpacity = opacity >= 0.95 ? 1 : 0.55;

  return (
    <group>
      {/* Brick seat rails: visual quarter-cut support where the grate rests. */}
      {longX ? (
        <>
          <mesh position={[geometry.position[0], supportRailY, geometry.position[2] - halfZ + supportRailWidth / 2]} castShadow receiveShadow>
            <boxGeometry args={[grateScaleX, supportRailHeight, supportRailWidth]} />
            <meshStandardMaterial color={COLORS.cutBrick} roughness={0.88} metalness={0.02} transparent opacity={Math.min(1, opacity * 0.96)} />
          </mesh>
          <mesh position={[geometry.position[0], supportRailY, geometry.position[2] + halfZ - supportRailWidth / 2]} castShadow receiveShadow>
            <boxGeometry args={[grateScaleX, supportRailHeight, supportRailWidth]} />
            <meshStandardMaterial color={COLORS.cutBrick} roughness={0.88} metalness={0.02} transparent opacity={Math.min(1, opacity * 0.96)} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[geometry.position[0] - halfX + supportRailWidth / 2, supportRailY, geometry.position[2]]} castShadow receiveShadow>
            <boxGeometry args={[supportRailWidth, supportRailHeight, grateScaleZ]} />
            <meshStandardMaterial color={COLORS.cutBrick} roughness={0.88} metalness={0.02} transparent opacity={Math.min(1, opacity * 0.96)} />
          </mesh>
          <mesh position={[geometry.position[0] + halfX - supportRailWidth / 2, supportRailY, geometry.position[2]]} castShadow receiveShadow>
            <boxGeometry args={[supportRailWidth, supportRailHeight, grateScaleZ]} />
            <meshStandardMaterial color={COLORS.cutBrick} roughness={0.88} metalness={0.02} transparent opacity={Math.min(1, opacity * 0.96)} />
          </mesh>
        </>
      )}

      {/* Corner chamfers to avoid the "floating rectangle" look. */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ].map(([sx, sz], i) => (
        <mesh
          key={`seat-corner-${i}`}
          position={[geometry.position[0] + sx * (halfX - 0.06), supportTopY - 0.012, geometry.position[2] + sz * (halfZ - 0.06)]}
          rotation={[0, Math.PI / 4, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.09, 0.024, 0.09]} />
          <meshStandardMaterial color={COLORS.cutBrick} roughness={0.9} metalness={0.02} transparent opacity={Math.min(1, opacity * 0.94)} />
        </mesh>
      ))}

      {Array.from({ length: bars }).map((_, i) => {
        const offset = -span / 2 + barSize / 2 + i * (barSize + gap);
        const position: [number, number, number] = longX
          ? [geometry.position[0], grateY, geometry.position[2] + offset]
          : [geometry.position[0] + offset, grateY, geometry.position[2]];
        const args: [number, number, number] = longX
          ? [grateScaleX, grateHeight, Math.max(0.04, barSize)]
          : [Math.max(0.04, barSize), grateHeight, grateScaleZ];
        return <mesh key={i} position={position} castShadow receiveShadow><boxGeometry args={args} /><meshStandardMaterial color={COLORS.grate} roughness={0.58} metalness={0.42} transparent opacity={opacity} /></mesh>;
      })}

      {isCurrent && <mesh position={[geometry.position[0], topLabelY + 0.002, geometry.position[2]]}><boxGeometry args={[grateScaleX + 0.05, 0.012, grateScaleZ + 0.05]} /><meshBasicMaterial color={COLORS.sage} transparent opacity={0.16} /></mesh>}
      <Text position={[geometry.position[0], topLabelY + 0.03, geometry.position[2]]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.16} color="#f4e3c4" anchorX="center" anchorY="middle" fillOpacity={labelOpacity}>РУ {brick.orientation === "h" ? "380×252×22 мм" : "252×380×22 мм"}</Text>

      <mesh position={[geometry.position[0], topLabelY, geometry.position[2] - grateScaleZ / 2 - 0.22]}>
        <boxGeometry args={[grateScaleX, 0.012, 0.018]} />
        <meshBasicMaterial color={COLORS.sageDark} transparent opacity={labelOpacity * 0.75} />
      </mesh>
      <Text position={[geometry.position[0], topLabelY + 0.012, geometry.position[2] - grateScaleZ / 2 - 0.32]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.14} color={COLORS.sageDark} anchorX="center" anchorY="middle" fillOpacity={labelOpacity}>{alongXCm.toLocaleString("ru-RU")} {unit}</Text>
      <mesh position={[geometry.position[0] - grateScaleX / 2 - 0.22, topLabelY, geometry.position[2]]}>
        <boxGeometry args={[0.018, 0.012, grateScaleZ]} />
        <meshBasicMaterial color={COLORS.sageDark} transparent opacity={labelOpacity * 0.75} />
      </mesh>
      <Text position={[geometry.position[0] - grateScaleX / 2 - 0.32, topLabelY + 0.012, geometry.position[2]]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} fontSize={0.14} color={COLORS.sageDark} anchorX="center" anchorY="middle" fillOpacity={labelOpacity}>{alongZCm.toLocaleString("ru-RU")} {unit}</Text>
    </group>
  );
}
