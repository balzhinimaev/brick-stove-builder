import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  DataTexture,
  type InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  RGBAFormat
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { MM_PER_CELL } from "../../domain/constants";
import { brickBounds, brickPhysicalSolids, damperParts, footprintSizeOf, grateParts } from "../../domain/geometry";
import { isSteelPart } from "../../domain/materials";
import { plateBurnerCenters } from "../../domain/plate";
import type { GridSpec, PlacedBrick } from "../../domain/types";
import { brickAppearance, isMasonry } from "./brickAppearance";
import { profileSceneGeometry } from "./profileGeometry";
import { type SceneBox, solidBoxes, solidSceneBox } from "./sceneMath";

export { isMasonry } from "./brickAppearance";

const brickColor = (brick: PlacedBrick) => brickAppearance(brick).color;

/** Small, deterministic mineral bump field. No network texture or font dependency. */
function mineralTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  let seed = 12345;
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const v = 150 + (seed % 100);
    data.set([v, v, v, 255], i * 4);
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.needsUpdate = true;
  return texture;
}

type Instance = SceneBox & { color: Color; brickId?: string };

/** Two instanced draws for masonry and beds, independent of brick count. */
export const Masonry = memo(function Masonry({ bricks, grid }: { bricks: PlacedBrick[]; grid: GridSpec }) {
  const { bodies, beds } = useMemo(() => {
    const bodies: Instance[] = [];
    const beds: Instance[] = [];
    for (const brick of bricks.filter((b) => isMasonry(b) && !b.custom?.profileXZ && !b.custom?.solidParts)) {
      for (const box of solidBoxes(brick, grid)) bodies.push({ ...box, color: brickColor(brick), brickId: brick.id });
      // Beds follow the occupied shape, preserving shafts and through-cuts.
      if (brick.row > 1) {
        for (const box of solidBoxes(brick, grid, 0.008)) {
          const bottom = box.position[1] - box.scale[1] / 2;
          if (Math.abs(bottom - ((brick.row - 1) * 70) / MM_PER_CELL) > 0.001) continue;
          beds.push({
            position: [box.position[0], bottom - 2.5 / MM_PER_CELL, box.position[2]],
            scale: [box.scale[0], 5 / MM_PER_CELL, box.scale[2]],
            color: new Color("#a59b88")
          });
        }
      }
    }
    return { bodies, beds };
  }, [bricks, grid]);
  return (
    <>
      {bricks
        .filter((b) => isMasonry(b) && b.custom?.solidParts)
        .map((brick) => (
          <CompoundMasonry key={brick.id} brick={brick} grid={grid} />
        ))}
      {bricks
        .filter((b) => isMasonry(b) && b.custom?.profileXZ)
        .map((brick) => (
          <ProfileMesh key={brick.id} brick={brick} grid={grid} />
        ))}
      <InstanceBoxes instances={beds} />
      <InstanceBoxes instances={bodies} textured />
    </>
  );
});

/** Flat continuous faces: no rounded edges or decorative joints between the
 * occupied volumes of ONE cut brick. The physical cutout remains empty. */
function CompoundMasonry({ brick, grid }: { brick: PlacedBrick; grid: GridSpec }) {
  return (
    <group userData={{ brickId: brick.id }}>
      {brickPhysicalSolids(brick).map((solid) => {
        const box = solidSceneBox(solid, brick.row, grid);
        return (
          <mesh
            key={`${solid.box.x1}:${solid.box.y1}:${solid.z1}:${solid.box.x2}:${solid.box.y2}:${solid.z2}`}
            position={box.position}
            castShadow
            receiveShadow
          >
            <boxGeometry args={box.scale} />
            <meshStandardMaterial color={brickColor(brick)} roughness={0.93} />
          </mesh>
        );
      })}
    </group>
  );
}

function InstanceBoxes({ instances, textured = false }: { instances: Instance[]; textured?: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const resources = useMemo(() => {
    const texture = textured ? mineralTexture() : null;
    const geometry = textured ? new RoundedBoxGeometry(1, 1, 1, 2, 0.012) : new BoxGeometry(1, 1, 1);
    const material = new MeshStandardMaterial({
      color: "white",
      roughness: 0.92,
      metalness: 0,
      bumpMap: texture,
      bumpScale: 0.012,
      roughnessMap: texture
    });
    return { geometry, material, texture };
  }, [textured]);
  useEffect(
    () => () => {
      resources.geometry.dispose();
      resources.material.dispose();
      resources.texture?.dispose();
    },
    [resources]
  );
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new Object3D();
    instances.forEach((item, index) => {
      transform.position.set(...item.position);
      transform.scale.set(...item.scale);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, item.color);
    });
    mesh.count = instances.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [instances]);
  return (
    <instancedMesh
      key={instances.length}
      ref={ref}
      userData={{ brickIds: instances.map((i) => i.brickId) }}
      args={[resources.geometry, resources.material, Math.max(1, instances.length)]}
      castShadow
      receiveShadow
      dispose={null}
    />
  );
}

/** Collision-aligned wire ghost; never lies about an element's true height or seat. */
export function BrickHighlight({ brick, grid, color }: { brick: PlacedBrick; grid: GridSpec; color: string }) {
  if (brick.custom?.profileXZ) return <ProfileMesh brick={brick} grid={grid} color={color} highlight />;
  return (
    <group>
      {(brick.kind === "damper" || brick.kind === "grate"
        ? brickPhysicalSolids(brick).map((solid) => solidSceneBox(solid, brick.row, grid))
        : solidBoxes(brick, grid, 0)
      ).map((box) => (
        <group key={box.position.join(":")} position={box.position}>
          <mesh raycast={() => null}>
            <boxGeometry args={box.scale} />
            <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} />
          </mesh>
          <mesh raycast={() => null}>
            <boxGeometry args={box.scale} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.85} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const MetalBox = ({
  position,
  scale,
  color = "#353a3c",
  roughness = 0.62,
  metalness = 0.65
}: SceneBox & { color?: string | Color; roughness?: number; metalness?: number }) => (
  <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={scale} />
    <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
  </mesh>
);

export const ThreeBrick = memo(function ThreeBrick({ brick, grid }: { brick: PlacedBrick; grid: GridSpec }) {
  if (brick.custom?.profileXZ) return <ProfileMesh brick={brick} grid={grid} />;
  if (isSteelPart(brick)) return <CustomSteelMesh brick={brick} grid={grid} />;
  if (brick.kind === "damper" || brick.kind === "grate") return <HardwareMesh brick={brick} grid={grid} />;
  const box = solidBoxes(brick, grid, 0.025)[0];
  if (!box) return null;
  const size = footprintSizeOf(brick);
  if (brick.kind === "vent") {
    // A flue is empty space. Its footprint is an editing aid, never a solid dark brick.
    return null;
  }
  if (brick.kind === "cleanout") {
    // Build in one local frame, then rotate the entire assembly, including door and handle.
    const alongX = size.w >= size.h;
    const width = Math.max(size.w, size.h) - 0.04;
    const depth = Math.min(size.w, size.h) * 0.26;
    const height = box.scale[1];
    return (
      <group position={box.position} rotation={[0, alongX ? 0 : Math.PI / 2, 0]}>
        <MetalBox position={[0, 0, 0]} scale={[width, height, depth]} />
        <MetalBox position={[0, 0, depth / 2]} scale={[width * 0.82, height * 0.8, 0.035]} color="#45494a" />
        <MetalBox
          position={[width * 0.26, 0, depth / 2 + 0.055]}
          scale={[0.055, height * 0.23, 0.065]}
          color="#222627"
        />
        {[-1, 1].map((s) => (
          <MetalBox
            key={s}
            position={[-width * 0.4, s * height * 0.27, depth / 2 + 0.03]}
            scale={[0.08, 0.12, 0.055]}
          />
        ))}
      </group>
    );
  }
  if (brick.kind === "plate") {
    const r = Math.min(size.w, size.h) * 0.28;
    return (
      <group>
        <MetalBox {...box} />
        {plateBurnerCenters(size.w, size.h).map(([x, z]) => (
          <group
            key={`${x}:${z}`}
            position={[
              box.position[0] + (x - 0.5) * size.w,
              box.position[1] + box.scale[1] / 2 + 0.004,
              box.position[2] + (z - 0.5) * size.h
            ]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            {[0.45, 0.7, 1].map((fraction) => (
              <mesh key={fraction}>
                <ringGeometry args={[r * fraction - 0.015, r * fraction, 40]} />
                <meshStandardMaterial color="#171b1c" roughness={0.65} metalness={0.65} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    );
  }
  // Only used for a single prospective brick. The permanent model is instanced.
  const outer = brickBounds(brick);
  return (
    <group>
      {solidBoxes(brick, grid).map((part) => (
        <mesh key={part.position.join(":")} position={part.position} castShadow receiveShadow>
          <boxGeometry args={part.scale} />
          <meshStandardMaterial color={brickColor(brick)} roughness={0.93} />
        </mesh>
      ))}
      <group name={`brick-${outer.x1}-${outer.y1}`} />
    </group>
  );
});

/** Same canonical faces as SAT and physical sections, including ghost/highlight. */
export function ProfileMesh({
  brick,
  grid,
  color,
  highlight = false
}: {
  brick: PlacedBrick;
  grid: GridSpec;
  color?: string;
  highlight?: boolean;
}) {
  const geometry = useMemo(() => profileSceneGeometry(brick, grid), [brick, grid]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} userData={{ brickId: brick.id }} castShadow receiveShadow>
      <meshStandardMaterial
        color={color ?? brickColor(brick)}
        roughness={brickAppearance(brick).roughness}
        metalness={brickAppearance(brick).metalness}
        transparent={highlight}
        opacity={highlight ? 0.5 : 1}
        depthWrite={!highlight}
      />
    </mesh>
  );
}

function HardwareMesh({ brick, grid }: { brick: PlacedBrick; grid: GridSpec }) {
  const parts = brick.kind === "damper" ? damperParts(brick) : grateParts(brick);
  return (
    <group name={`hardware-${brick.id}`} userData={{ brickId: brick.id }}>
      {parts.map(({ solid, role }) => (
        <MetalBox
          key={`${role}-${solid.box.x1}-${solid.box.y1}-${solid.box.x2}-${solid.box.y2}-${solid.z1}-${solid.z2}`}
          {...solidSceneBox(solid, brick.row, grid)}
          color={role === "blade" ? "#45494a" : "#353a3c"}
        />
      ))}
    </group>
  );
}

function CustomSteelMesh({ brick, grid }: { brick: PlacedBrick; grid: GridSpec }) {
  const appearance = brickAppearance(brick);
  return (
    <group name={`steel-${brick.id}`} userData={{ brickId: brick.id }}>
      {brickPhysicalSolids(brick).map((solid) => (
        <MetalBox
          key={`${solid.box.x1}-${solid.box.y1}-${solid.z1}`}
          {...solidSceneBox(solid, brick.row, grid)}
          {...appearance}
        />
      ))}
    </group>
  );
}
