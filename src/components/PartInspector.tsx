import { useState } from "react";
import { brickPhysicalSolids, polyhedronVolumeMm3, solidPolyhedron } from "../domain/geometry";
import { isMasonryPiece, masonryDimensions } from "../domain/masonryAudit";
import { resizedMasonry } from "../domain/editor/partEdit";
import type { PlacedBrick } from "../domain/types";

export function PartInspector({
  brick,
  number,
  locked,
  rowCount,
  onEdit,
  onRemove,
  onFocus,
  onIsolate,
  isolated,
  onReview,
  onInstallationRow
}: {
  brick: PlacedBrick;
  number: string;
  locked: boolean;
  rowCount: number;
  onEdit: (id: string, b: PlacedBrick, duplicate?: boolean) => string | null;
  onRemove: (id: string) => void;
  onFocus: () => void;
  onIsolate: () => void;
  isolated: boolean;
  onReview: () => void;
  onInstallationRow: () => void;
}) {
  const [x, setX] = useState(brick.x * 125),
    [y, setY] = useState(brick.y * 125),
    [row, setRow] = useState(brick.row);
  const [orientation, setOrientation] = useState(brick.orientation);
  const originalDimensions = masonryDimensions(brick);
  const [dimensions, setDimensions] = useState(originalDimensions);
  const [error, setError] = useState("");
  const volume = brickPhysicalSolids(brick).reduce((s, p) => s + polyhedronVolumeMm3(solidPolyhedron(p)), 0) / 1e9;
  const density =
    brick.custom?.material === "steel" || !isMasonryPiece(brick)
      ? 7850
      : brick.kind === "firebrick" || brick.custom?.cutFrom === "firebrick"
        ? 1900
        : 1800;
  const apply = (duplicate = false) => {
    try {
      const resized = dimensions.every((n, i) => Math.abs(n - originalDimensions[i]) < 1e-6)
        ? brick
        : resizedMasonry(brick, dimensions);
      const result = onEdit(brick.id, { ...resized, x: x / 125, y: y / 125, row, orientation }, duplicate);
      setError(result ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Изменение не применено");
    }
  };
  return (
    <section className="part-inspector">
      <header>
        <span className="project-eyebrow">ВЫБРАННАЯ ДЕТАЛЬ</span>
        <h3>№ {number}</h3>
        <p>{brick.custom?.name ?? brick.kind}</p>
      </header>
      <div className="part-actions">
        <button type="button" onClick={onFocus}>
          Приблизить
        </button>
        <button type="button" aria-pressed={isolated} onClick={onIsolate}>
          {isolated ? "Вся кладка" : "Изолировать"}
        </button>
        <button type="button" onClick={onInstallationRow}>
          Ряд установки {brick.row}
        </button>
        <button type="button" onClick={onReview}>
          Проверки и сечение
        </button>
      </div>
      <p>
        {originalDimensions.map((n) => n.toFixed(1)).join(" × ")} мм · ≈ {(volume * density).toFixed(2)} кг
      </p>
      <small>
        Материал: {density === 7850 ? "металл" : density === 1900 ? "шамот" : "кирпич"}. Масса по геометрии и принятой
        плотности {density} кг/м³, без раствора.
      </small>
      {locked && <p className="part-locked">Ряд заблокирован. Для правки разблокируйте его.</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <fieldset disabled={locked}>
          <legend>Точное редактирование</legend>
          <div className="part-fields">
            <label>
              X, мм
              <input type="number" step="0.1" value={x} onChange={(e) => setX(e.target.valueAsNumber)} />
            </label>
            <label>
              Y, мм
              <input type="number" step="0.1" value={y} onChange={(e) => setY(e.target.valueAsNumber)} />
            </label>
            <label>
              Ряд установки
              <input
                type="number"
                min="1"
                max={rowCount}
                value={row}
                onChange={(e) => setRow(e.target.valueAsNumber)}
              />
            </label>
            <label>
              Ориентация
              <select value={orientation} onChange={(e) => setOrientation(e.target.value as "h" | "v")}>
                <option value="h">Вдоль X</option>
                <option value="v">Вдоль Y · 90°</option>
              </select>
            </label>
            {isMasonryPiece(brick) &&
              dimensions.map((n, i) => (
                <label key={["X", "Y", "Z"][i]}>
                  Габарит {["X", "Y", "Z"][i]}, мм
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={n}
                    onChange={(e) => setDimensions((d) => d.map((v, j) => (i === j ? e.target.valueAsNumber : v)))}
                  />
                </label>
              ))}
          </div>
          <small>Размеры относительно текущей ориентации. Поворот выполняется после изменения размеров.</small>
          <div className="part-actions">
            <button type="submit" className="studio-primary">
              Применить
            </button>
            <button type="button" onClick={() => apply(true)}>
              Добавить копию
            </button>
            <button type="button" onClick={() => onRemove(brick.id)}>
              Удалить
            </button>
          </div>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="project-error">
          {error}
        </p>
      )}
      <details>
        <summary>Номер в файле</summary>
        <code>{brick.id}</code>
      </details>
      <p className="studio-muted">
        Правки проверяются на пересечения и границы основания. Отменяются одной командой ↶. Опирание после изменения
        проверяется отдельно.
      </p>
    </section>
  );
}
