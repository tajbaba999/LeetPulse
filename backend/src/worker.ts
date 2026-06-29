import "dotenv/config";

import logger from "./utils/logger.js";

// Import workers — they self-register with BullMQ on import
import "./api/workers/leetcodeWorker.js";
import "./api/workers/codeforcesWorker.js";
import "./api/workers/codechefWorker.js";
import "./api/workers/gfgWorker.js";

logger.info("Workers started");

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down workers");
  process.exit(0);
});
