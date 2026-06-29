import { mongoReady } from "../db.js";

export function requireMongo(_req, res, next) {
  if (!mongoReady()) {
    res.status(503).json({ error: "MongoDB is not connected. Set MONGODB_URI and restart the server." });
    return;
  }
  next();
}
