# RAG LeetCode Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an end-to-end RAG pipeline that embeds every user's LeetCode data into Pinecone and answers natural-language questions like "what am I weak in?" and "did I solve Two Sum?" using OpenAI gpt-4o-mini.

**Architecture:** Two BullMQ queues — `fetch-leetcode` (rate-limited, 2s gaps between LeetCode API pages) hands raw data to `process-leetcode` (saves to Postgres, builds text chunks, embeds via OpenAI batch call, upserts to Pinecone namespace per user). A POST /rag/chat endpoint embeds the question, searches Pinecone, and streams the answer from gpt-4o-mini. POST /rag/ingest re-ingests from Postgres data without re-fetching LeetCode.

**Tech Stack:** OpenAI (`text-embedding-3-small` + `gpt-4o-mini`), `@pinecone-database/pinecone`, BullMQ (existing), Prisma/Postgres (existing), Node.js `crypto` (built-in, for SHA-256 hashing)

## Global Constraints

- Package manager: `pnpm` — never use npm or yarn
- Local imports must use `.js` extensions even from `.ts` source files
- File names are kebab-case (`unicorn/filename-case` ESLint rule)
- `process.env` reads are forbidden outside `src/env.ts` — but RAG service files may read `OPENAI_API_KEY` and `PINECONE_*` directly via `process.env` since they are not added to the zod env schema (they are optional infrastructure keys)
- Typecheck command: `pnpm run typecheck` — must pass after every task
- No `console.log` in workers — use `job.log()`
- Chunk hashes stored in Postgres (`RagChunkHash` model), not Redis — Redis evicts keys, Postgres persists forever

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `src/queues/fetch.queue.ts` | `fetch-leetcode` BullMQ queue definition |
| `src/queues/process.queue.ts` | `process-leetcode` BullMQ queue definition |
| `src/api/workers/fetchWorker.ts` | Fetches LeetCode APIs (2s gap between progress pages), enqueues process job |
| `src/api/workers/processWorker.ts` | Saves to Postgres, triggers RAG ingest |
| `src/services/rag/document-builder.ts` | Converts raw LeetCode data into 11 summary chunks + 1 chunk per problem |
| `src/services/rag/chunk-hasher.ts` | SHA-256 hash diff against Postgres `RagChunkHash` table |
| `src/services/rag/embeddings.ts` | OpenAI batch embed — all changed chunks in 1 API call |
| `src/services/rag/pinecone.ts` | Upsert vectors, query by namespace |
| `src/services/rag/chat.ts` | Embed question → search Pinecone → gpt-4o-mini → answer |
| `src/api/rag/rag.ts` | POST /rag/ingest + POST /rag/chat routes |

### Modified files
| Path | Change |
|---|---|
| `prisma/schema.prisma` | Add `LeetCodeProblem` + `RagChunkHash` models |
| `src/queues/sync.queue.ts` | Keep as-is (still used by codingprofile.ts); fetch.queue.ts is additive |
| `src/api/workers/leetcodeWorker.ts` | Keep as-is during transition; fetchWorker.ts replaces it eventually |
| `src/api/index.ts` | Mount rag router |

---

## Task 1: Install packages + extend Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `LeetCodeProblem` and `RagChunkHash` Prisma models available in `@prisma/client`

- [ ] **Step 1: Install OpenAI and Pinecone packages**

```bash
cd /path/to/backend
pnpm add openai @pinecone-database/pinecone
```

Expected: packages appear in `node_modules/`, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Add `LeetCodeProblem` and `RagChunkHash` to schema**

Append to the end of `prisma/schema.prisma`:

```prisma
model LeetCodeProblem {
  id              String @id @default(uuid())
  userId          String
  titleSlug       String
  title           String
  difficulty      String
  questionStatus  String
  lastResult      String
  lastSubmittedAt String
  numSubmitted    Int    @default(0)
  topicTags       Json

  @@unique([userId, titleSlug])
  @@index([userId])
}

model RagChunkHash {
  userId    String
  chunkId   String
  hash      String
  updatedAt DateTime @updatedAt

  @@id([userId, chunkId])
}
```

- [ ] **Step 3: Run migration**

```bash
pnpm prisma migrate dev --name add-leetcode-problem-and-rag-hash
```

Expected output includes:
```
✔  Generated Prisma Client
The following migration(s) have been applied:
  migrations/..._add_leetcode_problem_and_rag_hash/migration.sql
```

- [ ] **Step 4: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/ pnpm-lock.yaml package.json
git commit -m "feat: install openai + pinecone, add LeetCodeProblem and RagChunkHash models"
```

---

## Task 2: Create `fetch-leetcode` queue

**Files:**
- Create: `src/queues/fetch.queue.ts`

**Interfaces:**
- Produces: `fetchLeetcodeQueue` — BullMQ `Queue` instance, exported for use by `fetchWorker.ts` and `codingprofile.ts` (eventually)

- [ ] **Step 1: Create `src/queues/fetch.queue.ts`**

```typescript
import { Queue } from "bullmq";

import { connection } from "./sync.queue.js";

export const fetchLeetcodeQueue = new Queue("fetch-leetcode", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 2000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/queues/fetch.queue.ts
git commit -m "feat: add fetch-leetcode BullMQ queue"
```

---

## Task 3: Create `process-leetcode` queue

**Files:**
- Create: `src/queues/process.queue.ts`

**Interfaces:**
- Produces: `processLeetcodeQueue` — BullMQ `Queue` instance, exported for use by `fetchWorker.ts` and `processWorker.ts`
- Produces type: `ProcessJobData` — the shape of data passed between fetchWorker and processWorker

- [ ] **Step 1: Create `src/queues/process.queue.ts`**

```typescript
import { Queue } from "bullmq";

import type {
  LeetCodeSyncResult,
} from "../types/coding-profiles.js";

import { connection } from "./sync.queue.js";

export type RawProblem = {
  titleSlug: string;
  title: string;
  difficulty: string;
  questionStatus: string;
  lastResult: string;
  lastSubmittedAt: string;
  numSubmitted: number;
  topicTags: Array<{ name: string; nameTranslated: string; slug: string }>;
};

export type ProcessJobData = {
  userId: string;
  username: string;
  syncResult: LeetCodeSyncResult;
  problems: RawProblem[];
};

export const processLeetcodeQueue = new Queue("process-leetcode", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 2000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/queues/process.queue.ts
git commit -m "feat: add process-leetcode BullMQ queue and ProcessJobData type"
```

---

## Task 4: Create `fetchWorker` (rate-limited LeetCode fetcher)

**Files:**
- Create: `src/api/workers/fetchWorker.ts`

**Interfaces:**
- Consumes: `fetchLeetcodeQueue` from `src/queues/fetch.queue.ts`
- Consumes: `processLeetcodeQueue` from `src/queues/process.queue.ts`
- Consumes: `fetchLeetCodeFullSync` from `src/fetchers/leetcodeFetcher.ts`
- Consumes: `SyncJobData` from `src/types/coding-profiles.ts`
- Produces: Enqueues `ProcessJobData` jobs into `processLeetcodeQueue`

- [ ] **Step 1: Create `src/api/workers/fetchWorker.ts`**

```typescript
import { Credential, LeetCode } from "leetcode-query";
import { Worker } from "bullmq";

import type { SyncJobData } from "../../types/coding-profiles.js";
import type { RawProblem } from "../../queues/process.queue.js";

import { fetchLeetCodeFullSync } from "../../fetchers/leetcodeFetcher.js";
import { connection } from "../../queues/sync.queue.js";
import { fetchLeetcodeQueue } from "../../queues/fetch.queue.js";
import { processLeetcodeQueue } from "../../queues/process.queue.js";
import { attachWorkerMetrics } from "../../queues/metrics.js";

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const fetchWorker = new Worker(
  fetchLeetcodeQueue.name,
  async (job) => {
    const { userId, username } = job.data as SyncJobData;
    job.log(`[fetch] Starting LeetCode fetch for ${username}`);

    // Step 1: Fetch all summary stats (7 parallel GraphQL queries — no rate-limit concern)
    const syncResult = await fetchLeetCodeFullSync(username);
    job.log(`[fetch] Summary sync complete: ${syncResult.profile.totalSolved} solved`);

    // Step 2: Fetch solved problem list (sequential, 2s gap per page to respect LeetCode rate limits)
    const problems: RawProblem[] = [];
    const session = process.env.LEETCODE_SESSION;
    const csrf = process.env.LEETCODE_CSRF;

    if (session && csrf) {
      const credential = new Credential();
      credential.session = session;
      credential.csrf = csrf;
      const lc = new LeetCode(credential);

      let skip = 0;
      const limit = 50;
      let hasMore = true;

      while (hasMore) {
        const batch = await lc.user_progress_questions({ skip, limit });
        problems.push(...(batch.questions as RawProblem[]));
        hasMore = batch.questions.length === limit;
        skip += limit;
        if (hasMore) {
          await sleep(2000);
        }
      }
      job.log(`[fetch] Fetched ${problems.length} problems (${Math.ceil(problems.length / limit)} pages)`);
    }
    else {
      job.log(`[fetch] LEETCODE_SESSION/CSRF not set — skipping problem fetch`);
    }

    // Step 3: Hand off to process queue
    await processLeetcodeQueue.add(
      "process-leetcode",
      { userId, username, syncResult, problems },
      { jobId: `process-leetcode-${userId}` },
    );
    job.log(`[fetch] Enqueued process job for ${username}`);
  },
  {
    connection,
    concurrency: 2,
    limiter: { max: 2, duration: 1000 },
  },
);

fetchWorker.on("completed", job => job.log(`[fetch] Job ${job.id} completed`));
fetchWorker.on("failed", (job, err) => {
  job?.log(`[fetch] Job ${job?.id} failed: ${err.message}`);
});

attachWorkerMetrics(fetchWorker, "fetch-leetcode");

export default fetchWorker;
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/workers/fetchWorker.ts
git commit -m "feat: add fetchWorker with rate-limited sequential progress fetching"
```

---

## Task 5: Create `processWorker` (Postgres saves)

**Files:**
- Create: `src/api/workers/processWorker.ts`

**Interfaces:**
- Consumes: `processLeetcodeQueue` from `src/queues/process.queue.ts`
- Consumes: `ProcessJobData`, `RawProblem` from `src/queues/process.queue.ts`
- Consumes: `prisma` from `src/db.ts`
- Produces: All LeetCode data persisted to Postgres; enqueues RAG ingest (Task 6 onward wires this in)

- [ ] **Step 1: Create `src/api/workers/processWorker.ts`**

```typescript
import type { Prisma } from "@prisma/client";
import { Worker } from "bullmq";

import type { ProcessJobData } from "../../queues/process.queue.js";

import prisma from "../../db.js";
import { connection } from "../../queues/sync.queue.js";
import { processLeetcodeQueue } from "../../queues/process.queue.js";
import { attachWorkerMetrics } from "../../queues/metrics.js";

const toJson = (val: unknown) => val as Prisma.InputJsonValue;

const processWorker = new Worker(
  processLeetcodeQueue.name,
  async (job) => {
    const { userId, username, syncResult, problems } = job.data as ProcessJobData;
    const { profile, contest, questionProgress, sessionProgress, skillStats, languageStats, calendar } = syncResult;

    job.log(`[process] Saving stats for ${username} to Postgres`);

    // ── 1. Upsert LeetCodeStats ──
    await prisma.leetCodeStats.upsert({
      where: { userId },
      create: {
        userId,
        username,
        totalSolved: profile.totalSolved,
        totalQuestions: profile.totalQuestions,
        easySolved: profile.easySolved,
        mediumSolved: profile.mediumSolved,
        hardSolved: profile.hardSolved,
        ranking: profile.ranking,
        acceptanceRate: profile.acceptanceRate,
        streak: calendar.streak,
        contestRating: contest.info.rating,
        contestGlobalRanking: contest.info.globalRanking,
        contestTopPercentage: contest.info.topPercentage,
        attendedContestsCount: contest.info.attendedContestsCount,
        questionProgress: toJson(questionProgress),
        skillStats: toJson(skillStats),
        languageStats: toJson(languageStats),
        recentSubmissions: toJson(profile.recentSubmissions),
        calendarData: toJson({ activeYears: calendar.activeYears, totalActiveDays: calendar.totalActiveDays }),
      },
      update: {
        username,
        totalSolved: profile.totalSolved,
        totalQuestions: profile.totalQuestions,
        easySolved: profile.easySolved,
        mediumSolved: profile.mediumSolved,
        hardSolved: profile.hardSolved,
        ranking: profile.ranking,
        acceptanceRate: profile.acceptanceRate,
        streak: calendar.streak,
        contestRating: contest.info.rating,
        contestGlobalRanking: contest.info.globalRanking,
        contestTopPercentage: contest.info.topPercentage,
        attendedContestsCount: contest.info.attendedContestsCount,
        questionProgress: toJson(questionProgress),
        skillStats: toJson(skillStats),
        languageStats: toJson(languageStats),
        recentSubmissions: toJson(profile.recentSubmissions),
        calendarData: toJson({ activeYears: calendar.activeYears, totalActiveDays: calendar.totalActiveDays }),
      },
    });

    // ── 2. Replace LeetCodeProblem rows ──
    if (problems.length > 0) {
      await prisma.$executeRaw`DELETE FROM "LeetCodeProblem" WHERE "userId" = ${userId}`;
      await prisma.leetCodeProblem.createMany({
        data: problems.map(p => ({
          userId,
          titleSlug: p.titleSlug,
          title: p.title,
          difficulty: p.difficulty,
          questionStatus: p.questionStatus,
          lastResult: p.lastResult,
          lastSubmittedAt: p.lastSubmittedAt,
          numSubmitted: p.numSubmitted,
          topicTags: toJson(p.topicTags),
        })),
      });
      job.log(`[process] Saved ${problems.length} problems`);
    }

    // ── 3. Replace LeetCodeContestHistory rows ──
    await prisma.$executeRaw`DELETE FROM "LeetCodeContestHistory" WHERE "userId" = ${userId}`;
    if (contest.history.length > 0) {
      await prisma.leetCodeContestHistory.createMany({
        data: contest.history.map(e => ({
          userId,
          contestTitle: e.contest.title,
          startTime: e.contest.startTime,
          attended: e.attended,
          rating: e.rating,
          ranking: e.ranking,
          trendDirection: e.trendDirection,
          problemsSolved: e.problemsSolved,
          totalProblems: e.totalProblems,
          finishTimeInSeconds: e.finishTimeInSeconds,
        })),
      });
    }

    job.log(`[process] Postgres save complete`);

    // ── 4. RAG ingest (wired in Task 12) ──
    // ingestRag({ userId, username, syncResult, problems }) — added in Task 12
  },
  { connection, concurrency: 2 },
);

processWorker.on("completed", job => job.log(`[process] Job ${job.id} done`));
processWorker.on("failed", (job, err) => {
  job?.log(`[process] Job ${job?.id} failed: ${err.message}`);
});

attachWorkerMetrics(processWorker, "process-leetcode");

export default processWorker;
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/workers/processWorker.ts
git commit -m "feat: add processWorker — saves LeetCodeStats, problems, and contest history to Postgres"
```

---

## Task 6: Build `document-builder` service

**Files:**
- Create: `src/services/rag/document-builder.ts`

**Interfaces:**
- Consumes: `LeetCodeSyncResult` from `src/types/coding-profiles.ts`
- Consumes: `RawProblem` from `src/queues/process.queue.ts`
- Produces: `Chunk` type + `buildChunks(username, syncResult, problems): Chunk[]`

- [ ] **Step 1: Create `src/services/rag/document-builder.ts`**

```typescript
import type { LeetCodeSyncResult } from "../../types/coding-profiles.js";
import type { RawProblem } from "../../queues/process.queue.js";

export type Chunk = {
  id: string;
  text: string;
  type: "summary" | "problem";
};

export function buildChunks(
  username: string,
  syncResult: LeetCodeSyncResult,
  problems: RawProblem[],
): Chunk[] {
  const chunks: Chunk[] = [];
  const { profile, contest, questionProgress, sessionProgress, skillStats, languageStats, calendar } = syncResult;

  // ── overall-summary ──
  const totalPct = profile.totalQuestions > 0
    ? ((profile.totalSolved / profile.totalQuestions) * 100).toFixed(1)
    : "0";
  chunks.push({
    id: "overall-summary",
    type: "summary",
    text: [
      `LeetCode profile summary for ${username}:`,
      `Total solved: ${profile.totalSolved}/${profile.totalQuestions} (${totalPct}%)`,
      `Easy: ${profile.easySolved} solved`,
      `Medium: ${profile.mediumSolved} solved`,
      `Hard: ${profile.hardSolved} solved`,
      `Global ranking: #${profile.ranking}`,
      `Acceptance rate: ${profile.acceptanceRate.toFixed(1)}%`,
      `Current streak: ${calendar.streak} days`,
      `Total submissions: ${profile.totalSubmissions}`,
    ].join("\n"),
  });

  // ── skill chunks ──
  for (const level of ["advanced", "intermediate", "fundamental"] as const) {
    const tags = skillStats[level];
    if (tags.length === 0) continue;
    const sorted = [...tags].sort((a, b) => a.problemsSolved - b.problemsSolved);
    const lines = sorted.map(t =>
      `- ${t.tagName}: ${t.problemsSolved} problems${t.problemsSolved <= 5 ? " ⚠ WEAK" : t.problemsSolved >= 50 ? " ✓ STRONG" : ""}`,
    );
    chunks.push({
      id: `skill-${level}`,
      type: "summary",
      text: [`${level.charAt(0).toUpperCase() + level.slice(1)} skill topics for ${username}:`, ...lines].join("\n"),
    });
  }

  // ── weakness-analysis ──
  const allTags = [
    ...skillStats.advanced.map(t => ({ ...t, level: "advanced" })),
    ...skillStats.intermediate.map(t => ({ ...t, level: "intermediate" })),
    ...skillStats.fundamental.map(t => ({ ...t, level: "fundamental" })),
  ].sort((a, b) => a.problemsSolved - b.problemsSolved);

  const weakest = allTags.slice(0, 10);
  const strongest = [...allTags].sort((a, b) => b.problemsSolved - a.problemsSolved).slice(0, 5);

  chunks.push({
    id: "weakness-analysis",
    type: "summary",
    text: [
      `Weakness analysis for ${username}:`,
      "",
      "PRIORITY FOCUS AREAS (fewest problems solved):",
      ...weakest.map(t => `- ${t.tagName} (${t.level}): ${t.problemsSolved} problems`),
      "",
      "STRONGEST AREAS:",
      ...strongest.map(t => `- ${t.tagName} (${t.level}): ${t.problemsSolved} problems`),
      "",
      `Recommendation: Focus on ${weakest.slice(0, 3).map(t => t.tagName).join(", ")} first.`,
    ].join("\n"),
  });

  // ── language-stats ──
  const sortedLangs = [...languageStats].sort((a, b) => b.problemsSolved - a.problemsSolved);
  chunks.push({
    id: "language-stats",
    type: "summary",
    text: [
      `Programming languages used by ${username}:`,
      ...sortedLangs.map(l => `- ${l.languageName}: ${l.problemsSolved} problems`),
      `Primary language: ${sortedLangs[0]?.languageName ?? "unknown"}`,
    ].join("\n"),
  });

  // ── contest-summary ──
  chunks.push({
    id: "contest-summary",
    type: "summary",
    text: [
      `Contest statistics for ${username}:`,
      `Rating: ${contest.info.rating.toFixed(0)}`,
      `Global ranking: #${contest.info.globalRanking}/${contest.info.totalParticipants} (top ${contest.info.topPercentage}%)`,
      `Total contests attended: ${contest.info.attendedContestsCount}`,
      `Badge: ${contest.info.badge ?? "none"}`,
    ].join("\n"),
  });

  // ── contest-history ──
  const historyLines = contest.history.map((e) => {
    const date = new Date(e.contest.startTime * 1000).toISOString().split("T")[0];
    return `- ${e.contest.title} (${date}): solved ${e.problemsSolved}/${e.totalProblems}, rank #${e.ranking}, rating ${e.rating.toFixed(0)} (${e.trendDirection})`;
  });
  chunks.push({
    id: "contest-history",
    type: "summary",
    text: [
      `Contest history for ${username} (${contest.history.length} contests):`,
      ...historyLines,
    ].join("\n"),
  });

  // ── question-progress ──
  const acc = questionProgress.numAcceptedQuestions;
  const fail = questionProgress.numFailedQuestions;
  const untouched = questionProgress.numUntouchedQuestions;
  const beats = questionProgress.userSessionBeatsPercentage;
  chunks.push({
    id: "question-progress",
    type: "summary",
    text: [
      `Question progress for ${username}:`,
      `Accepted — Easy: ${acc.find(x => x.difficulty === "EASY")?.count ?? 0} | Medium: ${acc.find(x => x.difficulty === "MEDIUM")?.count ?? 0} | Hard: ${acc.find(x => x.difficulty === "HARD")?.count ?? 0}`,
      `Failed   — Easy: ${fail.find(x => x.difficulty === "EASY")?.count ?? 0} | Medium: ${fail.find(x => x.difficulty === "MEDIUM")?.count ?? 0} | Hard: ${fail.find(x => x.difficulty === "HARD")?.count ?? 0}`,
      `Untouched — Easy: ${untouched.find(x => x.difficulty === "EASY")?.count ?? 0} | Medium: ${untouched.find(x => x.difficulty === "MEDIUM")?.count ?? 0} | Hard: ${untouched.find(x => x.difficulty === "HARD")?.count ?? 0}`,
      `Beats — Easy: ${beats.find(x => x.difficulty === "EASY")?.percentage ?? 0}% | Medium: ${beats.find(x => x.difficulty === "MEDIUM")?.percentage ?? 0}% | Hard: ${beats.find(x => x.difficulty === "HARD")?.percentage ?? 0}%`,
      `Overall beats: ${questionProgress.totalQuestionBeatsPercentage}%`,
    ].join("\n"),
  });

  // ── session-progress ──
  const allQ = sessionProgress.allQuestionsCount;
  const acSub = sessionProgress.acSubmissionNum;
  const totSub = sessionProgress.totalSubmissionNum;
  chunks.push({
    id: "session-progress",
    type: "summary",
    text: [
      `Submission statistics for ${username}:`,
      `Total questions on LeetCode — All: ${allQ.find(x => x.difficulty === "All")?.count ?? 0} | Easy: ${allQ.find(x => x.difficulty === "Easy")?.count ?? 0} | Medium: ${allQ.find(x => x.difficulty === "Medium")?.count ?? 0} | Hard: ${allQ.find(x => x.difficulty === "Hard")?.count ?? 0}`,
      `Accepted (unique) — All: ${acSub.find(x => x.difficulty === "All")?.count ?? 0} | Easy: ${acSub.find(x => x.difficulty === "Easy")?.count ?? 0} | Medium: ${acSub.find(x => x.difficulty === "Medium")?.count ?? 0} | Hard: ${acSub.find(x => x.difficulty === "Hard")?.count ?? 0}`,
      `Total submissions — All: ${totSub.find(x => x.difficulty === "All")?.submissions ?? 0} | Easy: ${totSub.find(x => x.difficulty === "Easy")?.submissions ?? 0} | Medium: ${totSub.find(x => x.difficulty === "Medium")?.submissions ?? 0} | Hard: ${totSub.find(x => x.difficulty === "Hard")?.submissions ?? 0}`,
    ].join("\n"),
  });

  // ── calendar-activity ──
  const dccNames = calendar.dccBadges.map(b => b.badge.name).join(", ") || "none";
  chunks.push({
    id: "calendar-activity",
    type: "summary",
    text: [
      `Activity calendar for ${username}:`,
      `Current streak: ${calendar.streak} days`,
      `Total active days (all time): ${calendar.totalActiveDays}`,
      `Active years: ${calendar.activeYears.join(", ")}`,
      `DCC badges earned: ${calendar.dccBadges.length} (${dccNames})`,
    ].join("\n"),
  });

  // ── one chunk per solved problem ──
  for (const p of problems) {
    const tags = Array.isArray(p.topicTags)
      ? p.topicTags.map((t: { name: string }) => t.name).join(", ")
      : "";
    chunks.push({
      id: `problem-${p.titleSlug}`,
      type: "problem",
      text: [
        `Problem: ${p.title}`,
        `Difficulty: ${p.difficulty}`,
        `Status: ${p.questionStatus} (${p.lastResult})`,
        `Topic tags: ${tags || "none"}`,
        `Last submitted: ${p.lastSubmittedAt}`,
        `Total attempts: ${p.numSubmitted}`,
        `Solved by: ${username}`,
      ].join("\n"),
    });
  }

  return chunks;
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/rag/document-builder.ts
git commit -m "feat: add document-builder — converts LeetCode data to text chunks"
```

---

## Task 7: Build `chunk-hasher` service

**Files:**
- Create: `src/services/rag/chunk-hasher.ts`

**Interfaces:**
- Consumes: `Chunk` from `src/services/rag/document-builder.ts`
- Consumes: `prisma` from `src/db.ts`
- Produces: `getChangedChunks(userId, chunks): Promise<Chunk[]>` — returns only chunks whose text changed since last ingest

- [ ] **Step 1: Create `src/services/rag/chunk-hasher.ts`**

```typescript
import { createHash } from "node:crypto";

import prisma from "../../db.js";
import type { Chunk } from "./document-builder.js";

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function getChangedChunks(userId: string, chunks: Chunk[]): Promise<Chunk[]> {
  const existingHashes = await prisma.ragChunkHash.findMany({ where: { userId } });
  const hashMap = new Map(existingHashes.map(r => [r.chunkId, r.hash]));

  return chunks.filter(chunk => {
    const newHash = sha256(chunk.text);
    return hashMap.get(chunk.id) !== newHash;
  });
}

export async function saveChunkHashes(userId: string, chunks: Chunk[]): Promise<void> {
  const now = new Date();
  await prisma.$transaction(
    chunks.map(chunk =>
      prisma.ragChunkHash.upsert({
        where: { userId_chunkId: { userId, chunkId: chunk.id } },
        create: { userId, chunkId: chunk.id, hash: sha256(chunk.text), updatedAt: now },
        update: { hash: sha256(chunk.text), updatedAt: now },
      }),
    ),
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/rag/chunk-hasher.ts
git commit -m "feat: add chunk-hasher — SHA-256 diff against RagChunkHash table"
```

---

## Task 8: Build `embeddings` service

**Files:**
- Create: `src/services/rag/embeddings.ts`

**Interfaces:**
- Consumes: `Chunk` from `src/services/rag/document-builder.ts`
- Produces: `ChunkWithVector` type + `embedChunks(chunks: Chunk[]): Promise<ChunkWithVector[]>`

- [ ] **Step 1: Create `src/services/rag/embeddings.ts`**

```typescript
import OpenAI from "openai";

import type { Chunk } from "./document-builder.js";

export type ChunkWithVector = Chunk & { vector: number[] };

const openai = new OpenAI({
  // eslint-disable-next-line node/no-process-env
  apiKey: process.env.OPENAI_API_KEY,
});

export async function embedChunks(chunks: Chunk[]): Promise<ChunkWithVector[]> {
  if (chunks.length === 0) return [];

  // OpenAI supports up to 2048 inputs per request — batch all chunks in one call
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks.map(c => c.text),
  });

  return chunks.map((chunk, i) => ({
    ...chunk,
    vector: response.data[i].embedding,
  }));
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/rag/embeddings.ts
git commit -m "feat: add embeddings service — OpenAI text-embedding-3-small batch call"
```

---

## Task 9: Build `pinecone` service

**Files:**
- Create: `src/services/rag/pinecone.ts`

**Interfaces:**
- Consumes: `ChunkWithVector` from `src/services/rag/embeddings.ts`
- Produces:
  - `upsertChunks(userId, chunks: ChunkWithVector[]): Promise<void>`
  - `queryChunks(userId, vector: number[], topK: number): Promise<string[]>` — returns top-K chunk texts

- [ ] **Step 1: Create `src/services/rag/pinecone.ts`**

```typescript
import { Pinecone } from "@pinecone-database/pinecone";

import type { ChunkWithVector } from "./embeddings.js";

/* eslint-disable node/no-process-env */
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY ?? "" });
const indexName = process.env.PINECONE_INDEX ?? "dsa-tracker";
/* eslint-enable node/no-process-env */

function getIndex() {
  return pc.index(indexName);
}

export async function upsertChunks(userId: string, chunks: ChunkWithVector[]): Promise<void> {
  if (chunks.length === 0) return;

  const index = getIndex().namespace(userId);

  // Pinecone upsert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    await index.upsert(
      batch.map(c => ({
        id: c.id,
        values: c.vector,
        metadata: { type: c.type, chunkId: c.id },
      })),
    );
  }
}

export async function queryChunks(
  userId: string,
  vector: number[],
  topK: number = 4,
): Promise<string[]> {
  const index = getIndex().namespace(userId);
  const result = await index.query({
    vector,
    topK,
    includeMetadata: true,
  });

  return (result.matches ?? []).map(m => m.metadata?.chunkId as string ?? "");
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/rag/pinecone.ts
git commit -m "feat: add Pinecone service — upsert and query by user namespace"
```

---

## Task 10: Build `chat` service

**Files:**
- Create: `src/services/rag/chat.ts`

**Interfaces:**
- Consumes: `embedChunks` from `src/services/rag/embeddings.ts`
- Consumes: `queryChunks` from `src/services/rag/pinecone.ts`
- Consumes: `prisma` from `src/db.ts` (to fetch chunk texts by ID)
- Produces: `chat(userId, username, question): Promise<{ answer: string; sources: string[] }>`

Note: `queryChunks` returns chunk IDs. To get the actual text for the GPT context, we need to either: (a) store chunk texts in Pinecone metadata, or (b) re-fetch from Postgres. Option (a) is simpler — store the text in Pinecone metadata during upsert. Update `pinecone.ts` upsert to include `text` in metadata.

- [ ] **Step 1: Update `src/services/rag/pinecone.ts` to store text in metadata**

Change the upsert metadata to include `text`:

```typescript
await index.upsert(
  batch.map(c => ({
    id: c.id,
    values: c.vector,
    metadata: { type: c.type, chunkId: c.id, text: c.text },
  })),
);
```

Also update `queryChunks` to return texts instead of IDs:

```typescript
export async function queryChunks(
  userId: string,
  vector: number[],
  topK: number = 4,
): Promise<Array<{ id: string; text: string }>> {
  const index = getIndex().namespace(userId);
  const result = await index.query({
    vector,
    topK,
    includeMetadata: true,
  });

  return (result.matches ?? []).map(m => ({
    id: m.metadata?.chunkId as string ?? m.id,
    text: m.metadata?.text as string ?? "",
  }));
}
```

- [ ] **Step 2: Create `src/services/rag/chat.ts`**

```typescript
import OpenAI from "openai";

import { embedChunks } from "./embeddings.js";
import { queryChunks } from "./pinecone.js";

const openai = new OpenAI({
  // eslint-disable-next-line node/no-process-env
  apiKey: process.env.OPENAI_API_KEY,
});

export type ChatResult = {
  answer: string;
  sources: string[];
};

export async function chat(
  userId: string,
  username: string,
  question: string,
): Promise<ChatResult> {
  // 1. Embed the question
  const [questionChunk] = await embedChunks([{ id: "query", text: question, type: "summary" }]);

  // 2. Retrieve top-4 relevant chunks from this user's namespace
  const matches = await queryChunks(userId, questionChunk.vector, 4);
  const context = matches.map(m => m.text).join("\n\n---\n\n");
  const sources = matches.map(m => m.id);

  // 3. Generate answer with gpt-4o-mini
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: [
          `You are a LeetCode performance coach for ${username}.`,
          "Answer questions based ONLY on the profile data provided below.",
          "Always reference specific numbers. Give actionable recommendations.",
          "If the data is insufficient to answer, say so — never invent numbers.",
          "",
          "Profile data:",
          context,
        ].join("\n"),
      },
      { role: "user", content: question },
    ],
    temperature: 0.3,
    max_tokens: 512,
  });

  return {
    answer: completion.choices[0].message.content ?? "No answer generated.",
    sources,
  };
}
```

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/rag/pinecone.ts src/services/rag/chat.ts
git commit -m "feat: add chat service — embed question, search Pinecone, answer with gpt-4o-mini"
```

---

## Task 11: Build RAG ingest orchestrator + API routes

**Files:**
- Create: `src/services/rag/ingest.ts`
- Create: `src/api/rag/rag.ts`

**Interfaces:**
- Consumes: `buildChunks` from `document-builder.ts`
- Consumes: `getChangedChunks`, `saveChunkHashes` from `chunk-hasher.ts`
- Consumes: `embedChunks` from `embeddings.ts`
- Consumes: `upsertChunks` from `pinecone.ts`
- Consumes: `chat` from `chat.ts`
- Produces: `ingestRag(userId, username, syncResult, problems): Promise<{ upserted: number; skipped: number }>` — callable from both processWorker and POST /rag/ingest
- Produces: POST `/rag/ingest` and POST `/rag/chat` routes (both require JWT auth)

- [ ] **Step 1: Create `src/services/rag/ingest.ts`**

```typescript
import type { LeetCodeSyncResult } from "../../types/coding-profiles.js";
import type { RawProblem } from "../../queues/process.queue.js";

import { buildChunks } from "./document-builder.js";
import { getChangedChunks, saveChunkHashes } from "./chunk-hasher.js";
import { embedChunks } from "./embeddings.js";
import { upsertChunks } from "./pinecone.js";

export async function ingestRag(
  userId: string,
  username: string,
  syncResult: LeetCodeSyncResult,
  problems: RawProblem[],
): Promise<{ upserted: number; skipped: number }> {
  const allChunks = buildChunks(username, syncResult, problems);
  const changedChunks = await getChangedChunks(userId, allChunks);

  if (changedChunks.length === 0) {
    return { upserted: 0, skipped: allChunks.length };
  }

  const withVectors = await embedChunks(changedChunks);
  await upsertChunks(userId, withVectors);
  await saveChunkHashes(userId, changedChunks);

  return { upserted: changedChunks.length, skipped: allChunks.length - changedChunks.length };
}
```

- [ ] **Step 2: Create `src/api/rag/rag.ts`**

```typescript
import Express from "express";

import type { ProcessJobData } from "../../queues/process.queue.js";

import prisma from "../../db.js";
import { ingestRag } from "../../services/rag/ingest.js";
import { chat } from "../../services/rag/chat.js";

const router = Express.Router();

// POST /api/v1/rag/ingest
// Reads from Postgres — does not re-fetch LeetCode
router.post("/ingest", async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  try {
    const [profile, codingProfile, problems, contestHistory] = await Promise.all([
      prisma.leetCodeStats.findUnique({ where: { userId: user.userId } }),
      prisma.codingProfiles.findUnique({ where: { userId: user.userId } }),
      prisma.leetCodeProblem.findMany({ where: { userId: user.userId } }),
      prisma.leetCodeContestHistory.findMany({ where: { userId: user.userId } }),
    ]);

    if (!profile || !codingProfile?.leetcode) {
      return res.status(404).json({ message: "LeetCode profile not synced yet. Run a sync first." });
    }

    // Reconstruct syncResult from Postgres data
    const syncResult = reconstructSyncResult(profile, contestHistory);
    const rawProblems: ProcessJobData["problems"] = problems.map(p => ({
      titleSlug: p.titleSlug,
      title: p.title,
      difficulty: p.difficulty,
      questionStatus: p.questionStatus,
      lastResult: p.lastResult,
      lastSubmittedAt: p.lastSubmittedAt,
      numSubmitted: p.numSubmitted,
      topicTags: p.topicTags as Array<{ name: string; nameTranslated: string; slug: string }>,
    }));

    const result = await ingestRag(user.userId, codingProfile.leetcode, syncResult, rawProblems);
    res.status(200).json({ message: "RAG ingest complete", ...result });
  }
  catch (ex) {
    req.log.error({ err: ex }, "RAG ingest failed");
    res.status(500).json({ message: "RAG ingest failed" });
  }
});

// POST /api/v1/rag/chat
// Body: { question: string }
router.post("/chat", async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const { question } = req.body as { question?: string };
  if (!question?.trim()) {
    return res.status(400).json({ message: "question is required" });
  }

  try {
    const codingProfile = await prisma.codingProfiles.findUnique({ where: { userId: user.userId } });
    if (!codingProfile?.leetcode) {
      return res.status(404).json({ message: "LeetCode profile not linked" });
    }

    const result = await chat(user.userId, codingProfile.leetcode, question);
    res.status(200).json(result);
  }
  catch (ex) {
    req.log.error({ err: ex }, "RAG chat failed");
    res.status(500).json({ message: "RAG chat failed" });
  }
});

// ── Helper: reconstruct LeetCodeSyncResult from Postgres rows ──
import type { LeetCodeStats, LeetCodeContestHistory } from "@prisma/client";
import type { LeetCodeSyncResult } from "../../types/coding-profiles.js";

function reconstructSyncResult(
  stats: LeetCodeStats,
  contestHistory: LeetCodeContestHistory[],
): LeetCodeSyncResult {
  const skillStats = (stats.skillStats ?? { fundamental: [], intermediate: [], advanced: [] }) as LeetCodeSyncResult["skillStats"];
  const languageStats = (stats.languageStats ?? []) as LeetCodeSyncResult["languageStats"];
  const questionProgress = (stats.questionProgress ?? {
    numAcceptedQuestions: [],
    numFailedQuestions: [],
    numUntouchedQuestions: [],
    userSessionBeatsPercentage: [],
    totalQuestionBeatsPercentage: 0,
  }) as LeetCodeSyncResult["questionProgress"];
  const calendarData = (stats.calendarData ?? {}) as { activeYears?: number[]; totalActiveDays?: number };

  return {
    profile: {
      username: stats.username,
      totalSolved: stats.totalSolved,
      totalQuestions: stats.totalQuestions,
      easySolved: stats.easySolved,
      mediumSolved: stats.mediumSolved,
      hardSolved: stats.hardSolved,
      ranking: stats.ranking,
      acceptanceRate: stats.acceptanceRate,
      streak: stats.streak,
      totalSubmissions: 0,
      recentSubmissions: (stats.recentSubmissions ?? []) as LeetCodeSyncResult["profile"]["recentSubmissions"],
    },
    contest: {
      info: {
        attendedContestsCount: stats.attendedContestsCount,
        rating: stats.contestRating,
        globalRanking: stats.contestGlobalRanking,
        totalParticipants: 0,
        topPercentage: stats.contestTopPercentage,
        badge: null,
      },
      history: contestHistory.map(e => ({
        attended: e.attended,
        rating: e.rating,
        ranking: e.ranking,
        trendDirection: e.trendDirection,
        problemsSolved: e.problemsSolved,
        totalProblems: e.totalProblems,
        finishTimeInSeconds: e.finishTimeInSeconds,
        contest: { title: e.contestTitle, startTime: e.startTime },
      })),
    },
    questionProgress,
    sessionProgress: {
      allQuestionsCount: [],
      acSubmissionNum: [],
      totalSubmissionNum: [],
    },
    skillStats,
    languageStats,
    calendar: {
      activeYears: calendarData.activeYears ?? [],
      streak: stats.streak,
      totalActiveDays: calendarData.totalActiveDays ?? 0,
      dccBadges: [],
      submissionCalendar: {},
    },
  };
}

export default router;
```

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/rag/ingest.ts src/api/rag/rag.ts
git commit -m "feat: add RAG ingest orchestrator and POST /rag/ingest + /rag/chat routes"
```

---

## Task 12: Wire RAG router + connect processWorker to RAG ingest

**Files:**
- Modify: `src/api/index.ts`
- Modify: `src/api/workers/processWorker.ts`

**Interfaces:**
- Consumes: `rag router` from `src/api/rag/rag.ts`
- Consumes: `ingestRag` from `src/services/rag/ingest.ts`

- [ ] **Step 1: Mount rag router in `src/api/index.ts`**

Add import and mount after the existing protected routes:

```typescript
import Rag from "./rag/rag.js";
// ... (existing imports)

// Inside the router, after authenticateToken is applied:
router.use("/rag", Rag);
```

- [ ] **Step 2: Wire `ingestRag` into `processWorker.ts`**

Add import at top of `processWorker.ts`:

```typescript
import { ingestRag } from "../../services/rag/ingest.js";
```

Replace the comment `// ── 4. RAG ingest (wired in Task 12) ──` with:

```typescript
// ── 4. RAG ingest ──
const ragResult = await ingestRag(userId, username, syncResult, problems);
job.log(`[process] RAG ingest: ${ragResult.upserted} upserted, ${ragResult.skipped} skipped`);
```

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/api/index.ts src/api/workers/processWorker.ts
git commit -m "feat: wire RAG router into api and connect processWorker to ingestRag"
```

---

## Task 13: Wire fetch and process workers into server + update codingprofile to use fetch queue

**Files:**
- Modify: `src/index.ts`
- Modify: `src/api/codingprofile/codingprofile.ts`

**Interfaces:**
- All workers must be imported so they register and start listening
- `codingprofile.ts` should enqueue to `fetch-leetcode` queue so the full pipeline runs

- [ ] **Step 1: Update `src/api/codingprofile/codingprofile.ts` to use fetch queue**

Replace the import:
```typescript
// Remove:
import { getQueueForPlatform } from "../../queues/sync.queue.js";

// Add:
import { fetchLeetcodeQueue } from "../../queues/fetch.queue.js";
```

Replace both `queue.add(...)` calls:
```typescript
// Remove:
const queue = getQueueForPlatform("leetcode");
await queue.add("sync-leetcode", { ... }, { ... });

// Add (in POST /):
await fetchLeetcodeQueue.add(
  "fetch-leetcode",
  { userId: user.userId, platform: "leetcode", username: leetcode },
  { priority: 3, jobId: `fetch-leetcode-${user.userId}` },
);

// Add (in PUT /):
await fetchLeetcodeQueue.add(
  "fetch-leetcode",
  { userId: user.userId, platform: "leetcode", username: parsed.data.leetcode },
  { priority: 1, jobId: `fetch-leetcode-${user.userId}` },
);
```

- [ ] **Step 2: Import workers in `src/index.ts`** so they start on server boot

Add after the existing imports:

```typescript
import "./api/workers/fetchWorker.js";
import "./api/workers/processWorker.js";
```

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts src/api/codingprofile/codingprofile.ts
git commit -m "feat: wire fetch and process workers into server, update codingprofile to use fetch queue"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Two queues (`fetch-leetcode`, `process-leetcode`) — Tasks 2, 3
- ✅ 2s gap between progress pages — Task 4 (`fetchWorker`)
- ✅ Any number of problems (loop until `hasMore` is false) — Task 4
- ✅ Postgres first (`processWorker` saves before RAG) — Task 5
- ✅ 11 summary chunks + 1 per problem — Task 6 (`document-builder`)
- ✅ SHA-256 hash diff (skip unchanged chunks) — Task 7
- ✅ OpenAI batch embed (all changed chunks in 1 call) — Task 8
- ✅ Pinecone namespace per userId — Task 9
- ✅ gpt-4o-mini with data+recommendations prompt — Task 10
- ✅ POST /rag/ingest reads from Postgres (no re-fetch) — Task 11
- ✅ POST /rag/chat JWT-protected — Task 11
- ✅ `processWorker` calls `ingestRag` after Postgres saves — Task 12
- ✅ Server starts workers on boot — Task 13
- ✅ Each task ends with a commit — all tasks

**Type consistency check:**
- `Chunk` defined in `document-builder.ts`, consumed by `chunk-hasher`, `embeddings`, `pinecone`, `ingest` — consistent
- `ChunkWithVector` defined in `embeddings.ts`, consumed by `pinecone.ts` and `ingest.ts` — consistent
- `RawProblem` defined in `process.queue.ts`, consumed by `fetchWorker`, `processWorker`, `document-builder`, `rag.ts` — consistent
- `ProcessJobData` defined in `process.queue.ts`, consumed by `processWorker` and `rag.ts` — consistent

**Placeholder scan:** None found — all steps have complete code.
