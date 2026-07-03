import type { NextFunction, Request, Response } from "express";

import { fetchQueueEvents, processQueueEvents } from "../../queues/events.js";
import { fetchLeetcodeQueue } from "../../queues/fetch.queue.js";
import { processLeetcodeQueue } from "../../queues/process.queue.js";
import { verifyAccessToken } from "../../utils/tokens.js";

export type ProgressPayload = { stage: string; pct: number; msg: string };
export type StepProgress = { step: number; total: number; msg: string };

function writeSSE(res: Response, event: "progress" | "completed" | "error", data: ProgressPayload | StepProgress): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// the client side to avoid exposing the JWT in the URL.
export function authenticateSSE(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      req.user = verifyAccessToken(authHeader.split(" ")[1]);
      next();
      return;
    }
    catch { /* fall through */ }
  }
  const queryToken = req.query.token as string | undefined;
  if (queryToken) {
    try {
      req.user = verifyAccessToken(queryToken);
      next();
      return;
    }
    catch { /* fall through */ }
  }
  res.status(401).json({ message: "Unauthorized" });
}

export async function syncStreamHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const fetchJobId = `fetch-leetcode-${userId}`;
  const processJobId = `process-leetcode-${userId}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let closed = false;

  const keepalive = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 30_000);
  const timeout = setTimeout(() => {
    writeSSE(res, "error", { stage: "timeout", pct: 0, msg: "Stream timed out after 10 minutes" });
    close();
  }, 10 * 60 * 1000);

  function close(): void {
    if (closed)
      return;
    closed = true;
    clearTimeout(timeout);
    clearInterval(keepalive);
    fetchQueueEvents.off("progress", onFetchProgress);
    fetchQueueEvents.off("completed", onFetchCompleted);
    fetchQueueEvents.off("failed", onAnyFailed);
    processQueueEvents.off("progress", onProcessProgress);
    processQueueEvents.off("completed", onProcessCompleted);
    processQueueEvents.off("failed", onAnyFailed);
    res.end();
  }

  req.on("close", close);

  function onFetchProgress(args: { jobId: string; data: unknown }): void {
    if (args.jobId !== fetchJobId || closed)
      return;
    const d = args.data as { step?: number; total?: number; msg?: string } | undefined;
    if (d?.step && d?.total) {
      const pct = Math.round((d.step / d.total) * 38);
      writeSSE(res, "progress", { stage: "fetch_step", pct, msg: d.msg ?? "" });
    }
    else {
      writeSSE(res, "progress", args.data as ProgressPayload);
    }
  }

  function onFetchCompleted(args: { jobId: string }): void {
    if (args.jobId !== fetchJobId || closed)
      return;
    writeSSE(res, "progress", { stage: "fetch_complete", pct: 38, msg: "Problems fetched, starting database save..." });
  }

  function onProcessProgress(args: { jobId: string; data: unknown }): void {
    if (args.jobId !== processJobId || closed)
      return;
    writeSSE(res, "progress", args.data as ProgressPayload);
  }

  function onProcessCompleted(args: { jobId: string }): void {
    if (args.jobId !== processJobId || closed)
      return;
    writeSSE(res, "completed", { stage: "completed", pct: 100, msg: "Sync complete" });
    close();
  }

  function onAnyFailed(args: { jobId: string; failedReason: string }): void {
    if (args.jobId !== fetchJobId && args.jobId !== processJobId)
      return;
    if (closed)
      return;
    writeSSE(res, "error", { stage: "error", pct: 0, msg: args.failedReason ?? "Job failed" });
    close();
  }

  // Attach listeners FIRST
  fetchQueueEvents.on("progress", onFetchProgress);
  fetchQueueEvents.on("completed", onFetchCompleted);
  fetchQueueEvents.on("failed", onAnyFailed);
  processQueueEvents.on("progress", onProcessProgress);
  processQueueEvents.on("completed", onProcessCompleted);
  processQueueEvents.on("failed", onAnyFailed);

  // Now check current state
  const [fetchJob, processJob] = await Promise.all([
    fetchLeetcodeQueue.getJob(fetchJobId),
    processLeetcodeQueue.getJob(processJobId),
  ]);

  if (!fetchJob && !processJob) {
    writeSSE(res, "error", { stage: "not_found", pct: 0, msg: "No sync job found. Call POST /codingprofile/sync first." });
    close();
    return;
  }

  if (processJob) {
    const state = await processJob.getState();
    if (state === "completed") {
      writeSSE(res, "completed", { stage: "completed", pct: 100, msg: "Already completed" });
      close();
      return;
    }
    if (state === "failed") {
      writeSSE(res, "error", { stage: "error", pct: 0, msg: processJob.failedReason ?? "Job failed" });
      close();
      return;
    }
    writeSSE(res, "progress", { stage: "db_save_started", pct: 40, msg: "Database save in progress..." });
    return;
  }

  if (fetchJob) {
    const state = await fetchJob.getState();
    if (state === "failed") {
      writeSSE(res, "error", { stage: "error", pct: 0, msg: fetchJob.failedReason ?? "Fetch failed" });
      close();
      return;
    }
    writeSSE(res, "progress", { stage: "fetch_started", pct: 0, msg: "Fetching LeetCode data..." });
  }
}
