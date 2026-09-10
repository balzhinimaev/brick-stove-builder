import { Suspense, lazy, useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Translate } from "../i18n";
import type { CustomBrickSpec } from "../domain/types";

// Three.js тяжёлый — 3D-превью резака грузим лениво, как и основную сцену.
const CutterPreview3D = lazy(() => import("./three/CutterPreview3D"));

/** Полный кирпич-заготовка: 250×120×65 мм; 1 ячейка сетки редактора = 125 мм. */
const BLANK_L = 250;
const BLANK_W = 120;
const BLANK_H_MM = 65;
const MM_PER_CELL = 125;
const STEP_MM = 5;

type Corner = "none" | "nw" | "ne" | "sw" | "se";

export function BrickCutter({
  t,
  onSave,
  onClose
}: {
  t: Translate;
  onSave: (spec: CustomBrickSpec) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const [lengthMm, setLengthMm] = useState(BLANK_L);
  const [widthMm, setWidthMm] = useState(BLANK_W);
  const [corner, setCorner] = useState<Corner>("ne");
  const [notchLenMm, setNotchLenMm] = useState(125);
  const [notchWidMm, setNotchWidMm] = useState(60);
  /** Глубина выреза по высоте кирпича (65 мм = насквозь), полка = остаток. */
  const [notchDepthMm, setNotchDepthMm] = useState(35);
  const [name, setName] = useState("");
  const ledge = notchDepthMm < BLANK_H_MM;

  const clampedNotchLen = Math.min(notchLenMm, lengthMm - STEP_MM);
  const clampedNotchWid = Math.min(notchWidMm, widthMm - STEP_MM);

  const spec = useMemo<CustomBrickSpec>(() => {
    const w = lengthMm / MM_PER_CELL;
    const h = widthMm / MM_PER_CELL;
    let notch: CustomBrickSpec["notch"] = null;
    if (corner !== "none") {
      const nl = clampedNotchLen / MM_PER_CELL;
      const nw = clampedNotchWid / MM_PER_CELL;
      notch = {
        x1: corner === "nw" || corner === "sw" ? 0 : w - nl,
        x2: corner === "nw" || corner === "sw" ? nl : w,
        y1: corner === "nw" || corner === "ne" ? 0 : h - nw,
        y2: corner === "nw" || corner === "ne" ? nw : h
      };
    }
    return {
      name:
        name.trim() ||
        `${lengthMm}×${widthMm}${corner !== "none" ? ` −${clampedNotchLen}×${clampedNotchWid}×${notchDepthMm}` : ""}`,
      w,
      h,
      notch,
      ledge,
      notchDepthMm: corner !== "none" ? notchDepthMm : undefined
    };
  }, [lengthMm, widthMm, corner, clampedNotchLen, clampedNotchWid, ledge, notchDepthMm, name]);

  const numberInput = (id: string, value: number, set: (v: number) => void, min: number, max: number) => (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={STEP_MM}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="h-2 flex-1 accent-[#C1440E]"
      />
      <span className="w-16 shrink-0 rounded-lg bg-white px-2 py-1 text-right text-sm font-black">
        {value} <span className="text-[10px] font-bold text-[#3D2B1F]/50">мм</span>
      </span>
    </div>
  );

  return createPortal(
    <dialog
      ref={dialog}
      onCancel={onClose}
      aria-label={t("cutterTitle")}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none items-center justify-center border-0 bg-transparent p-3 backdrop:bg-[#3D2B1F]/45 [&[open]]:flex"
    >
      <div className="max-h-[92dvh] w-full max-w-[620px] overflow-y-auto rounded-[26px] border-2 border-[#3D2B1F]/10 bg-[#FFF7E8] p-4 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xl font-black">✂ {t("cutterTitle")}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cancel")}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-[#3D2B1F]/10 text-lg font-black"
          >
            ✕
          </button>
        </div>
        <p className="mb-2 text-xs font-bold leading-4 text-[#3D2B1F]/65">{t("cutterHint")}</p>

        <div className="h-[280px] overflow-hidden rounded-[18px] bg-[#F5E6C8]">
          <Suspense fallback={<div className="grid h-full place-items-center">{t("loadingScene")}</div>}>
            <CutterPreview3D spec={spec} />
          </Suspense>
        </div>

        <div className="mt-3 space-y-2.5">
          <label htmlFor="cutter-length" className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("cutterLength")}</span>
            {numberInput("cutter-length", lengthMm, setLengthMm, 30, BLANK_L)}
          </label>
          <label htmlFor="cutter-width" className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("cutterWidth")}</span>
            {numberInput("cutter-width", widthMm, setWidthMm, 30, BLANK_W)}
          </label>

          <div>
            <span className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("cutterCorner")}</span>
            <div className="mt-1 grid grid-cols-5 gap-1.5">
              {(
                [
                  ["none", "▭"],
                  ["nw", "◰"],
                  ["ne", "◳"],
                  ["sw", "◱"],
                  ["se", "◲"]
                ] as Array<[Corner, string]>
              ).map(([key, glyph]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setCorner(key)}
                  aria-pressed={corner === key}
                  className={`min-h-10 rounded-2xl text-sm font-black ${corner === key ? "bg-[#3D2B1F] text-[#F5E6C8]" : "bg-[#F5E6C8] text-[#3D2B1F]"}`}
                >
                  {glyph}
                </button>
              ))}
            </div>
          </div>

          {corner !== "none" && (
            <>
              <label htmlFor="cutter-notch-length" className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">
                  {t("cutterNotchLen")}
                </span>
                {numberInput("cutter-notch-length", clampedNotchLen, setNotchLenMm, STEP_MM * 2, lengthMm - STEP_MM)}
              </label>
              <label htmlFor="cutter-notch-width" className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">
                  {t("cutterNotchWid")}
                </span>
                {numberInput("cutter-notch-width", clampedNotchWid, setNotchWidMm, STEP_MM * 2, widthMm - STEP_MM)}
              </label>
              <label htmlFor="cutter-depth" className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("cutterDepth")}</span>
                {numberInput("cutter-depth", notchDepthMm, setNotchDepthMm, STEP_MM, BLANK_H_MM)}
                <span className="text-[11px] font-bold text-[#3D2B1F]/55">
                  {ledge ? `${t("cutterLedgeLeft")}: ${BLANK_H_MM - notchDepthMm} мм` : t("cutterThrough")}
                </span>
              </label>
            </>
          )}

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("cutterName")}
            className="min-h-11 w-full rounded-[14px] border-2 border-[#3D2B1F]/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#C1440E]/60"
          />

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onSave(spec);
                onClose();
              }}
              className="min-h-12 flex-1 rounded-[18px] bg-[#C1440E] px-4 text-sm font-black text-[#F5E6C8]"
            >
              {t("cutterSave")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 rounded-[18px] bg-[#3D2B1F]/10 px-4 text-sm font-black"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      </div>
    </dialog>,
    document.body
  );
}
