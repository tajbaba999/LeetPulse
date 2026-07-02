# RAG Implementation Design — Grindlytics LeetCode Coach

**Date:** 2026-07-03  
**Status:** Approved  
**Scope:** End-to-end RAG pipeline for answering natural language questions about a user's LeetCode profile

---

## 1. Overview

Grindlytics is open-source and self-deployed. The deployer provides their own OpenAI and Pinecone API keys in `.env`. End users just use the app.

Users can ask natural language questions like:
- "What topics am I weak in?"
- "How many hard problems have I solved?"
- "Did I solve Two Sum?"
- "What's my contest rating trend?"
- "Which language do I use most?"

The system answers with specific numbers from their profile and gives actionable recommendations.

---

## 2. Technology Decisions

| Concern | Choice | Reason |
|---|---|---|
| Embeddings | OpenAI `text-embedding-3-small` | $0.02/1M tokens, 1536 dims, supports 2048 inputs per batch |
| Chat/generation | OpenAI `gpt-4o-mini` | Cheap, fast, good at structured data Q&A |
| Vector store | Pinecone (existing `dsa-tracker` index) | Already in `.env`, serverless free tier covers ~1M vectors |
| Primary DB | PostgreSQL via Prisma (existing) | Source of truth for structured data |
| Hash store | Redis (existing BullMQ instance) | Incremental ingest dedup, no extra infra |
| Queue | BullMQ (existing) | Rate-limited fetching + async processing |

---

## 3. Two-Queue Architecture

### Queue 1 — `fetch-leetcode` (rate-limited fetcher)

**Responsibility:** Hit LeetCode APIs safely. Nothing else.

- Sequential API calls with **2s gap** between each call
- Fetches: stats (7 parallel GraphQL queries) + progress pagination (sequential, 50/page)
- On complete: enqueues raw payload into Queue 2
- No DB writes, no processing

**LeetCode rate limit:** ~20 req/min (unofficial). 2s gap = 30 req/min max → safe.

**Cost for 1,500 solved problems:**
- Progress pagination: 1,500 / 50 = 30 pages × 2s = ~60s fetch time
- Summary queries: 7 parallel calls, ~2s total

### Queue 2 — `process-leetcode` (processor)

**Responsibility:** Save to Postgres + build documents + ingest into Pinecone.

Runs at full speed (no external rate limits for Postgres + Pinecone writes).

```
Step 1  Save important data → Postgres (upsert, idempotent)
Step 2  Build all text chunks from raw payload (document-builder)
Step 3  Hash-diff each chunk against Redis → find changed/new chunks only
Step 4  Batch-embed changed chunks → 1 OpenAI API call
Step 5  Upsert changed vectors → Pinecone (namespace = userId)
Step 6  Write updated hashes → Redis
```

---

## 4. Data Split — Postgres vs Pinecone

| Data | Postgres | Pinecone |
|---|---|---|
| Total solved, difficulty breakdown | ✅ | ✅ chunk: `overall-summary` |
| Contest history | ✅ `LeetCodeContestHistory` | ✅ chunk: `contest-history` |
| Solved problems (all) | ✅ `LeetCodeProblem` (new) | ✅ one chunk per problem |
| Skill stats (tags + counts) | ✅ JSON column | ✅ chunks: `skill-advanced`, `skill-intermediate`, `skill-fundamental` |
| Language stats | ✅ JSON column | ✅ chunk: `language-stats` |
| Calendar heatmap | ❌ too granular | ✅ chunk: `calendar-activity` |
| DCC badges | ❌ | ✅ chunk: `calendar-activity` |
| Computed weakness analysis | ❌ derived | ✅ chunk: `weakness-analysis` |
| Session progress breakdown | ❌ | ✅ chunk: `session-progress` |
| Question progress (beats %) | ✅ JSON column | ✅ chunk: `question-progress` |

**Rule:** If the frontend dashboard displays it directly → Postgres. If it only matters for AI answers → Pinecone only.

---

## 5. Chunks — Complete List

### Summary chunks (11, always rebuilt on sync)

| Chunk ID | Content |
|---|---|
| `overall-summary` | Total solved, easy/medium/hard, ranking, acceptance rate, streak |
| `skill-advanced` | All advanced tag counts with weak/strong labels |
| `skill-intermediate` | All intermediate tag counts with weak/strong labels |
| `skill-fundamental` | All fundamental tag counts |
| `weakness-analysis` | **Computed** bottom-10 topics, explicit "FOCUS ON THESE" list |
| `language-stats` | Problems solved per language |
| `contest-summary` | Rating, global rank, attended count, top percentage |
| `contest-history` | All contest entries with trend narrative |
| `question-progress` | Accepted/failed/untouched per difficulty + beats % |
| `session-progress` | All question counts + submission stats |
| `calendar-activity` | Streak, total active days, active years, DCC badges |

### Problem chunks (1 per solved problem)

```
Problem: Two Sum
Difficulty: Easy
Status: Accepted
Tags: Array, Hash Table
Last submitted: 2025-01-15
Submissions: 2 attempts
```

Vector ID: `problem-{titleSlug}` (e.g., `problem-two-sum`)

### Pinecone namespace

Each user gets their own namespace: `namespace = userId`. Isolates users completely. No metadata filtering needed.

### Incremental dedup

Chunk hash key in Redis: `rag:hash:{userId}:{chunkId}`  
Value: SHA-256 of chunk text content  
On re-ingest: skip chunks whose hash hasn't changed → 0 embedding calls for unchanged problems.

### Embedding cost

| Scenario | Chunks | API calls | Cost |
|---|---|---|---|
| Initial ingest (1,500 problems) | ~1,511 | 1 batch | ~$0.002 |
| Re-sync (5 new problems) | ~16 changed | 1 batch | ~$0.00002 |

---

## 6. New Prisma Model

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
```

---

## 7. New Files & Folder Structure

```
src/
  queues/
    fetch.queue.ts          ← rename/refactor from sync.queue.ts: fetch-leetcode queue
    process.queue.ts        ← new: process-leetcode queue definition

  workers/
    fetchWorker.ts          ← new: rate-limited LeetCode fetcher (2s gaps)
    processWorker.ts        ← new: Postgres save + RAG ingest

  services/
    rag/
      document-builder.ts   ← converts raw LeetCode data → Chunk[]
      embeddings.ts         ← OpenAI batch embed, returns vectors
      pinecone.ts           ← upsert chunks, query by namespace
      chunk-hasher.ts       ← SHA-256 hash + Redis diff
      chat.ts               ← embed question → search → GPT → answer

  api/
    rag/
      rag.ts                ← POST /rag/ingest (manual), POST /rag/chat
```

---

## 8. Chat Pipeline

```
POST /api/v1/rag/chat
Body: { question: string }
Auth: JWT (uses req.user.userId)

1. Embed question → text-embedding-3-small (1 API call)
2. Query Pinecone: namespace=userId, topK=4
3. Join 4 chunk texts as context string
4. Call gpt-4o-mini:
     system: "You are a LeetCode coach for {username}. Answer based on data below.
              Give specific numbers. Include actionable recommendations.
              If data is missing, say so — never invent numbers."
     user:   "{context}\n\nQuestion: {question}"
5. Return { answer: string, sources: string[] }
```

---

## 9. Manual Ingest Endpoint

```
POST /api/v1/rag/ingest
Auth: JWT (uses req.user.userId + their linked LeetCode username)

1. Read LeetCodeStats + LeetCodeProblem from Postgres for this userId
2. Build chunks (document-builder)
3. Hash-diff → find changed
4. Embed + upsert to Pinecone
5. Update Redis hashes
6. Return { chunksUpserted: number, skipped: number }
```

---

## 10. Trigger Points

| Trigger | What happens |
|---|---|
| User links LeetCode profile | Enqueue `fetch-leetcode` job immediately |
| Periodic sync (cron / manual) | Enqueue `fetch-leetcode` job |
| `POST /rag/ingest` | Reads from Postgres directly, skips fetch queue |
| `POST /rag/chat` | Chat pipeline only, no ingest |

---

## 11. Environment Variables Required

```env
OPENAI_API_KEY=          # already in .env.example
PINECONE_API_KEY=        # already in .env.example
PINECONE_INDEX=dsa-tracker  # already in .env.example
```

No new env vars needed.

---

## 12. Implementation Order

1. Install packages: `openai`, `@pinecone-database/pinecone`
2. Add `LeetCodeProblem` Prisma model + run migration
3. Refactor `sync.queue.ts` → `fetch.queue.ts` (rename queue, add 2s rate limiting between API calls)
4. Refactor `leetcodeWorker.ts` → `fetchWorker.ts` (sequential progress fetching with 2s gaps, enqueue process job on complete)
5. Create `process.queue.ts` (new process-leetcode queue)
6. Create `processWorker.ts` (save to Postgres + trigger RAG ingest)
7. `services/rag/document-builder.ts` — raw data → Chunk[]
8. `services/rag/chunk-hasher.ts` — SHA-256 + Redis diff
9. `services/rag/embeddings.ts` — OpenAI batch embed
10. `services/rag/pinecone.ts` — upsert + query
11. `services/rag/chat.ts` — full chat pipeline
12. `api/rag/rag.ts` — POST /ingest + POST /chat routes
13. Wire rag router into `api/index.ts`
