import { useId, useMemo, useState } from "react";
import type { Locale, Translate } from "../i18n";
import type { Parameters, ReadyProject } from "../domain/types";
import type { CalculatorInput } from "../domain/stoveCalculator";
import { StoveCalculator } from "./StoveCalculator";
import { PARAM_BOUNDS, PARAMETER_FIELDS, validateParameters } from "../domain/parameters";
import { SectionTitle } from "./ui";
import { SideSilhouette } from "./SideSilhouette";

export function ParametersScreen({
  locale,
  calculatorInput,
  onCalculatorChange,
  onOpenReference,
  parameters,
  updateParameter,
  t,
  onContinue,
  lockedRows
}: {
  locale: Locale;
  calculatorInput: CalculatorInput;
  onCalculatorChange: (input: CalculatorInput) => void;
  onOpenReference: (project: ReadyProject) => void;
  parameters: Parameters;
  updateParameter: (key: keyof Parameters, value: number) => void;
  t: Translate;
  onContinue: () => void;
  lockedRows: number[];
}) {
  const valid = useMemo(() => validateParameters(parameters, t), [parameters, t]);
  return (
    <main className="site-page parameters-page">
      <StoveCalculator locale={locale} input={calculatorInput} onChange={onCalculatorChange} onOpen={onOpenReference} />
      <details className="rounded-xl border border-[#283732]/10 p-4">
        <summary className="cursor-pointer font-semibold">{t("parametersTitle")}</summary>
        <div className="mt-4 space-y-3">
          <SectionTitle title={t("parametersTitle")} subtitle={t("parametersSubtitle")} />
          {PARAMETER_FIELDS.map((key) => (
            <ParameterControl key={key} field={key} value={parameters[key]} updateParameter={updateParameter} t={t} />
          ))}
          <div className="flex items-center gap-3 rounded-xl border border-[#326856]/20 bg-[#dfe9e1]/20 p-3">
            <span className="validation-mark" aria-hidden="true">
              {valid.ok ? "✓" : "!"}
            </span>
            <div className="flex-1">
              <div className="font-semibold">{valid.ok ? t("looksBuildable") : t("checkDimensions")}</div>
              <p className="mt-1 text-sm font-bold leading-5 text-[#283732]/70">{valid.message}</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#283732]/10 bg-[#ffffff]/80 p-3">
            <div className="mb-2 text-lg font-semibold">{t("liveSidePreview")}</div>
            <SideSilhouette parameters={parameters} lockedRows={lockedRows} t={t} />
          </div>
          <button type="button" onClick={onContinue} className="studio-primary w-full">
            {t("startBuild")}
          </button>
        </div>
      </details>
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
  const helpId = useId();
  const bounds = PARAM_BOUNDS[field];
  const ratio = (value - bounds.min) / (bounds.max - bounds.min);
  const title = t(bounds.title);
  const unit = t("unitCm");
  // Черновик на время фокуса: клампить на каждое нажатие нельзя — «85» было бы
  // не набрать (8 → min). Коммитим на blur/Enter; вне фокуса показываем проп.
  const [draft, setDraft] = useState<string | null>(null);
  const commitDraft = () => {
    if (draft !== null && draft !== "") updateParameter(field, Number(draft));
    setDraft(null);
  };
  return (
    <div className="rounded-xl border border-[#283732]/10 bg-[#ffffff] p-3 ">
      <div className="flex gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[#326856]/15 bg-[#326856]/10 text-2xl font-semibold text-[#326856]"
          aria-hidden="true"
        >
          {bounds.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{title}</div>
          <div id={helpId} className="text-xs font-bold leading-4 text-[#283732]/60">
            {t(bounds.help)}
          </div>
        </div>
        <label className="flex min-w-[86px] items-center rounded-[17px] border border-[#283732]/10 bg-[#f4f5f1] px-2 py-1.5">
          <input
            value={draft ?? String(value)}
            onFocus={() => setDraft(String(value))}
            onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ""))}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            inputMode="numeric"
            aria-label={`${title}, ${unit}`}
            aria-describedby={helpId}
            className="w-10 bg-transparent text-base font-semibold outline-none"
          />
          <span className="text-xs font-semibold text-[#283732]/55">{unit}</span>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={value <= bounds.min}
          onClick={() => updateParameter(field, value - bounds.step)}
          aria-label={`${title} −${bounds.step}`}
          className="grid min-h-11 min-w-11 place-items-center rounded-[16px] bg-[#283732] text-xl font-semibold text-[#ffffff] disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#283732]/10">
          <div className="h-full rounded-full bg-[#dfe9e1]" style={{ width: `${Math.max(4, ratio * 100)}%` }} />
        </div>
        <button
          type="button"
          disabled={value >= bounds.max}
          onClick={() => updateParameter(field, value + bounds.step)}
          aria-label={`${title} +${bounds.step}`}
          className="grid min-h-11 min-w-11 place-items-center rounded-[16px] bg-[#283732] text-xl font-semibold text-[#ffffff] disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
