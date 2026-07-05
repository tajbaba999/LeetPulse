import pino from "pino";

import { env } from "../env.js";

const transports: pino.TransportTargetOptions[] = [];

// Only send to Loki if the host is reachable (Docker environment)
if (env.NODE_ENV === "production") {
  transports.push({
    target: "pino-loki",
    options: {
      host: "http://loki:3100",
      labels: { service: "dsa-tracker" },
      batching: { maxBufferSize: 1000, interval: 5 },
      basicAuth: { username: "", password: "" },
    },
  });
}

const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  base: {
    env: env.NODE_ENV,
    service: "dsa-tracker",
  },
  transport: transports.length > 0
    ? { targets: transports }
    : undefined,
});

export default logger;
