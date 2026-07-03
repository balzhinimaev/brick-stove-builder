import path from "node:path";
import { fileURLToPath } from "node:url";
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

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "5mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, mongoConnected: mongoReady() });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/draft", draftRouter);
  app.use("/api/leads", leadsRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/showcase", showcaseRouter);

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
    res.status(500).json({ error: error.message || "Internal server error" });
  });

  return app;
}
