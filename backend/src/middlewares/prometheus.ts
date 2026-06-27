import type { NextFunction, Request, Response } from "express";

import { httpRequestDuration, httpRequestTotal, httpRequestsInFlight } from "../lib/metrics.js";

export function prometheusMiddleware(req: Request, res: Response, next: NextFunction): void {
  httpRequestsInFlight.inc();

  const end = httpRequestDuration.startTimer();

  res.on("finish", () => {
    const route = req.route?.path || req.path;
    const labels = { method: req.method, route, status_code: res.statusCode };

    end(labels);
    httpRequestTotal.inc(labels);
    httpRequestsInFlight.dec();
  });

  next();
}
