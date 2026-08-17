import { DEFAULT_CAMERA } from "../constants";
import { cloneRows, gridFromParameters, overlaps3D, placeBricksInRows, pruneRowsToGrid, removeBrickAt } from "../geometry";
import { PARAM_BOUNDS, clamp } from "../parameters";
import type { PlacedBrick } from "../types";
import { damperSpecFromMm, doorSpecFromMm, grateSpecFromMm, plateSpecFromMm } from "./specs";
import { initialEditorState } from "./state";
import type { EditorAction, EditorState } from "./types";

const CAMERA_ZOOM_MIN = 0.65;
const CAMERA_ZOOM_MAX = 1.55;

function isLocked(state: EditorState, row = state.currentRow): boolean {
  return state.lockedRows.includes(row);
}

function withRow(state: EditorState, bricks: PlacedBrick[]): EditorState {
  return { ...state, rows: { ...state.rows, [state.currentRow]: bricks } };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "setCurrentRow":
      return { ...state, currentRow: action.row };
    case "setTool":
      return { ...state, activeTool: action.tool };
    case "setOrientation":
      return { ...state, orientation: action.orientation };
    case "setNotchCorner":
      return { ...state, notchCorner: action.corner };
    case "setRebateDepth":
      return { ...state, rebateDepthMm: clamp(Math.round(action.depthMm), 5, 65) };
    case "setSnapStep":
      return { ...state, snapStep: action.step };
    case "pickCustomBrick":
      return { ...state, activeTool: "custom", customBrick: action.spec };
    case "setPlateSize":
      return { ...state, plateSpec: plateSpecFromMm(action.lengthMm, action.widthMm, action.thicknessMm, action.flush) };
    case "setDoorSize":
      return { ...state, doorSpec: doorSpecFromMm(action.widthMm, action.heightMm) };
    case "setDamperSize":
      return { ...state, damperSpec: damperSpecFromMm(action.lengthMm, action.widthMm) };
    case "setGrateSize":
      return { ...state, grateSpec: grateSpecFromMm(action.lengthMm, action.widthMm, action.thicknessMm) };

    case "toggleDamper": {
      const row = Object.entries(state.rows).find(([, bricks]) =>
        bricks.some((brick) => brick.id === action.id && brick.kind === "damper")
      );
      if (!row) return state;
      const [key, bricks] = row;
      const next = bricks.map((brick) =>
        brick.id === action.id ? { ...brick, damperOpen: (brick.damperOpen ?? 0) >= 0.5 ? 0 : 1 } : brick
      );
      return { ...state, rows: { ...state.rows, [Number(key)]: next } };
    }
    case "setViewMode":
      return { ...state, viewMode: action.mode };

    case "updateParameter": {
      const bounds = PARAM_BOUNDS[action.key];
      const value = clamp(Math.round(action.value), bounds.min, bounds.max);
      const parameters = { ...state.parameters, [action.key]: value };
      const grid = gridFromParameters(parameters);
      return { ...state, parameters, grid, rows: pruneRowsToGrid(state.rows, grid) };
    }

    case "reset":
      return initialEditorState();

    case "loadProject":
      return {
        ...state,
        parameters: action.project.parameters,
        grid: gridFromParameters(action.project.parameters),
        rows: cloneRows(action.project.rows),
        rowCount: action.project.rowCount,
        currentRow: 1,
        lockedRows: [...action.project.lockedRows],
        viewMode: "3d",
        activeTool: "standard",
        orientation: "h",
        camera: DEFAULT_CAMERA
      };

    case "loadDraft":
      return {
        ...state,
        parameters: action.draft.parameters,
        grid: gridFromParameters(action.draft.parameters),
        rowCount: action.draft.rowCount,
        currentRow: action.draft.currentRow,
        lockedRows: [...action.draft.lockedRows],
        rows: cloneRows(action.draft.rows)
      };

    case "place": {
      if (isLocked(state)) return state;
      // честная 3D-проверка: конфликты считаются по плану И высоте, между рядами
      const rows = placeBricksInRows(state.rows, state.currentRow, action.bricks, state.grid);
      return rows ? { ...state, rows } : state;
    }

    case "erase": {
      if (isLocked(state)) return state;
      const current = state.rows[state.currentRow] ?? [];
      const next = removeBrickAt(current, action.x, action.y);
      // Промах ластика — не событие: иначе он засоряет undo и стирает redo.
      return next.length === current.length ? state : withRow(state, next);
    }

    case "addRow": {
      const next = state.rowCount + 1;
      return { ...state, rowCount: next, currentRow: next };
    }

    case "deleteRow": {
      if (state.rowCount <= 1 || isLocked(state)) return state;
      const deleted = state.currentRow;
      const rows: Record<number, PlacedBrick[]> = {};
      for (const [key, bricks] of Object.entries(state.rows)) {
        const row = Number(key);
        if (row === deleted) continue;
        const target = row > deleted ? row - 1 : row;
        rows[target] = row > deleted ? bricks.map((brick) => ({ ...brick, row: target })) : bricks;
      }
      // Компактация опускает верхнюю кладку на ряд: если она въезжает в объём
      // элемента снизу (дверца, тянущаяся через ряды), удаление отклоняется.
      const shifted = Object.values(rows).flat().filter((brick) => brick.row >= deleted);
      const below = Object.values(rows).flat().filter((brick) => brick.row < deleted);
      if (shifted.some((a) => below.some((b) => overlaps3D(a, b)))) return state;
      const rowCount = state.rowCount - 1;
      return {
        ...state,
        rows,
        rowCount,
        currentRow: Math.min(deleted, rowCount),
        lockedRows: state.lockedRows
          .filter((row) => row !== deleted)
          .map((row) => (row > deleted ? row - 1 : row))
      };
    }

    case "copyRow": {
      if (state.currentRow <= 1 || isLocked(state)) return state;
      const target = state.rows[state.currentRow] ?? [];
      // Плиту, задвижку и колосник, как и везде, молча не стираем — сначала ластик.
      if (target.some((brick) => brick.kind === "plate" || brick.kind === "damper" || brick.kind === "grate")) return state;
      if (!action.bricks.length) return target.length ? withRow(state, []) : state;
      // Копия проходит те же ворота, что и ручное размещение: дверца из
      // нижнего ряда, тянущаяся в текущий, делает копирование невозможным.
      const base = { ...state.rows, [state.currentRow]: [] };
      const rows = placeBricksInRows(base, state.currentRow, action.bricks, state.grid);
      return rows ? { ...state, rows } : state;
    }

    case "clearRow":
      if (isLocked(state) || !(state.rows[state.currentRow] ?? []).length) return state;
      return withRow(state, []);

    case "lockRow":
      return {
        ...state,
        lockedRows: isLocked(state) ? state.lockedRows : [...state.lockedRows, state.currentRow],
        currentRow: Math.min(state.currentRow + 1, state.rowCount)
      };

    case "unlockRow":
      if (!isLocked(state)) return state;
      return { ...state, lockedRows: state.lockedRows.filter((row) => row !== state.currentRow) };

    case "cameraZoom":
      return { ...state, camera: { ...state.camera, zoom: clamp(Number((state.camera.zoom + action.delta).toFixed(2)), CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX) } };
    case "cameraRotate":
      return { ...state, camera: { ...state.camera, angle: (state.camera.angle + action.delta + 360) % 360 } };
    case "cameraPan":
      return { ...state, camera: { ...state.camera, offsetX: state.camera.offsetX + action.dx, offsetY: state.camera.offsetY + action.dy } };
    case "cameraReset":
      return { ...state, camera: DEFAULT_CAMERA };

    default:
      return state;
  }
}
