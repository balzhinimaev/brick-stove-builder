import mongoose from "mongoose";
import { config } from "./config.js";
import { connectMongo } from "./db.js";
import { createApp } from "./app.js";

async function start() {
  await connectMongo(config.mongoUri, config.dbName);

  const app = createApp(config);
  const server = app.listen(config.port, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${config.port}`);
  });

  // Graceful shutdown: docker stop шлёт SIGTERM — дорабатываем открытые запросы,
  // закрываем Mongo и выходим сами (иначе через 10с прилетит SIGKILL на живых коннектах).
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down…`);
    server.close(async () => {
      try {
        await mongoose.disconnect();
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
