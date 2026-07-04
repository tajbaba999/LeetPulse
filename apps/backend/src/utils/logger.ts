import pino from "pino";

import { env } from "../env.js";

const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  base: {
    env: env.NODE_ENV,
    service: "dsa-tracker",
  },
  transport: {
    target: "pino-loki",
    options: {
      host: "http://loki:3100",
      labels: { service: "dsa-tracker" },
      batching: {
        maxBufferSize: 1000,
        interval: 5,
      },
      basicAuth: {
        username: "",
        password: "",
      },
    },
  },
});

export default logger;
