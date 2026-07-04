import type { Translate } from "../../i18n";
import type { CustomBrickSpec } from "../../domain/types";

/** Типовые проёмы чугунных печных задвижек, мм (длина × ширина). */
const DAMPER_PRESETS: Array<[number, number]> = [
  [130, 130],
  [250, 130],
  [250, 250]
];

/** Размер задвижки дымохода: типовые проёмы + произвольный. */
export function DamperSizePanel({ t, damperSpec, setDamperSize }: { t: Translate; damperSpec: CustomBrickSpec; setDamperSize: (lengthMm: number, widthMm: number) => void }) {
  const lengthMm = Math.round(damperSpec.w * 125);
  const widthMm = Math.round(damperSpec.h * 125);
  const slider = (value: number, min: number, max: number, onChange: (v: number) => void) => (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-2 flex-1 accent-[#C1440E]" />
      <span className="w-14 shrink-0 rounded-lg bg-white px-1.5 py-0.5 text-right text-xs font-black">{value}</span>
    </div>
  );
  return (
    <div className="rounded-[22px] border border-[#3D2B1F]/10 bg-[#FFF7E8] p-2">
      <div className="mb-2 px-1 text-[11px] font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("damperSizeTitle")}</div>
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {DAMPER_PRESETS.map(([l, w]) => {
          const active = l === lengthMm && w === widthMm;
          return (
            <button key={`${l}x${w}`} onClick={() => setDamperSize(l, w)} aria-pressed={active} className={`min-h-9 rounded-2xl px-1 text-[11px] font-black ${active ? "bg-[#3D2B1F] text-[#F5E6C8]" : "bg-[#F5E6C8] text-[#3D2B1F]"}`}>
              {l}×{w}
            </button>
          );
        })}
      </div>
      <div className="space-y-1.5 px-1">
        <div className="text-[10px] font-black uppercase text-[#3D2B1F]/45">{t("cutterLength")}</div>
        {slider(lengthMm, 125, 375, (v) => setDamperSize(v, widthMm))}
        <div className="text-[10px] font-black uppercase text-[#3D2B1F]/45">{t("cutterWidth")}</div>
        {slider(widthMm, 125, 375, (v) => setDamperSize(lengthMm, v))}
      </div>
      <p className="mt-2 px-1 text-[10px] font-bold leading-3.5 text-[#3D2B1F]/55">{t("damperHint")}</p>
    </div>
  );
}
