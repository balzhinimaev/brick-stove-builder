import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import cors from "cors";
import express from "express";
import { mongoReady } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { draftRouter } from "./routes/draft.js";
import { leadsRouter } from "./routes/leads.js";
import { projectsRouter } from "./routes/projects.js";
import { showcaseRouter } from "./routes/showcase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(path.resolve(__dirname, ".."), "dist");

export function createApp(config) {
  const app = express();

  // За nginx на 127.0.0.1: req.ip берётся из X-Forwarded-For (первый прокси).
  app.set("trust proxy", 1);

  app.use(compression());
  // Базовые security-заголовки (CSP не ставим: inline-стили лендинга и blob-воркеры three.js).
  app.use((_req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.set("X-Frame-Options", "SAMEORIGIN");
    res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "5mb" }));

  // Лог API-запросов: метод, путь, статус, длительность (статику не шумим).
  app.use("/api", (req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      console.log(`${req.method} ${req.baseUrl}${req.url} ${res.statusCode} ${Date.now() - startedAt}ms`);
    });
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, mongoConnected: mongoReady() });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/draft", draftRouter);
  app.use("/api/leads", leadsRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/showcase", showcaseRouter);
  // Неизвестный API-эндпоинт — JSON 404, а не HTML SPA-фолбэка.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // HTML нельзя кэшировать (иначе после деплоя браузер держит ссылки на
  // исчезнувшие хэшированные чанки и 3D-редактор падает); /assets/* с хэшем в
  // имени — наоборот, кэшируются намертво.
  const noStore = (res) => res.set("Cache-Control", "no-cache");

  app.get(["/landing", "/mastera"], (_req, res) => {
    noStore(res).sendFile(path.join(distDir, "landing.html"));
  });

  app.use(
    express.static(distDir, {
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.set("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          noStore(res);
        }
      }
    })
  );
  app.get(/.*/, (_req, res) => {
    noStore(res).sendFile(path.join(distDir, "index.html"));
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    // Клиенту — без деталей: error.message может раскрывать внутренности.
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
