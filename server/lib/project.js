import mongoose from "mongoose";
import { rowsToObject, slugify } from "./normalize.js";

/** Проект адресуется и по ObjectId, и по slug — фильтр выбираем по формату id. */
export function idQuery(id, extra = {}) {
  return mongoose.Types.ObjectId.isValid(id) ? { _id: id, ...extra } : { slug: id, ...extra };
}

export function normalizeProject(project) {
  const plain = typeof project.toObject === "function" ? project.toObject() : project;
  const rows = rowsToObject(plain.rows);

  return {
    id: plain.slug || String(plain._id),
    title: plain.title,
    subtitle: plain.subtitle,
    parameters: plain.parameters,
    rowCount: plain.rowCount,
    lockedRows: plain.lockedRows || [],
    rows,
    accent: plain.accent || "#C1440E",
    ownerLogin: plain.ownerLogin,
    showcase: {
      published: Boolean(plain.showcase?.published),
      description: plain.showcase?.description || "",
      price: plain.showcase?.price ?? null,
      region: plain.showcase?.region || "",
      publishedAt: plain.showcase?.publishedAt ?? null
    },
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
}

export function projectPayload(body) {
  const title = body.title || {};
  const baseTitle = title.ru || title.en || title.lt || body.name || "Новый проект";
  return {
    slug: body.slug || `${slugify(baseTitle)}-${Date.now().toString(36)}`,
    title: { ru: title.ru || baseTitle, en: title.en || baseTitle, lt: title.lt || baseTitle },
    subtitle: body.subtitle || {},
    parameters: body.parameters,
    rowCount: body.rowCount,
    lockedRows: body.lockedRows || [],
    rows: body.rows || {},
    accent: body.accent || "#C1440E"
  };
}
