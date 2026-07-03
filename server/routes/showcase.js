import { Router } from "express";
import { Project } from "../models/Project.js";
import { requireMongo } from "../middleware/requireMongo.js";
import { idQuery, normalizeProject } from "../lib/project.js";

/** Public catalog of published stove projects — no auth: this is what customers browse. */
export const showcaseRouter = Router();

showcaseRouter.use(requireMongo);

showcaseRouter.get("/", async (_req, res, next) => {
  try {
    const projects = await Project.find({ "showcase.published": true })
      .sort({ "showcase.publishedAt": -1 })
      .limit(200)
      .lean();
    res.json({ projects: projects.map(normalizeProject) });
  } catch (error) {
    next(error);
  }
});

showcaseRouter.get("/:id", async (req, res, next) => {
  try {
    const project = await Project.findOne(idQuery(req.params.id, { "showcase.published": true }));
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({ project: normalizeProject(project) });
  } catch (error) {
    next(error);
  }
});
