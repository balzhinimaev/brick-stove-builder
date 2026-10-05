import { useCallback, useEffect, useRef, useState } from "react";
import { loadCustomBricks, saveCustomBricks, type StoredCustomBrick } from "../storage/customBricks";
import { uniqueId } from "../lib/id";
import type { CustomBrickSpec } from "../domain/types";

/** Палитра нарезанных в резаке кирпичей (localStorage, на логин). */
export function useCustomBricks(login: string) {
  const [customBricks, setCustomBricks] = useState<StoredCustomBrick[]>([]);

  const pending = useRef<{ login: string; bricks: StoredCustomBrick[] } | null>(null);

  useEffect(() => {
    pending.current = null;
    setCustomBricks(loadCustomBricks(login));
  }, [login]);

  // Запись в localStorage — вне setState-updater'а: updater обязан быть чистым
  // (в StrictMode он выполняется дважды).
  const addCustomBrick = useCallback(
    (spec: CustomBrickSpec) => {
      const item: StoredCustomBrick = { id: uniqueId("cb"), spec };
      const current = pending.current?.login === login ? pending.current.bricks : loadCustomBricks(login);
      const next = [...current, item];
      pending.current = saveCustomBricks(login, next) ? null : { login, bricks: next };
      setCustomBricks(next);
      return item;
    },
    [login]
  );

  const removeCustomBrick = useCallback(
    (id: string) => {
      const current = pending.current?.login === login ? pending.current.bricks : loadCustomBricks(login);
      const next = current.filter((item) => item.id !== id);
      pending.current = saveCustomBricks(login, next) ? null : { login, bricks: next };
      setCustomBricks(next);
    },
    [login]
  );

  return { customBricks, addCustomBrick, removeCustomBrick };
}
