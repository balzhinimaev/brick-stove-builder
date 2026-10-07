/** Общие форматтеры значений сметы для экрана и печати. */

/** Объём в кубометрах: два знака после точки, как в MaterialsSummary. */
export function formatM3(value: number): string {
  return `${value.toFixed(2)} m³`;
}
