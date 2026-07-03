/**
 * Контур прямоугольника с Г-образным (или краевым) вырезом — единый
 * polygon-builder для плана (ячейки), превью палитры (ячейки спецификации)
 * и резака (мм заготовки). Функция безразмерная: работает в единицах caller-а.
 */

export type OutlineRect = { x1: number; y1: number; x2: number; y2: number };

export type NotchedShape =
  | { kind: "rect"; rect: OutlineRect }
  | { kind: "polygon"; points: Array<[number, number]> };

const DEFAULT_EPS = 1e-6;

/**
 * Форма тела «bounds минус notch»:
 * - без выреза — исходный прямоугольник;
 * - вырез-паз во всю грань — оставшийся прямоугольник;
 * - угловой вырез — шестиугольник (Г-образный контур), точки по часовой.
 * Вырез обязан касаться хотя бы одной грани bounds (как у четверти/резака).
 */
export function notchedShape(bounds: OutlineRect, notch: OutlineRect | null, eps: number = DEFAULT_EPS): NotchedShape {
  if (!notch) return { kind: "rect", rect: bounds };

  const west = notch.x1 <= bounds.x1 + eps;
  const north = notch.y1 <= bounds.y1 + eps;
  const fullX = west && notch.x2 >= bounds.x2 - eps;
  const fullY = north && notch.y2 >= bounds.y2 - eps;

  // паз во всю высоту — остаётся вертикальная полоса
  if (fullY) {
    return {
      kind: "rect",
      rect: west
        ? { x1: notch.x2, y1: bounds.y1, x2: bounds.x2, y2: bounds.y2 }
        : { x1: bounds.x1, y1: bounds.y1, x2: notch.x1, y2: bounds.y2 }
    };
  }
  // паз во всю ширину — остаётся горизонтальная полоса
  if (fullX) {
    return {
      kind: "rect",
      rect: north
        ? { x1: bounds.x1, y1: notch.y2, x2: bounds.x2, y2: bounds.y2 }
        : { x1: bounds.x1, y1: bounds.y1, x2: bounds.x2, y2: notch.y1 }
    };
  }

  const points: Array<[number, number]> = west
    ? north
      ? [[notch.x2, bounds.y1], [bounds.x2, bounds.y1], [bounds.x2, bounds.y2], [bounds.x1, bounds.y2], [bounds.x1, notch.y2], [notch.x2, notch.y2]]
      : [[bounds.x1, bounds.y1], [bounds.x2, bounds.y1], [bounds.x2, bounds.y2], [notch.x2, bounds.y2], [notch.x2, notch.y1], [bounds.x1, notch.y1]]
    : north
      ? [[bounds.x1, bounds.y1], [notch.x1, bounds.y1], [notch.x1, notch.y2], [bounds.x2, notch.y2], [bounds.x2, bounds.y2], [bounds.x1, bounds.y2]]
      : [[bounds.x1, bounds.y1], [bounds.x2, bounds.y1], [bounds.x2, notch.y1], [notch.x1, notch.y1], [notch.x1, bounds.y2], [bounds.x1, bounds.y2]];
  return { kind: "polygon", points };
}
