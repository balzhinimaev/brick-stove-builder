import React from "react";
import type { Translate } from "../i18n";
import type { MaterialsEstimate } from "../domain/types";

export function MaterialsSummary({ materials, t }: { materials: MaterialsEstimate; t: Translate }) {
  return (
    <div className="mt-3 rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] p-3">
      <div className="mb-2 text-lg font-black">{t("materialsSnapshot")}</div>
      <MaterialRow label={t("regularBricks")} value={materials.regularBricks} />
      <MaterialRow label={t("firebricks")} value={materials.firebricks} />
      <MaterialRow label={t("cutBricks")} value={materials.cutBricks} />
      <MaterialRow label={t("grates")} value={materials.grates} />
      <MaterialRow label={t("mortarEstimate")} value={`${materials.mortarM3.toFixed(2)} m³`} />
      <MaterialRow label={t("foundationConcrete")} value={`${materials.concreteVolumeM3.toFixed(2)} m³`} />
    </div>
  );
}

function MaterialRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[#3D2B1F]/10 py-1 text-sm">
      <span className="font-extrabold text-[#3D2B1F]/70">{label}</span>
      <span className="font-black">{value}</span>
    </div>
  );
}
