import { useCallback, useEffect, useState } from "react";
import { loadCustomBricks, saveCustomBricks, type StoredCustomBrick } from "../storage/customBricks";
import { uniqueId } from "../lib/id";
import type { CustomBrickSpec } from "../domain/types";

/** Палитра нарезанных в резаке кирпичей (localStorage, на логин). */
export function useCustomBricks(login: string) {
  const [customBricks, setCustomBricks] = useState<StoredCustomBrick[]>([]);

  useEffect(() => {
    setCustomBricks(loadCustomBricks(login));
  }, [login]);

  // Запись в localStorage — вне setState-updater'а: updater обязан быть чистым
  // (в StrictMode он выполняется дважды).
  const addCustomBrick = useCallback(
    (spec: CustomBrickSpec) => {
      const item: StoredCustomBrick = { id: uniqueId("cb"), spec };
      const next = [...loadCustomBricks(login), item];
      saveCustomBricks(login, next);
      setCustomBricks(next);
      return item;
    },
    [login]
  );

  const removeCustomBrick = useCallback(
    (id: string) => {
      const next = loadCustomBricks(login).filter((item) => item.id !== id);
      saveCustomBricks(login, next);
      setCustomBricks(next);
    },
    [login]
  );

  return { customBricks, addCustomBrick, removeCustomBrick };
}
