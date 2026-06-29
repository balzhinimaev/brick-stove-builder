import { randomBytes } from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

function resolveAuthSecret() {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  const ephemeral = randomBytes(32).toString("hex");
  console.warn(
    "AUTH_SECRET is not set (or too short). Using an ephemeral secret — issued tokens will be invalidated on every restart. Set AUTH_SECRET in the environment for production."
  );
  return ephemeral;
}

export const config = {
  port: Number(process.env.PORT || 4174),
  mongoUri: process.env.MONGODB_URI,
  corsOrigin: process.env.CORS_ORIGIN || true,
  authSecret: resolveAuthSecret(),
  dbName: "brickstove"
};
