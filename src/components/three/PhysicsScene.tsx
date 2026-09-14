import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BufferGeometry, Color, Float32BufferAttribute, Plane, Quaternion, Vector3 } from "three";
import { polyhedronFaces } from "../../domain/geometry";
import { vec, type PhysicsModel } from "../../domain/physics/model";
import type { PhysicsFrame } from "../../domain/physics/simulation";
import { SceneCamera, type CameraCommand } from "./SceneCamera";

export type PhysicsSceneProps = {
  model: PhysicsModel;
  frame: PhysicsFrame | null;
  selectedId: string | null;
  mode: "bearing" | "load" | "motion";
  onSelect: (id: string) => void;
};

function PhysicalBodies({
  model,
  frame,
  selectedId,
  mode,
  onSelect,
  plane
}: PhysicsSceneProps & { plane: Plane | null }) {
  const { invalidate } = useThree();
  const down = useRef<[number, number] | null>(null);
  const data = useMemo(() => {
    const local: number[] = [],
      normals: number[] = [],
      owners: number[] = [];
    model.bodies.forEach((body, i) => {
      for (const shape of body.shapes)
        for (const face of polyhedronFaces(shape)) {
          const a = face.vertices[0];
          for (let k = 1; k + 1 < face.vertices.length; k++) {
            const b = face.vertices[k],
              c = face.vertices[k + 1];
            const outward = vec.dot(vec.cross(vec.sub(b, a), vec.sub(c, a)), face.normal) > 0;
            // XYZ domain -> XZY scene reverses handedness.
            for (const p of outward ? [a, c, b] : [a, b, c]) {
              const l = vec.mul(vec.sub(p, body.centerMm), 0.001);
              local.push(l.x, l.y, l.z);
              normals.push(face.normal.x, face.normal.y, face.normal.z);
              owners.push(i);
            }
          }
        }
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(local.length), 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(new Float32Array(local.length), 3));
    geometry.setAttribute("color", new Float32BufferAttribute(new Float32Array(local.length), 3));
    return {
      geometry,
      local: new Float32Array(local),
      normals: new Float32Array(normals),
      owners: new Uint32Array(owners)
    };
  }, [model]);
  useEffect(() => () => data.geometry.dispose(), [data]);
  useLayoutEffect(() => {
    const positions = data.geometry.getAttribute("position"),
      normals = data.geometry.getAttribute("normal"),
      colors = data.geometry.getAttribute("color");
    const maxLoad = Math.max(1, ...model.bearings.map((b) => b.loadN));
    const bodyColors = model.bodies.map((body, i) => {
      if (selectedId === body.id) return new Color("#008fa5");
      if (body.held && !frame?.released) return new Color("#8c6bc2");
      const issues = model.bearings[i].issues;
      if (mode === "motion") {
        const displacement = frame?.displacementsMm[i] ?? 0,
          rotation = frame?.rotationsDeg[i] ?? 0;
        return new Color(
          displacement > 2 || rotation > 1 ? "#c34632" : displacement > 0.5 || rotation > 0.25 ? "#dba548" : "#b5b9b1"
        );
      }
      if (mode === "load")
        return issues.includes("inclined")
          ? new Color("#dba548")
          : new Color("#ece4d4").lerp(new Color("#803e2c"), Math.sqrt(model.bearings[i].loadN / maxLoad));
      return new Color(
        issues.includes("disconnected") || issues.includes("overlap")
          ? "#c34632"
          : issues.length
            ? "#d3a15b"
            : body.material === "metal"
              ? "#768388"
              : "#b9b7aa"
      );
    });
    const p = new Vector3(),
      normal = new Vector3(),
      rotation = new Quaternion();
    const bodyFrames = model.bodies.map((body, i) => {
      const j = i * 7;
      return {
        center: frame
          ? new Vector3(frame.poses[j], frame.poses[j + 1], frame.poses[j + 2])
          : new Vector3(body.centerMm.x / 1000, body.centerMm.y / 1000, body.centerMm.z / 1000),
        rotation: frame
          ? new Quaternion(frame.poses[j + 3], frame.poses[j + 4], frame.poses[j + 5], frame.poses[j + 6])
          : new Quaternion()
      };
    });
    for (let i = 0; i < data.owners.length; i++) {
      const owner = data.owners[i],
        j = i * 3,
        transform = bodyFrames[owner];
      rotation.copy(transform.rotation);
      p.fromArray(data.local, j).applyQuaternion(rotation).add(transform.center);
      normal.fromArray(data.normals, j).applyQuaternion(rotation);
      positions.setXYZ(i, p.x * 8 - model.grid.cols / 2, p.z * 8, p.y * 8 - model.grid.rows / 2);
      normals.setXYZ(i, normal.x, normal.z, normal.y);
      const color = bodyColors[owner];
      colors.setXYZ(i, color.r, color.g, color.b);
    }
    positions.needsUpdate = normals.needsUpdate = colors.needsUpdate = true;
    data.geometry.computeBoundingSphere();
    invalidate();
  }, [data, model, frame, mode, selectedId, invalidate]);
  return (
    <mesh
      geometry={data.geometry}
      onPointerDown={(e) => {
        down.current = [e.clientX, e.clientY];
      }}
      onPointerUp={(e) => {
        if (
          !down.current ||
          Math.hypot(e.clientX - down.current[0], e.clientY - down.current[1]) > 5 ||
          e.faceIndex == null
        )
          return;
        // Ignore clipped triangles during picking; raycaster does not know material clipping.
        if (plane && plane.distanceToPoint(e.point) < 0) return;
        e.stopPropagation();
        onSelect(model.bodies[data.owners[e.faceIndex * 3]].id);
        down.current = null;
      }}
    >
      <meshStandardMaterial vertexColors roughness={0.85} clippingPlanes={plane ? [plane] : []} />
    </mesh>
  );
}

export function PhysicsScene(props: PhysicsSceneProps) {
  const { model, selectedId } = props;
  const [command, setCommand] = useState<CameraCommand>({ id: 0, kind: "iso" });
  const [focus, setFocus] = useState(false);
  const [cut, setCut] = useState<"whole" | "x" | "y">("whole");
  const [fraction, setFraction] = useState(0.5);
  const chosen = focus ? model.bodies.find((b) => b.id === selectedId) : null;
  const maxZ = Math.max(70, ...model.bodies.map((b) => b.bounds.hi.z)) / 125;
  const width = chosen ? Math.max(2, (chosen.bounds.hi.x - chosen.bounds.lo.x) / 125 + 2) : model.grid.cols;
  const depth = chosen ? Math.max(2, (chosen.bounds.hi.y - chosen.bounds.lo.y) / 125 + 2) : model.grid.rows;
  const height = chosen ? Math.max(2, (chosen.bounds.hi.z - chosen.bounds.lo.z) / 125 + 2) : maxZ;
  const plane = useMemo(
    () =>
      cut === "whole"
        ? null
        : cut === "x"
          ? new Plane(new Vector3(1, 0, 0), model.grid.cols * (0.5 - fraction))
          : new Plane(new Vector3(0, 0, 1), model.grid.rows * (0.5 - fraction)),
    [cut, fraction, model.grid]
  );
  const act = (kind: CameraCommand["kind"]) => setCommand((s) => ({ id: s.id + 1, kind }));
  return (
    <>
      <div className="physics-viewbar">
        <button
          type="button"
          onClick={() => {
            setFocus(false);
            act("iso");
          }}
        >
          Вся модель
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={() => {
            setFocus(true);
            act("iso");
          }}
        >
          К детали
        </button>
        <button type="button" onClick={() => act("front")}>
          Спереди
        </button>
        <button type="button" onClick={() => act("top")}>
          Сверху
        </button>
        <label>
          Разрез
          <select value={cut} onChange={(e) => setCut(e.target.value as typeof cut)}>
            <option value="whole">Нет</option>
            <option value="x">Продольный</option>
            <option value="y">Поперечный</option>
          </select>
        </label>
        {cut !== "whole" && (
          <input
            aria-label="Положение разреза"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={fraction}
            onChange={(e) => setFraction(Number(e.target.value))}
          />
        )}
      </div>
      <div className="physics-scene">
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ fov: 38, near: 0.02, far: 1000 }}
          gl={{ antialias: true, localClippingEnabled: true }}
          aria-label="Гравитация: независимая копия печи"
        >
          <color attach="background" args={["#e9eae4"]} />
          <ambientLight intensity={0.8} />
          <hemisphereLight args={["#fff9ec", "#6d756e", 1.4]} />
          <directionalLight position={[12, 30, -12]} intensity={2} />
          <directionalLight position={[-8, 10, 10]} intensity={0.8} />
          <SceneCamera
            width={width}
            depth={depth}
            height={height}
            centerX={chosen ? chosen.centerMm.x / 125 - model.grid.cols / 2 : 0}
            centerY={chosen ? chosen.centerMm.z / 125 : maxZ / 2}
            centerZ={chosen ? chosen.centerMm.y / 125 - model.grid.rows / 2 : 0}
            inspect
            frontSign={-1}
            command={command}
          />
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[model.grid.cols, 0.8, model.grid.rows]} />
            <meshStandardMaterial color="#929b91" roughness={1} />
          </mesh>
          <PhysicalBodies {...props} plane={plane} />
        </Canvas>
      </div>
      <p className="physics-note">
        Поворот — перетаскиванием; масштаб — колёсиком или двумя пальцами. Разрез скрывает только изображение, все
        детали продолжают участвовать в расчёте.
      </p>
    </>
  );
}
