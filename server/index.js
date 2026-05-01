import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const app = express();
const port = Number(process.env.PORT || 4174);
const mongoUri = process.env.MONGODB_URI;

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: "5mb" }));

const localizedTextSchema = new mongoose.Schema(
  {
    ru: { type: String, default: "" },
    en: { type: String, default: "" },
    lt: { type: String, default: "" }
  },
  { _id: false }
);

const parametersSchema = new mongoose.Schema(
  {
    foundationWidth: { type: Number, required: true, min: 1 },
    foundationLength: { type: Number, required: true, min: 1 },
    foundationThickness: { type: Number, required: true, min: 1 },
    roomHeight: { type: Number, required: true, min: 1 }
  },
  { _id: false }
);

const brickSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    x: { type: Number, required: true, min: 0 },
    y: { type: Number, required: true, min: 0 },
    row: { type: Number, required: true, min: 1 },
    kind: { type: String, enum: ["standard", "cut", "trim", "firebrick", "vent", "cleanout", "grate"], required: true },
    orientation: { type: String, enum: ["h", "v"], required: true }
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true, sparse: true, trim: true },
    title: { type: localizedTextSchema, required: true },
    subtitle: { type: localizedTextSchema, default: () => ({}) },
    parameters: { type: parametersSchema, required: true },
    rowCount: { type: Number, required: true, min: 1 },
    lockedRows: { type: [Number], default: [] },
    rows: { type: Map, of: [brickSchema], default: {} },
    accent: { type: String, default: "#C1440E" },
    ownerLogin: { type: String, required: true, trim: true, index: true }
  },
  { timestamps: true }
);

projectSchema.index({ updatedAt: -1 });

const Project = mongoose.model("Project", projectSchema);

const userSchema = new mongoose.Schema(
  {
    login: { type: String, required: true, unique: true, trim: true }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

function requireMongo(_req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ error: "MongoDB is not connected. Set MONGODB_URI and restart the server." });
    return;
  }
  next();
}

function normalizeProject(project) {
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

function slugify(value) {
  return String(value || "project")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "project";
}

function projectPayload(body) {
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mongoConnected: mongoose.connection.readyState === 1 });
});

function normalizeLogin(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

function requireLogin(req, res, next) {
  const login = normalizeLogin(req.headers["x-user-login"] || req.query.login || req.body?.login);
  if (!login) {
    res.status(401).json({ error: "Login is required" });
    return;
  }
  req.userLogin = login;
  next();
}

app.post("/api/auth/register", requireMongo, async (req, res, next) => {
  try {
    const login = normalizeLogin(req.body?.login);
    if (!login) return res.status(400).json({ error: "Invalid login" });
    if (login.length < 3) return res.status(400).json({ error: "Login must be at least 3 chars" });

    const existing = await User.findOne({ login }).lean();
    if (existing) return res.status(409).json({ error: "Login already taken" });

    await User.create({ login });
    res.status(201).json({ ok: true, login });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", requireMongo, async (req, res, next) => {
  try {
    const login = normalizeLogin(req.body?.login);
    if (!login) return res.status(400).json({ error: "Invalid login" });

    const user = await User.findOne({ login }).lean();
    if (!user) return res.status(404).json({ error: "Login not found" });

    res.json({ ok: true, login });
  } catch (error) {
    next(error);
  }
});


app.get("/api/projects", requireMongo, requireLogin, async (req, res, next) => {
  try {
    const projects = await Project.find({ ownerLogin: req.userLogin }).sort({ updatedAt: -1 }).lean();
    res.json({ projects: projects.map(normalizeProject) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:id", requireMongo, requireLogin, async (req, res, next) => {
  try {
    const query = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id, ownerLogin: req.userLogin }
      : { slug: req.params.id, ownerLogin: req.userLogin };
    const project = await Project.findOne(query);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({ project: normalizeProject(project) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects", requireMongo, requireLogin, async (req, res, next) => {
  try {
    const project = await Project.create({ ...projectPayload(req.body), ownerLogin: req.userLogin });
    res.status(201).json({ project: normalizeProject(project) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/projects/:id", requireMongo, requireLogin, async (req, res, next) => {
  try {
    const query = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id, ownerLogin: req.userLogin }
      : { slug: req.params.id, ownerLogin: req.userLogin };
    const project = await Project.findOneAndUpdate(query, { ...projectPayload(req.body), ownerLogin: req.userLogin }, { new: true, runValidators: true });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({ project: normalizeProject(project) });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(distDir));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Internal server error" });
});

async function start() {
  if (mongoUri) {
    await mongoose.connect(mongoUri, {
      dbName: "brickstove"
    });
    console.log("MongoDB connected");
  } else {
    console.warn("MONGODB_URI is not set. API project routes will return 503 until MongoDB is configured.");
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
