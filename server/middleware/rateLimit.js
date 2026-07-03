/**
 * In-memory rate limit: скользящее окно per-IP. Достаточно для одного
 * процесса за nginx; при переходе на кластер нужен внешний стор (Redis).
 */
export function rateLimit({ windowMs, max }) {
  const hits = new Map(); // ip -> отметки времени запросов внутри окна

  // Ленивая эвикция: удаляем только протухшие записи, а не clear() —
  // иначе активные нарушители получали бы чистое окно.
  function evictStale(now) {
    if (hits.size <= 10_000) return;
    for (const [ip, timestamps] of hits) {
      if (timestamps[timestamps.length - 1] <= now - windowMs) hits.delete(ip);
    }
  }

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    evictStale(now);

    const ip = req.ip || "unknown";
    const recent = (hits.get(ip) ?? []).filter((t) => t > now - windowMs);
    if (recent.length >= max) {
      hits.set(ip, recent);
      return res.status(429).json({ error: "Слишком много запросов. Попробуйте позже." });
    }
    recent.push(now);
    hits.set(ip, recent);
    next();
  };
}
