import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { COLORS } from "../theme/colors";
import type { Translate } from "../i18n";
import type { CustomBrickSpec } from "../domain/types";

/** Полный кирпич-заготовка: 250×120 мм; 1 ячейка сетки редактора = 125 мм. */
const BLANK_L = 250;
const BLANK_W = 120;
const MM_PER_CELL = 125;
const STEP_MM = 5;
const SCALE = 1.7; // px на мм
const RULER = 30;
const PAD = 14;

type Corner = "none" | "nw" | "ne" | "sw" | "se";

export function BrickCutter({ t, onSave, onClose }: { t: Translate; onSave: (spec: CustomBrickSpec) => void; onClose: () => void }) {
  const [lengthMm, setLengthMm] = useState(BLANK_L);
  const [widthMm, setWidthMm] = useState(BLANK_W);
  const [corner, setCorner] = useState<Corner>("ne");
  const [notchLenMm, setNotchLenMm] = useState(125);
  const [notchWidMm, setNotchWidMm] = useState(60);
  const [ledge, setLedge] = useState(true);
  const [name, setName] = useState("");

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
      name: name.trim() || `${lengthMm}×${widthMm}${corner !== "none" ? ` −${clampedNotchLen}×${clampedNotchWid}` : ""}`,
      w,
      h,
      notch,
      ledge
    };
  }, [lengthMm, widthMm, corner, clampedNotchLen, clampedNotchWid, ledge, name]);

  const svgW = RULER + BLANK_L * SCALE + PAD;
  const svgH = RULER + BLANK_W * SCALE + PAD;
  const mx = (mm: number) => RULER + mm * SCALE;
  const my = (mm: number) => RULER + mm * SCALE;

  // контур результата в мм (для L-формы)
  const bodyPath = useMemo(() => {
    const L = lengthMm;
    const W = widthMm;
    if (corner === "none") return `M${mx(0)} ${my(0)} L${mx(L)} ${my(0)} L${mx(L)} ${my(W)} L${mx(0)} ${my(W)} Z`;
    const nl = clampedNotchLen;
    const nw = clampedNotchWid;
    const points: Record<Exclude<Corner, "none">, Array<[number, number]>> = {
      nw: [[nl, 0], [L, 0], [L, W], [0, W], [0, nw], [nl, nw]],
      ne: [[0, 0], [L - nl, 0], [L - nl, nw], [L, nw], [L, W], [0, W]],
      sw: [[0, 0], [L, 0], [L, W], [nl, W], [nl, W - nw], [0, W - nw]],
      se: [[0, 0], [L, 0], [L, W - nw], [L - nl, W - nw], [L - nl, W], [0, W]]
    };
    return `M${points[corner].map(([x, y]) => `${mx(x)} ${my(y)}`).join(" L")} Z`;
  }, [lengthMm, widthMm, corner, clampedNotchLen, clampedNotchWid]);

  const numberInput = (value: number, set: (v: number) => void, min: number, max: number) => (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={STEP_MM} value={value} onChange={(e) => set(Number(e.target.value))} className="h-2 flex-1 accent-[#C1440E]" />
      <span className="w-16 shrink-0 rounded-lg bg-white px-2 py-1 text-right text-sm font-black">{value} <span className="text-[10px] font-bold text-[#3D2B1F]/50">мм</span></span>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#3D2B1F]/45 p-3" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-[620px] overflow-y-auto rounded-[26px] border-2 border-[#3D2B1F]/10 bg-[#FFF7E8] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xl font-black">✂ {t("cutterTitle")}</h3>
          <button onClick={onClose} aria-label={t("cancel")} className="grid h-10 w-10 place-items-center rounded-2xl bg-[#3D2B1F]/10 text-lg font-black">✕</button>
        </div>
        <p className="mb-3 text-xs font-bold leading-4 text-[#3D2B1F]/65">{t("cutterHint")}</p>

        <div className="overflow-x-auto rounded-[18px] bg-[#F5E6C8] p-2">
          <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
            {/* линейки: см-подписи, деления 10 и 5 мм */}
            {Array.from({ length: BLANK_L / STEP_MM + 1 }, (_, i) => i * STEP_MM).map((mm) => {
              const big = mm % 50 === 0;
              const mid = mm % 10 === 0;
              return (
                <g key={`rx-${mm}`}>
                  <line x1={mx(mm)} y1={RULER - (big ? 12 : mid ? 8 : 5)} x2={mx(mm)} y2={RULER - 1} stroke={COLORS.charcoal} strokeWidth={big ? 1.4 : 0.7} opacity={big ? 0.85 : 0.45} />
                  {big && <text x={mx(mm)} y={RULER - 15} textAnchor="middle" fontSize="9" fontWeight="800" fill={COLORS.charcoal}>{mm / 10}{mm === 0 ? " см" : ""}</text>}
                </g>
              );
            })}
            {Array.from({ length: BLANK_W / STEP_MM + 1 }, (_, i) => i * STEP_MM).map((mm) => {
              const big = mm % 50 === 0;
              const mid = mm % 10 === 0;
              return (
                <g key={`ry-${mm}`}>
                  <line x1={RULER - (big ? 12 : mid ? 8 : 5)} y1={my(mm)} x2={RULER - 1} y2={my(mm)} stroke={COLORS.charcoal} strokeWidth={big ? 1.4 : 0.7} opacity={big ? 0.85 : 0.45} />
                  {big && mm > 0 && <text x={RULER - 15} y={my(mm) + 3} textAnchor="end" fontSize="9" fontWeight="800" fill={COLORS.charcoal}>{mm / 10}</text>}
                </g>
              );
            })}

            {/* заготовка 250×120 пунктиром */}
            <rect x={mx(0)} y={my(0)} width={BLANK_L * SCALE} height={BLANK_W * SCALE} fill="#fff" stroke={COLORS.charcoal} strokeWidth="1" strokeDasharray="5 4" opacity="0.5" />
            {/* результат */}
            <path d={bodyPath} fill={COLORS.customBrick} stroke={COLORS.charcoal} strokeWidth="2" strokeLinejoin="round" opacity="0.92" />
            {/* полка в вырезе */}
            {corner !== "none" && ledge ? (() => {
              const nl = clampedNotchLen * SCALE;
              const nw = clampedNotchWid * SCALE;
              const x = corner === "nw" || corner === "sw" ? mx(0) : mx(lengthMm) - nl;
              const y = corner === "nw" || corner === "ne" ? my(0) : my(widthMm) - nw;
              return <rect x={x + 2} y={y + 2} width={nl - 4} height={nw - 4} fill={COLORS.cutBrick} opacity="0.35" stroke={COLORS.charcoal} strokeWidth="1" strokeDasharray="3 3" />;
            })() : null}
            {/* размеры результата */}
            <text x={mx(lengthMm / 2)} y={my(widthMm) + 12} textAnchor="middle" fontSize="11" fontWeight="900" fill={COLORS.charcoal}>{lengthMm} мм</text>
          </svg>
        </div>

        <div className="mt-3 space-y-2.5">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("cutterLength")}</span>
            {numberInput(lengthMm, setLengthMm, 30, BLANK_L)}
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("cutterWidth")}</span>
            {numberInput(widthMm, setWidthMm, 30, BLANK_W)}
          </label>

          <div>
            <span className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("cutterCorner")}</span>
            <div className="mt-1 grid grid-cols-5 gap-1.5">
              {([["none", "▭"], ["nw", "◰"], ["ne", "◳"], ["sw", "◱"], ["se", "◲"]] as Array<[Corner, string]>).map(([key, glyph]) => (
                <button key={key} onClick={() => setCorner(key)} aria-pressed={corner === key} className={`min-h-10 rounded-2xl text-sm font-black ${corner === key ? "bg-[#3D2B1F] text-[#F5E6C8]" : "bg-[#F5E6C8] text-[#3D2B1F]"}`}>
                  {glyph}
                </button>
              ))}
            </div>
          </div>

          {corner !== "none" && (
            <>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("cutterNotchLen")}</span>
                {numberInput(clampedNotchLen, setNotchLenMm, STEP_MM * 2, lengthMm - STEP_MM)}
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("cutterNotchWid")}</span>
                {numberInput(clampedNotchWid, setNotchWidMm, STEP_MM * 2, widthMm - STEP_MM)}
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={ledge} onChange={(e) => setLedge(e.target.checked)} className="h-4 w-4 accent-[#C1440E]" />
                {t("cutterLedge")}
              </label>
            </>
          )}

          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("cutterName")} className="min-h-11 w-full rounded-[14px] border-2 border-[#3D2B1F]/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#C1440E]/60" />

          <div className="flex gap-2 pt-1">
            <button onClick={() => { onSave(spec); onClose(); }} className="min-h-12 flex-1 rounded-[18px] bg-[#C1440E] px-4 text-sm font-black text-[#F5E6C8]">{t("cutterSave")}</button>
            <button onClick={onClose} className="min-h-12 rounded-[18px] bg-[#3D2B1F]/10 px-4 text-sm font-black">{t("cancel")}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
