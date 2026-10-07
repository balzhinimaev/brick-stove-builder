import type React from "react";
import type { Translate } from "../i18n";
import type { MaterialsEstimate } from "../domain/types";
import { formatM3 } from "./format";

export function MaterialsSummary({ materials, t }: { materials: MaterialsEstimate; t: Translate }) {
  return (
    <div className="mt-3 rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] p-3">
      <div className="mb-2 text-lg font-black">{t("materialsSnapshot")}</div>
      <p className="studio-muted">{t("materialsInventoryHint")}</p>
      <dl>
        <MaterialRow label={t("materialsWholePieces")} value={materials.fullPieces ?? materials.regularBricks} />
        <MaterialRow label={t("materialsStraightCuts")} value={materials.rectangularPieces ?? materials.cutBricks} />
        <MaterialRow label={t("materialsShapedPieces")} value={materials.shapedPieces ?? materials.rebatedBricks} />
        <MaterialRow label={t("materialsFireclaySubset")} value={materials.firebricks} />
        <MaterialRow label={t("grates")} value={materials.grates} />
        <MaterialRow label={t("plates")} value={materials.plates} />
        <MaterialRow label={t("doors")} value={materials.doors} />
        <MaterialRow label={t("dampers")} value={materials.dampers} />
        <MaterialRow label={t("vents")} value={materials.vents} />
        {(materials.steelKg ?? 0) > 0 && (
          <MaterialRow label={t("steelApproxKg")} value={(materials.steelKg ?? 0).toFixed(2)} />
        )}
        <MaterialRow
          label={t("mortarEstimate")}
          value={materials.mortarM3 === null ? t("materialsMortarNotCalculated") : formatM3(materials.mortarM3)}
        />
        <MaterialRow label={t("materialsSlabConcrete")} value={formatM3(materials.concreteVolumeM3)} />
      </dl>
      <p className="studio-muted">{t("materialsPurchasingHint")}</p>
    </div>
  );
}

function MaterialRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[#3D2B1F]/10 py-1 text-sm">
      <dt className="font-extrabold text-[#3D2B1F]/70">{label}</dt>
      <dd className="font-black">{value}</dd>
    </div>
  );
}
