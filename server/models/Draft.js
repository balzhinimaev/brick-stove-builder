import mongoose from "mongoose";
import { brickSchema, parametersSchema } from "./Project.js";

/**
 * Незаконченная кладка пользователя — один черновик на логин. Синхронизируется
 * между устройствами: клиент держит копию в localStorage и выбирает более
 * свежую по clientUpdatedAt (метка времени клиента, не сервера).
 */
const draftSchema = new mongoose.Schema(
  {
    ownerLogin: { type: String, required: true, unique: true, trim: true },
    parameters: { type: parametersSchema, required: true },
    rowCount: { type: Number, required: true, min: 1 },
    currentRow: { type: Number, required: true, min: 1 },
    lockedRows: { type: [Number], default: [] },
    rows: { type: Map, of: [brickSchema], default: {} },
    clientUpdatedAt: { type: Number, required: true }
  },
  { timestamps: true }
);

export const Draft = mongoose.model("Draft", draftSchema);
