import type { ConnectionOptions } from "bullmq";

const REDIS_URI = process.env.REDIS_URL ?? "redis://localhost:6379";

function parseRedisUrl(url: string): ConnectionOptions {
  const { hostname, port, username, password, protocol } = new URL(url);
  return {
    host: hostname,
    port: Number(port) || 6379,
    ...(username && { username }),
    ...(password && { password }),
    ...(protocol === "rediss:" && { tls: { servername: hostname } }),
  };
}

export const connection = parseRedisUrl(REDIS_URI);
