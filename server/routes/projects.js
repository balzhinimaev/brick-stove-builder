import { Router } from "express";
import mongoose from "mongoose";
import { Project } from "../models/Project.js";
import { requireMongo } from "../middleware/requireMongo.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { normalizeProject, projectPayload } from "../lib/project.js";

export const projectsRouter = Router();

projectsRouter.use(requireMongo, requireAuth);

function ownedQuery(id, ownerLogin) {
  return mongoose.Types.ObjectId.isValid(id)
    ? { _id: id, ownerLogin }
    : { slug: id, ownerLogin };
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
    const project = await Project.create({ ...projectPayload(req.body), ownerLogin: req.userLogin });
    res.status(201).json({ project: normalizeProject(project) });
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
