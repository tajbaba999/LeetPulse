import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

export const register = new Registry();

collectDefaultMetrics({ register, labels: { app_kubernetes_io_name: "dsa-tracker" } });

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code", "app_kubernetes_io_name"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: "http_request_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code", "app_kubernetes_io_name"],
  registers: [register],
});

export const httpRequestsInFlight = new Gauge({
  name: "http_requests_in_flight",
  help: "Number of HTTP requests currently being served",
  labelNames: ["app_kubernetes_io_name"],
  registers: [register],
});

export const syncJobDuration = new Histogram({
  name: "sync_job_duration_seconds",
  help: "Duration of sync jobs in seconds",
  labelNames: ["platform", "status"],
  buckets: [1, 5, 10, 30, 60, 120],
  registers: [register],
});

export const syncJobTotal = new Counter({
  name: "sync_job_total",
  help: "Total number of sync jobs",
  labelNames: ["platform", "status"],
  registers: [register],
});

export const syncJobsInFlight = new Gauge({
  name: "sync_jobs_in_flight",
  help: "Number of sync jobs currently running",
  labelNames: ["platform"],
  registers: [register],
});
