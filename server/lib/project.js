import { slugify } from "./normalize.js";

export function normalizeProject(project) {
  const plain = typeof project.toObject === "function" ? project.toObject() : project;
  const rows = plain.rows instanceof Map ? Object.fromEntries(plain.rows) : plain.rows || {};

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
