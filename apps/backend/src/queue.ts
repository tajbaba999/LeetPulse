import type { ConnectionOptions } from "bullmq";

import { Queue, Worker } from "bullmq";

function parseRedisUrl(url: string): ConnectionOptions {
  const { hostname, port, username, password, protocol } = new URL(url);
  return {
    host: hostname,
    port: Number(port) || 6379,
    ...(username && { username }),
    ...(password && { password }),
    // rediss:// endpoints (e.g. Upstash) are TLS-only — connecting over plain
    // TCP gets the socket reset by the server (ECONNRESET).
    ...(protocol === "rediss:" && { tls: { servername: hostname } }),
  };
}

export const redisConnection = parseRedisUrl(
  // eslint-disable-next-line node/no-process-env
  process.env.REDIS_URL ?? "redis://localhost:6379",
);

export { Queue, Worker };
