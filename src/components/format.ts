/** Общие форматтеры значений сметы для экрана и печати. */

/** Объём в кубометрах: два знака после точки, как в MaterialsSummary. */
export function formatM3(value: number | null): string {
  return value === null ? "Не рассчитан по швам" : `${value.toFixed(2)} m³`;
}
