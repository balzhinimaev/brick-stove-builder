/**
 * Раскладка конфорок варочной плиты — единая логика для 2D-плана и 3D-сцены.
 * Размеры принимаются в ЯЧЕЙКАХ сетки (1 ячейка = 125 мм).
 */

const MM_PER_CELL = 125;

/** Порог длинной стороны, начиная с которого плита двухконфорочная. */
const TWO_BURNER_MIN_MM = 550;

/** 1 или 2 конфорки в зависимости от длинной стороны плиты (порог 550 мм). */
export function plateBurnerCount(wCells: number, hCells: number): number {
  return Math.max(wCells, hCells) * MM_PER_CELL >= TWO_BURNER_MIN_MM ? 2 : 1;
}

/**
 * Центры конфорок как доли размера плиты (0..1 по каждой оси, [0.5, 0.5] —
 * центр). Конфорки раскладываются вдоль длинной стороны: одна — по центру,
 * две — на четвертях длины.
 */
export function plateBurnerCenters(wCells: number, hCells: number): Array<[number, number]> {
  if (plateBurnerCount(wCells, hCells) < 2) return [[0.5, 0.5]];
  return wCells >= hCells
    ? [[0.25, 0.5], [0.75, 0.5]]
    : [[0.5, 0.25], [0.5, 0.75]];
}
