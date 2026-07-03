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

  const addCustomBrick = useCallback(
    (spec: CustomBrickSpec) => {
      const item: StoredCustomBrick = { id: uniqueId("cb"), spec };
      setCustomBricks((current) => {
        const next = [...current, item];
        saveCustomBricks(login, next);
        return next;
      });
      return item;
    },
    [login]
  );

  const removeCustomBrick = useCallback(
    (id: string) => {
      setCustomBricks((current) => {
        const next = current.filter((item) => item.id !== id);
        saveCustomBricks(login, next);
        return next;
      });
    },
    [login]
  );

  return { customBricks, addCustomBrick, removeCustomBrick };
}
