export function normalizeLogin(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

/** Mongoose отдаёт rows как Map — приводим к plain object для JSON-ответа. */
export function rowsToObject(rows) {
  return rows instanceof Map ? Object.fromEntries(rows) : rows || {};
}

export function slugify(value) {
  return (
    String(value || "project")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "project"
  );
}
