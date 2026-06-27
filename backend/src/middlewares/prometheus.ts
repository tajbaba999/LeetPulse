import type { NextFunction, Request, Response } from "express";

import { httpRequestDuration, httpRequestTotal, httpRequestsInFlight } from "../lib/metrics.js";

const APP_LABEL = { app_kubernetes_io_name: "dsa-tracker" };

export function prometheusMiddleware(req: Request, res: Response, next: NextFunction): void {
  httpRequestsInFlight.inc(APP_LABEL);

  const end = httpRequestDuration.startTimer();

  res.on("finish", () => {
    const route = req.route?.path || req.path;
    const labels = { method: req.method, route, status_code: res.statusCode, ...APP_LABEL };

    end(labels);
    httpRequestTotal.inc(labels);
    httpRequestsInFlight.dec(APP_LABEL);
  });

  next();
}
