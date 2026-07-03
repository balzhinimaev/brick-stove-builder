import type { Translate } from "../../i18n";
import type { CustomBrickSpec } from "../../domain/types";

const PLATE_PRESETS: Array<[number, number]> = [
  [410, 340],
  [585, 340],
  [710, 410]
];

/** Размер варочной плиты: типовые чугунные + произвольный; толщина и посадка. */
export function PlateSizePanel({ t, plateSpec, setPlateSize }: { t: Translate; plateSpec: CustomBrickSpec; setPlateSize: (lengthMm: number, widthMm: number, thicknessMm: number, flush: boolean) => void }) {
  const lengthMm = Math.round(plateSpec.w * 125);
  const widthMm = Math.round(plateSpec.h * 125);
  const thicknessMm = plateSpec.thicknessMm ?? 14;
  const flush = plateSpec.flush === true;
  const slider = (value: number, min: number, max: number, step: number, onChange: (v: number) => void) => (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-2 flex-1 accent-[#C1440E]" />
      <span className="w-14 shrink-0 rounded-lg bg-white px-1.5 py-0.5 text-right text-xs font-black">{value}</span>
    </div>
  );
  return (
    <div className="rounded-[22px] border border-[#3D2B1F]/10 bg-[#FFF7E8] p-2">
      <div className="mb-2 px-1 text-[11px] font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("plateSizeTitle")}</div>
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {PLATE_PRESETS.map(([l, w]) => {
          const active = l === lengthMm && w === widthMm;
          return (
            <button key={`${l}x${w}`} onClick={() => setPlateSize(l, w, thicknessMm, flush)} aria-pressed={active} className={`min-h-9 rounded-2xl px-1 text-[11px] font-black ${active ? "bg-[#3D2B1F] text-[#F5E6C8]" : "bg-[#F5E6C8] text-[#3D2B1F]"}`}>
              {l}×{w}
            </button>
          );
        })}
      </div>
      <div className="space-y-1.5 px-1">
        <div className="text-[10px] font-black uppercase text-[#3D2B1F]/45">{t("cutterLength")}</div>
        {slider(lengthMm, 300, 1000, 5, (v) => setPlateSize(v, widthMm, thicknessMm, flush))}
        <div className="text-[10px] font-black uppercase text-[#3D2B1F]/45">{t("cutterWidth")}</div>
        {slider(widthMm, 250, 750, 5, (v) => setPlateSize(lengthMm, v, thicknessMm, flush))}
        <div className="text-[10px] font-black uppercase text-[#3D2B1F]/45">{t("plateThickness")}</div>
        {slider(thicknessMm, 5, 25, 1, (v) => setPlateSize(lengthMm, widthMm, v, flush))}
      </div>
      <div className="mt-2 px-1">
        <div className="mb-1 text-[10px] font-black uppercase text-[#3D2B1F]/45">{t("plateSeat")}</div>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => setPlateSize(lengthMm, widthMm, thicknessMm, false)} aria-pressed={!flush} className={`min-h-9 rounded-2xl px-1 text-[11px] font-black ${!flush ? "bg-[#3D2B1F] text-[#F5E6C8]" : "bg-[#F5E6C8] text-[#3D2B1F]"}`}>{t("plateOnTop")}</button>
          <button onClick={() => setPlateSize(lengthMm, widthMm, thicknessMm, true)} aria-pressed={flush} className={`min-h-9 rounded-2xl px-1 text-[11px] font-black ${flush ? "bg-[#3D2B1F] text-[#F5E6C8]" : "bg-[#F5E6C8] text-[#3D2B1F]"}`}>{t("plateFlush")}</button>
        </div>
        {flush && <p className="mt-1 text-[10px] font-bold leading-3.5 text-[#3D2B1F]/55">{t("plateFlushHint")}</p>}
      </div>
    </div>
  );
}
