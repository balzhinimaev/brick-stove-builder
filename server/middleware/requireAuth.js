import { config } from "../config.js";
import { verifyToken } from "../lib/token.js";

/**
 * Derives the caller's login from a verified Bearer token. Unlike the old
 * `x-user-login` header, this cannot be spoofed to impersonate another user.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const payload = token ? verifyToken(token, config.authSecret) : null;
  if (!payload) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  req.userLogin = payload.login;
  next();
}
