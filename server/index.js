import { config } from "./config.js";
import { connectMongo } from "./db.js";
import { createApp } from "./app.js";

async function start() {
  await connectMongo(config.mongoUri, config.dbName);

  const app = createApp(config);
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${config.port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
