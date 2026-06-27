import "dotenv/config";

import app from "./app.js";
import { env } from "./env.js";
import logger from "./utils/logger.js";

const port = env.PORT;
const server = app.listen(port, () => {
  logger.info({ port, env: env.NODE_ENV }, "Server started");
});

server.on("error", (err) => {
  if ("code" in err && err.code === "EADDRINUSE") {
    logger.error({ port }, "Port already in use");
  }
  else {
    logger.error({ err }, "Server failed to start");
  }
  process.exit(1);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received — shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});
