import { useMemo, useState } from "react";
import type { Locale } from "../i18n";
import type { ReadyProject } from "../domain/types";
import {
  assessRecipe,
  CALCULATOR_RANGES,
  calculateHeatLoss,
  generateOrderReference,
  inputProblems,
  ORDER_RECIPES,
  orderPartsCsv,
  type CalculatorInput,
  type RecipeId
} from "../domain/stoveCalculator";
import { calculatorText } from "./stoveCalculatorText";
import { uniqueId } from "../lib/id";
import { orderReferenceHtml } from "../domain/orderReferenceHtml";

const DIMENSION_FIELDS: (keyof CalculatorInput)[] = [
  "ceilingHeightMm",
  "firstCourseAboveFloorMm",
  "requiredTopGapMm",
  "availableWidthMm",
  "availableDepthMm"
];
const HEAT_FIELDS: (keyof CalculatorInput)[] = ["areaM2", "indoorC", "outdoorC", "transmissionWK", "airChangesPerHour"];

function download(body: string, mime: string, name: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  // Keep the object URL alive until the browser has accepted the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function StoveCalculator({
  locale,
  input,
  onChange,
  onOpen
}: {
  locale: Locale;
  input: CalculatorInput;
  onChange: (input: CalculatorInput) => void;
  onOpen: (project: ReadyProject) => void;
}) {
  const t = calculatorText(locale);
  const [error, setError] = useState("");
  const heat = useMemo(() => calculateHeatLoss(input), [input]);
  const assessments = useMemo(() => ORDER_RECIPES.map((recipe) => assessRecipe(recipe.id, input)), [input]);
  const invalidFields = inputProblems(input);
  const generate = (id: RecipeId, target: "editor" | "json" | "csv" | "html") => {
    setError("");
    try {
      const order = generateOrderReference(id, input, uniqueId(`calculated-${id}`));
      if (target === "editor") onOpen(order.project);
      else if (target === "html")
        download(orderReferenceHtml(order, locale), "text/html;charset=utf-8", `${id}-reference-sections.html`);
      else if (target === "csv") download(orderPartsCsv(order), "text/csv;charset=utf-8", `${id}-reference-parts.csv`);
      else download(JSON.stringify(order, null, 2), "application/json", `${id}-reference-order.json`);
    } catch {
      setError(t("fail"));
    }
  };
  const fields = (keys: (keyof CalculatorInput)[]) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {keys.map((key) => (
        <label key={key} className="flex min-w-0 flex-col gap-1 text-sm font-bold">
          {t(key)}
          <input
            type="number"
            step="any"
            min={CALCULATOR_RANGES[key][0]}
            max={CALCULATOR_RANGES[key][1]}
            aria-invalid={invalidFields.includes(key)}
            aria-describedby={invalidFields.includes(key) ? `calculator-range-${key}` : undefined}
            inputMode="decimal"
            value={Number.isFinite(input[key]) ? input[key] : ""}
            onChange={(event) => {
              setError("");
              onChange({ ...input, [key]: event.target.value === "" ? Number.NaN : Number(event.target.value) });
            }}
            className="min-h-11 min-w-0 rounded-xl border border-[#3D2B1F]/30 bg-white px-3 text-base text-[#3D2B1F]"
          />
          {invalidFields.includes(key) ? (
            <span id={`calculator-range-${key}`} className="text-xs text-[#A22E0C]">
              {CALCULATOR_RANGES[key][0]}–{CALCULATOR_RANGES[key][1]}
            </span>
          ) : null}
        </label>
      ))}
    </div>
  );
  return (
    <section
      data-testid="stove-calculator"
      className="space-y-5 rounded-[26px] border-2 border-[#3D2B1F]/15 bg-[#FFF7E8] p-4 sm:p-6"
    >
      <div>
        <h1 className="text-xl font-black sm:text-2xl">{t("title")}</h1>
        <p className="mt-2 max-w-4xl text-sm">{t("intro")}</p>
        <p className="mt-2 text-sm font-bold">{t("examples")}</p>
      </div>
      <fieldset className="space-y-3">
        <legend className="mb-3 font-black">{t("dimensions")}</legend>
        {fields(DIMENSION_FIELDS)}
        <p className="text-xs leading-5">{t("clearanceHint")}</p>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-3 font-black">{t("heat")}</legend>
        {fields(HEAT_FIELDS)}
        <p className="text-xs leading-5">{t("heatHint")}</p>
        <output className="block rounded-xl bg-[#3D2B1F] p-3 font-bold text-white" aria-live="polite">
          {t("load")}: {heat ? `${heat.totalKw.toFixed(2)} ${t("kw")}` : "—"}
        </output>
      </fieldset>
      <div>
        <h2 className="font-black">{t("schemes")}</h2>
        <p className="mt-2 rounded-xl border border-[#C1440E]/40 bg-[#C1440E]/5 p-3 text-sm">{t("construction")}</p>
        <p className="mt-2 text-sm">{t("excluded")}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {ORDER_RECIPES.map((recipe, i) => {
          const a = assessments[i];
          return (
            <article key={recipe.id} className="min-w-0 space-y-3 rounded-2xl border border-[#3D2B1F]/20 bg-white p-4">
              <h3 className="text-lg font-black">{recipe.project.title[locale]}</h3>
              <a href={recipe.sourceUrl} className="text-sm underline" target="_blank" rel="noreferrer">
                {recipe.source}
              </a>
              <p className="text-sm">
                {t("size")}: {Math.ceil(a.bounds.widthMm)} × {Math.ceil(a.bounds.depthMm)} ×{" "}
                {Math.ceil(a.bounds.heightMm)} mm
                <br />
                {recipe.project.rowCount} {t("rows")} · {Object.values(recipe.project.rows).flat().length} {t("pieces")}
                <br />
                {t("gap")}: {Number.isFinite(a.actualTopGapMm) ? Math.round(a.actualTopGapMm) : "—"} mm
              </p>
              <p className="font-bold">{t(a.canGenerateReference ? "compatible" : "incompatible")}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {a.issues.map((issue) => (
                  <li key={issue}>{t(issue)}</li>
                ))}
              </ul>
              <div className="flex flex-col gap-2">
                {(["editor", "html", "json", "csv"] as const).map((target) => (
                  <button
                    key={target}
                    type="button"
                    disabled={!a.canGenerateReference}
                    onClick={() => generate(recipe.id, target)}
                    className="min-h-11 rounded-xl bg-[#3D2B1F] px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t(
                      target === "editor"
                        ? "open"
                        : target === "json"
                          ? "download"
                          : target === "html"
                            ? "sheet"
                            : "csv"
                    )}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="font-bold text-[#A22E0C]">
          {error}
        </p>
      ) : null}
      <p className="text-xs leading-5">{t("preserved")}</p>
    </section>
  );
}
