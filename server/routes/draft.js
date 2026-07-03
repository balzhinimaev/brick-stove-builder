import { Router } from "express";
import { Draft } from "../models/Draft.js";
import { requireMongo } from "../middleware/requireMongo.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const draftRouter = Router();

draftRouter.use(requireMongo, requireAuth);

function normalizeDraft(draft) {
  const plain = typeof draft.toObject === "function" ? draft.toObject() : draft;
  return {
    parameters: plain.parameters,
    rowCount: plain.rowCount,
    currentRow: plain.currentRow,
    lockedRows: plain.lockedRows || [],
    rows: plain.rows instanceof Map ? Object.fromEntries(plain.rows) : plain.rows || {},
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
    const draft = await Draft.findOneAndUpdate(
      { ownerLogin: req.userLogin },
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
    res.json({ ok: true, draft: normalizeDraft(draft) });
  } catch (error) {
    next(error);
  }
});
