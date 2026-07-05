import { Prisma } from "@prisma/client";
import type Express from "express";

import { env } from "../../env.js";

export const toJson = (val: unknown) => val as Prisma.InputJsonValue;

export function writeSSE(res: Express.Response, event: string, data: Record<string, unknown>): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function extractUsername(value: string | undefined): string | undefined {
  if (!value)
    return undefined;
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || value;
  }
  catch {
    return value;
  }
}

export function resolveUsername(body: string | undefined): string | undefined {
  const fromBody = extractUsername(body);
  if (fromBody)
    return fromBody;
  return env.LEETCODE_USERNAME?.trim() || undefined;
}

export function startSSE(res: Express.Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}

export type ProblemRow = {
  titleSlug: string;
  title: string;
  difficulty: string;
  questionStatus: string;
  lastResult: string;
  lastSubmittedAt: string;
  numSubmitted: number;
  topicTags: Array<{ name: string; nameTranslated: string; slug: string }>;
};

export async function fetchAllProblems(
  username: string,
  totalSolved: number,
  writeSSEFn: (event: string, data: Record<string, unknown>) => void,
): Promise<ProblemRow[]> {
  const { fetchLeetCodeUserQuestions } = await import("../../fetchers/leetcodeFetcher.js");
  const PAGE_SIZE = 50;
  let skip = 0;
  let allProblems: ProblemRow[] = [];

  while (skip < totalSolved) {
    writeSSEFn("progress", {
      stage: "fetch_questions",
      pct: 38 + Math.round((skip / totalSolved) * 7),
      msg: `8/9: Fetching questions ${skip + 1}–${Math.min(skip + PAGE_SIZE, totalSolved)} of ${totalSolved}...`,
    });

    const page = await fetchLeetCodeUserQuestions(username, skip, PAGE_SIZE);
    if (page.questions.length === 0)
      break;

    allProblems = [...allProblems, ...page.questions.map(q => ({
      titleSlug: q.titleSlug,
      title: q.title,
      difficulty: q.difficulty,
      questionStatus: q.questionStatus,
      lastResult: q.lastResult,
      lastSubmittedAt: q.lastSubmittedAt,
      numSubmitted: q.numSubmitted,
      topicTags: q.topicTags,
    }))];
    skip += PAGE_SIZE;

    if (skip < totalSolved)
      await new Promise(r => setTimeout(r, 300));
  }

  writeSSEFn("progress", { stage: "fetch_questions_done", pct: 45, msg: `8/9: Fetched ${allProblems.length} solved questions` });
  return allProblems;
}
