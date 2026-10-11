import { damperBladeDetails, damperName } from "./damperDetails";
import { damperAperture } from "../domain/geometry";
import type { PlacedBrick } from "../domain/types";
import type { Translate } from "../i18n";

/** Read the selected saved element, never infer identity or installation from a demo ID. */
export function DamperExplanation({ brick, t }: { brick: PlacedBrick; t: Translate }) {
  if (brick.kind !== "damper") return null;
  const details = damperBladeDetails(brick);
  const aperture = damperAperture(brick);
  const fraction = aperture.openAreaMm2 / aperture.fullAreaMm2;
  const upward = brick.custom?.damperPlane === "vertical" && (brick.custom.damperSlide ?? "up") === "up";
  return (
    <aside className="damper-explanation" aria-label={t("damper")}>
      <strong>
        {damperName(brick, t)} · {t(fraction === 0 ? "damperClosed" : fraction === 1 ? "damperOpen" : "damperPartial")}{" "}
        ({Math.round(fraction * 100)}%)
      </strong>
      <p className="damper-explanation-text">
        {t("damperInstalledRow")} {brick.row}. {t(upward ? "damperRaisedExplanation" : "damperSlidingExplanation")}
      </p>
      <p>
        {t("damperBladeHeight")} {Number(details.bottom.toFixed(2))}–{Number(details.top.toFixed(2))} {t("damperMm")};{" "}
        {t("damperBladeRows")} {details.firstRow}–{details.lastRow}.
      </p>
      <small>{t("damperSchematicExplanation")}</small>
    </aside>
  );
}
