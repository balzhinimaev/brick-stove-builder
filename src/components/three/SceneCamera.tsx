import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MOUSE, PerspectiveCamera, TOUCH, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { fittedDistance } from "./sceneMath";

export type CameraCommand = { id: number; kind: "fit" | "iso" | "front" | "top" | "left" | "right" | "in" | "out" };

/** OrbitControls owns the camera; React sends commands, never competing camera transforms. */
export function SceneCamera({
  width,
  depth,
  height,
  centerX = 0,
  centerY,
  centerZ = 0,
  inspect,
  frontSign = 1,
  command
}: {
  width: number;
  depth: number;
  height: number;
  centerX?: number;
  centerY: number;
  centerZ?: number;
  inspect: boolean;
  frontSign?: 1 | -1;
  command: CameraCommand;
}) {
  const { camera, gl, size, invalidate } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const previousCenter = useRef(new Vector3(centerX, centerY, centerZ));
  const currentCenter = useRef(new Vector3(centerX, centerY, centerZ));
  const previousCommand = useRef(-1);
  const previousFit = useRef(0);
  currentCenter.current.set(centerX, centerY, centerZ);
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.14;
    orbit.minPolarAngle = 0.02;
    orbit.maxPolarAngle = Math.PI / 2 - 0.025;
    orbit.minDistance = 1.2;
    orbit.maxDistance = 500;
    const onChange = () => invalidate();
    orbit.addEventListener("change", onChange);
    controls.current = orbit;
    return () => {
      orbit.removeEventListener("change", onChange);
      orbit.dispose();
      controls.current = null;
    };
  }, [camera, gl, invalidate]);
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    orbit.mouseButtons = { LEFT: inspect ? MOUSE.ROTATE : null, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE };
    orbit.touches = { ONE: inspect ? TOUCH.ROTATE : null, TWO: TOUCH.DOLLY_PAN };
  }, [inspect]);
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const delta = new Vector3(centerX, centerY, centerZ).sub(previousCenter.current);
    orbit.target.add(delta);
    camera.position.add(delta);
    previousCenter.current.copy(currentCenter.current);
    orbit.update();
    invalidate();
  }, [centerX, centerY, centerZ, camera, invalidate]);
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit || !(camera instanceof PerspectiveCamera)) return;
    const distance = fittedDistance(width, depth, height, size.width / size.height, camera.fov);
    const kind = previousCommand.current === command.id ? "resize" : command.kind;
    const damping = orbit.enableDamping;
    orbit.enableDamping = false;
    orbit.update();
    previousCommand.current = command.id;
    if (kind === "resize") {
      const offset = camera.position.clone().sub(orbit.target);
      if (previousFit.current) offset.multiplyScalar(distance / previousFit.current);
      camera.position.copy(orbit.target).add(offset);
    } else if (["fit", "iso", "front", "top"].includes(kind)) {
      const direction =
        kind === "top"
          ? new Vector3(0, 1, 0.025 * frontSign)
          : kind === "front"
            ? new Vector3(0, 0.045, frontSign)
            : new Vector3(frontSign, 0.85, frontSign);
      orbit.target.copy(currentCenter.current);
      camera.position.copy(orbit.target).addScaledVector(direction.normalize(), distance);
    } else {
      const offset = camera.position.clone().sub(orbit.target);
      if (kind === "in" || kind === "out")
        offset.multiplyScalar(kind === "in" ? 0.8 : 1.25).clampLength(orbit.minDistance, orbit.maxDistance);
      else offset.applyAxisAngle(new Vector3(0, 1, 0), ((kind === "left" ? -1 : 1) * Math.PI) / 12);
      camera.position.copy(orbit.target).add(offset);
    }
    previousFit.current = distance;
    orbit.update();
    orbit.enableDamping = damping;
    invalidate();
  }, [command, width, depth, height, size.width, size.height, camera, invalidate, frontSign]);
  useFrame(() => controls.current?.update());
  return null;
}
