import type { ReactNode } from "react";
import type { Translate } from "../../i18n";
import type { CameraState } from "../../domain/types";

export function CameraControls({
  t,
  camera,
  onZoom,
  onRotate,
  onPan,
  onReset
}: {
  t: Translate;
  camera: CameraState;
  onZoom: (delta: number) => void;
  onRotate: (delta: number) => void;
  onPan: (dx: number, dy: number) => void;
  onReset: () => void;
}) {
  return (
    <section className="rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#FFF7E8] p-2">
      <div className="mb-2 flex items-center justify-between gap-2"><div className="px-1 text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("camera")}</div><div className="text-[11px] font-black text-[#5F7E4D]">{t("zoom")}: {Math.round(camera.zoom * 100)}% · {t("angle")}: {Math.round(camera.angle)}°</div></div>
      <div className="grid grid-cols-4 gap-2">
        <CameraButton onClick={() => onZoom(-0.08)} label={t("zoomOut")}>{t("zoomOut")}</CameraButton>
        <CameraButton onClick={() => onZoom(0.08)} label={t("zoomIn")}>{t("zoomIn")}</CameraButton>
        <CameraButton onClick={() => onRotate(-15)} label={t("rotateLeft")}>{t("rotateLeft")}</CameraButton>
        <CameraButton onClick={() => onRotate(15)} label={t("rotateRight")}>{t("rotateRight")}</CameraButton>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        <CameraButton onClick={() => onPan(-0.25, 0)} label="←">←</CameraButton>
        <CameraButton onClick={() => onPan(0, -0.25)} label="↑">↑</CameraButton>
        <CameraButton onClick={onReset} label={t("resetCamera")}>{t("resetCamera")}</CameraButton>
        <CameraButton onClick={() => onPan(0, 0.25)} label="↓">↓</CameraButton>
        <CameraButton onClick={() => onPan(0.25, 0)} label="→">→</CameraButton>
      </div>
      <p className="mt-2 px-1 text-[11px] font-bold leading-4 text-[#3D2B1F]/65">{t("dragHint")}</p>
    </section>
  );
}

function CameraButton({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return <button onClick={onClick} aria-label={label} className="min-h-11 rounded-[16px] border border-[#3D2B1F]/10 bg-[#F5E6C8] px-2 text-sm font-black text-[#3D2B1F]">{children}</button>;
}
