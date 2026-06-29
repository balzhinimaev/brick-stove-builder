import { useMemo } from "react";
import type { Translate } from "../i18n";
import type { Parameters } from "../domain/types";
import { PARAM_BOUNDS, PARAMETER_FIELDS, validateParameters } from "../domain/parameters";
import { SectionTitle } from "./ui";
import { SideSilhouette } from "./SideSilhouette";

export function ParametersScreen({
  parameters,
  updateParameter,
  t,
  onContinue,
  lockedRows
}: {
  parameters: Parameters;
  updateParameter: (key: keyof Parameters, value: number) => void;
  t: Translate;
  onContinue: () => void;
  lockedRows: number[];
}) {
  const valid = useMemo(() => validateParameters(parameters, t), [parameters, t]);
  return (
    <main className="mt-4 space-y-3 xl:space-y-4">
      <SectionTitle title={t("parametersTitle")} subtitle={t("parametersSubtitle")} />
      {PARAMETER_FIELDS.map((key) => (
        <ParameterControl key={key} field={key} value={parameters[key]} updateParameter={updateParameter} t={t} />
      ))}
      <div className="flex items-center gap-3 rounded-[26px] border-2 border-[#5F7E4D]/20 bg-[#8FAF76]/20 p-3">
        <BrickMascot valid={valid.ok} />
        <div className="flex-1">
          <div className="font-black">{valid.ok ? t("looksBuildable") : t("checkDimensions")}</div>
          <p className="mt-1 text-sm font-bold leading-5 text-[#3D2B1F]/70">{valid.message}</p>
        </div>
      </div>
      <div className="rounded-[26px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8]/80 p-3">
        <div className="mb-2 text-lg font-black">{t("liveSidePreview")}</div>
        <SideSilhouette parameters={parameters} lockedRows={lockedRows} t={t} />
      </div>
      <button onClick={onContinue} className="min-h-14 w-full rounded-[22px] bg-[#C1440E] text-base font-black text-[#F5E6C8] shadow-lg shadow-[#C1440E]/25">{t("startBuild")}</button>
    </main>
  );
}

function ParameterControl({
  field,
  value,
  updateParameter,
  t
}: {
  field: keyof Parameters;
  value: number;
  updateParameter: (key: keyof Parameters, value: number) => void;
  t: Translate;
}) {
  const bounds = PARAM_BOUNDS[field];
  const ratio = (value - bounds.min) / (bounds.max - bounds.min);
  const title = t(bounds.title);
  const unit = t("unitCm");
  return (
    <div className="rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] p-3 shadow-md shadow-[#3D2B1F]/10">
      <div className="flex gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border-2 border-[#C1440E]/15 bg-[#C1440E]/10 text-2xl font-black text-[#C1440E]" aria-hidden="true">{bounds.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="font-black">{title}</div>
          <div className="text-xs font-bold leading-4 text-[#3D2B1F]/60">{t(bounds.help)}</div>
        </div>
        <label className="flex min-w-[86px] items-center rounded-[17px] border-2 border-[#3D2B1F]/10 bg-[#FFF7E8] px-2 py-1.5">
          <input
            value={value}
            onChange={(event) => updateParameter(field, Number(event.target.value.replace(/[^0-9]/g, "")))}
            inputMode="numeric"
            aria-label={`${title}, ${unit}`}
            className="w-10 bg-transparent text-base font-black outline-none"
          />
          <span className="text-xs font-black text-[#3D2B1F]/55">{unit}</span>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => updateParameter(field, value - bounds.step)} aria-label={`${title} −${bounds.step}`} className="grid min-h-11 min-w-11 place-items-center rounded-[16px] bg-[#3D2B1F] text-xl font-black text-[#F5E6C8]">−</button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#3D2B1F]/10"><div className="h-full rounded-full bg-[#8FAF76]" style={{ width: `${Math.max(4, ratio * 100)}%` }} /></div>
        <button onClick={() => updateParameter(field, value + bounds.step)} aria-label={`${title} +${bounds.step}`} className="grid min-h-11 min-w-11 place-items-center rounded-[16px] bg-[#3D2B1F] text-xl font-black text-[#F5E6C8]">+</button>
      </div>
    </div>
  );
}

function BrickMascot({ valid }: { valid: boolean }) {
  return (
    <div className="relative h-[62px] w-[72px] shrink-0" aria-hidden="true">
      <div className="relative mt-3 h-[40px] w-16 rounded-[14px] border-2 border-[#3D2B1F] bg-[#E9854A]">
        <div className="absolute left-0 right-0 top-[18px] h-[3px] bg-[#F4D9B7]" />
        <div className="absolute left-[18px] top-3 h-1.5 w-1.5 rounded-full bg-[#3D2B1F]" />
        <div className="absolute right-[18px] top-3 h-1.5 w-1.5 rounded-full bg-[#3D2B1F]" />
        <div className={`absolute left-[25px] top-[26px] h-2 w-3.5 rounded-full border-[#3D2B1F] ${valid ? "border-b-2" : "border-t-2"}`} />
      </div>
      <div className={`absolute right-0 top-4 text-2xl font-black ${valid ? "-rotate-12" : "rotate-12"}`}>{valid ? "👍" : "!"}</div>
    </div>
  );
}
