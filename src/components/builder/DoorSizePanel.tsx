import type { Translate } from "../../i18n";
import type { CustomBrickSpec } from "../../domain/types";

const DOOR_PRESETS: Array<[string, number, number]> = [
  ["ДТ 250×210", 250, 210],
  ["ДТ 250×280", 250, 280],
  ["ДП 250×140", 250, 140],
  ["ДПр 130×140", 130, 140]
];

/** Размер дверцы: топочные/поддувальные/прочистные по ГОСТ + произвольный. */
export function DoorSizePanel({ t, doorSpec, setDoorSize }: { t: Translate; doorSpec: CustomBrickSpec; setDoorSize: (widthMm: number, heightMm: number) => void }) {
  const widthMm = Math.round(doorSpec.w * 125);
  const heightMm = doorSpec.heightMm ?? 210;
  const slider = (value: number, min: number, max: number, onChange: (v: number) => void) => (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-2 flex-1 accent-[#C1440E]" />
      <span className="w-14 shrink-0 rounded-lg bg-white px-1.5 py-0.5 text-right text-xs font-black">{value}</span>
    </div>
  );
  return (
    <div className="rounded-[22px] border border-[#3D2B1F]/10 bg-[#FFF7E8] p-2">
      <div className="mb-2 px-1 text-[11px] font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("doorSizeTitle")}</div>
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        {DOOR_PRESETS.map(([label, w, h]) => {
          const active = w === widthMm && h === heightMm;
          return (
            <button key={label} onClick={() => setDoorSize(w, h)} aria-pressed={active} className={`min-h-9 rounded-2xl px-1 text-[11px] font-black ${active ? "bg-[#3D2B1F] text-[#F5E6C8]" : "bg-[#F5E6C8] text-[#3D2B1F]"}`}>
              {label}
            </button>
          );
        })}
      </div>
      <div className="space-y-1.5 px-1">
        <div className="text-[10px] font-black uppercase text-[#3D2B1F]/45">{t("doorWidth")}</div>
        {slider(widthMm, 100, 500, (v) => setDoorSize(v, heightMm))}
        <div className="text-[10px] font-black uppercase text-[#3D2B1F]/45">{t("doorHeight")}</div>
        {slider(heightMm, 100, 400, (v) => setDoorSize(widthMm, v))}
      </div>
    </div>
  );
}
