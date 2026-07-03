import { Router } from "express";
import { Draft } from "../models/Draft.js";
import { requireMongo } from "../middleware/requireMongo.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { rowsToObject } from "../lib/normalize.js";

export const draftRouter = Router();

draftRouter.use(requireMongo, requireAuth);

function normalizeDraft(draft) {
  const plain = typeof draft.toObject === "function" ? draft.toObject() : draft;
  return {
    parameters: plain.parameters,
    rowCount: plain.rowCount,
    currentRow: plain.currentRow,
    lockedRows: plain.lockedRows || [],
    rows: rowsToObject(plain.rows),
    updatedAt: plain.clientUpdatedAt
  };
}

draftRouter.get("/", async (req, res, next) => {
  try {
    const draft = await Draft.findOne({ ownerLogin: req.userLogin });
    res.json({ draft: draft ? normalizeDraft(draft) : null });
  } catch (error) {
    next(error);
  }
});

draftRouter.put("/", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const clientUpdatedAt = Number(body.updatedAt) || Date.now();
    let draft;
    try {
      // Условный upsert: обновляем, только если клиентская метка не старше
      // серверной — иначе фильтр не совпадает и upsert падает на unique(ownerLogin).
      draft = await Draft.findOneAndUpdate(
        { ownerLogin: req.userLogin, clientUpdatedAt: { $lte: clientUpdatedAt } },
        {
          ownerLogin: req.userLogin,
          parameters: body.parameters,
          rowCount: body.rowCount,
          currentRow: body.currentRow,
          lockedRows: body.lockedRows || [],
          rows: body.rows || {},
          clientUpdatedAt
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      // 11000 = duplicate key: на сервере черновик новее — отдаём его клиенту.
      if (error?.code !== 11000) throw error;
      const current = await Draft.findOne({ ownerLogin: req.userLogin });
      return res.status(409).json({ ok: false, stale: true, draft: current ? normalizeDraft(current) : null });
    }
    res.json({ ok: true, draft: normalizeDraft(draft) });
  } catch (error) {
    next(error);
  }
});
