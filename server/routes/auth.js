import { Router } from "express";
import { config } from "../config.js";
import { User } from "../models/User.js";
import { requireMongo } from "../middleware/requireMongo.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { normalizeLogin } from "../lib/normalize.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { signToken } from "../lib/token.js";

const MIN_LOGIN_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 6;
// scrypt на очень длинном вводе — дешёвый способ нагрузить CPU сервера.
const MAX_PASSWORD_LENGTH = 256;

export const authRouter = Router();

authRouter.use(rateLimit({ windowMs: 60_000, max: 10 }));

function readCredentials(body) {
  return { login: normalizeLogin(body?.login), password: String(body?.password ?? "") };
}

authRouter.post("/register", requireMongo, async (req, res, next) => {
  try {
    const { login, password } = readCredentials(req.body);
    if (!login || login.length < MIN_LOGIN_LENGTH) return res.status(400).json({ error: "Login must be at least 3 chars" });
    if (password.length < MIN_PASSWORD_LENGTH) return res.status(400).json({ error: "Password must be at least 6 chars" });
    if (password.length > MAX_PASSWORD_LENGTH) return res.status(400).json({ error: "Password is too long" });

    const existing = await User.findOne({ login }).lean();
    if (existing) return res.status(409).json({ error: "Login already taken" });

    await User.create({ login, passwordHash: await hashPassword(password) });
    res.status(201).json({ ok: true, login, token: signToken(login, config.authSecret) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", requireMongo, async (req, res, next) => {
  try {
    const { login, password } = readCredentials(req.body);
    if (!login || !password) return res.status(400).json({ error: "Invalid credentials" });
    if (password.length > MAX_PASSWORD_LENGTH) return res.status(400).json({ error: "Password is too long" });

    const user = await User.findOne({ login });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid login or password" });
    }

    res.json({ ok: true, login, token: signToken(login, config.authSecret) });
  } catch (error) {
    next(error);
  }
});
