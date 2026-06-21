import type { ConnectionOptions } from "bullmq";
import { Queue, Worker } from "bullmq";

function parseRedisUrl(url: string): ConnectionOptions {
  const { hostname, port, password } = new URL(url);
  return {
    host: hostname,
    port: Number(port) || 6379,
    ...(password && { password }),
  };
}

export const redisConnection = parseRedisUrl(
  // eslint-disable-next-line node/no-process-env
  process.env.REDIS_URL ?? "redis://localhost:6379",
);

// Re-export Queue and Worker so feature files don't need to import bullmq directly
export { Queue, Worker };
