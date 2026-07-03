import { Router } from "express";
import { Project } from "../models/Project.js";
import { requireMongo } from "../middleware/requireMongo.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { idQuery, normalizeProject, projectPayload } from "../lib/project.js";

const MAX_PROJECTS_PER_USER = 100;

export const projectsRouter = Router();

projectsRouter.use(requireMongo, requireAuth);

function ownedQuery(id, ownerLogin) {
  return idQuery(id, { ownerLogin });
}

projectsRouter.get("/", async (req, res, next) => {
  try {
    const projects = await Project.find({ ownerLogin: req.userLogin }).sort({ updatedAt: -1 }).lean();
    res.json({ projects: projects.map(normalizeProject) });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get("/:id", async (req, res, next) => {
  try {
    const project = await Project.findOne(ownedQuery(req.params.id, req.userLogin));
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({ project: normalizeProject(project) });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post("/", async (req, res, next) => {
  try {
    const count = await Project.countDocuments({ ownerLogin: req.userLogin });
    if (count >= MAX_PROJECTS_PER_USER) {
      return res.status(400).json({ error: "Достигнут лимит проектов" });
    }
    const payload = projectPayload(req.body);
    const project = await Project.create({ ...payload, ownerLogin: req.userLogin });
    res.status(201).json({ project: normalizeProject(project) });
  } catch (error) {
    // Клиент шлёт свой id как slug: повтор из офлайн-очереди (ответ потерялся,
    // документ уже создан) — идемпотентно возвращаем существующий.
    if (error?.code === 11000) {
      const existing = await Project.findOne({ slug: req.body?.slug, ownerLogin: req.userLogin }).catch(() => null);
      if (existing) return res.status(200).json({ project: normalizeProject(existing) });
      return res.status(409).json({ error: "Проект с таким идентификатором уже существует" });
    }
    next(error);
  }
});

projectsRouter.post("/:id/publish", async (req, res, next) => {
  try {
    const description = String(req.body?.description ?? "").trim().slice(0, 1000);
    const priceRaw = Number(req.body?.price);
    const price = Number.isFinite(priceRaw) && priceRaw >= 0 ? Math.round(priceRaw) : null;
    const region = String(req.body?.region ?? "").trim().slice(0, 100);

    const project = await Project.findOneAndUpdate(
      ownedQuery(req.params.id, req.userLogin),
      { showcase: { published: true, description, price, region, publishedAt: new Date() } },
      { new: true, runValidators: true }
    );
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({ project: normalizeProject(project) });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post("/:id/unpublish", async (req, res, next) => {
  try {
    const project = await Project.findOneAndUpdate(
      ownedQuery(req.params.id, req.userLogin),
      {
        "showcase.published": false,
        "showcase.publishedAt": null
      },
      { new: true, runValidators: true }
    );
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({ project: normalizeProject(project) });
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete("/:id", async (req, res, next) => {
  try {
    const project = await Project.findOneAndDelete(ownedQuery(req.params.id, req.userLogin));
    if (!project) return res.status(404).json({ error: "Project not found" });
    // Вместе с документом проект автоматически пропадает и с витрины.
    res.json({ ok: true, id: normalizeProject(project).id });
  } catch (error) {
    next(error);
  }
});

projectsRouter.put("/:id", async (req, res, next) => {
  try {
    const project = await Project.findOneAndUpdate(
      ownedQuery(req.params.id, req.userLogin),
      { ...projectPayload(req.body), ownerLogin: req.userLogin },
      { new: true, runValidators: true }
    );
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({ project: normalizeProject(project) });
  } catch (error) {
    next(error);
  }
});
