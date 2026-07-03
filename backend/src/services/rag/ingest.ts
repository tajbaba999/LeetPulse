import type { RawProblem } from "../../queues/process.queue.js";
import type { LeetCodeSyncResult } from "../../types/coding-profiles.js";

import { getChangedChunks, saveChunkHashes } from "./chunk-hasher.js";
import { buildChunks } from "./document-builder.js";
import { embedChunks } from "./embeddings.js";
import { upsertChunks } from "./pinecone.js";

export type IngestProgressCallback = (stage: string, pct: number, msg: string) => void | Promise<void>;

export async function ingestRag(
  userId: string,
  username: string,
  syncResult: LeetCodeSyncResult,
  problems: RawProblem[],
  onProgress?: IngestProgressCallback,
): Promise<{ upserted: number; skipped: number }> {
  const allChunks = buildChunks(username, syncResult, problems);
  const changedChunks = await getChangedChunks(userId, allChunks);

  if (changedChunks.length === 0) {
    return { upserted: 0, skipped: allChunks.length };
  }

  await onProgress?.("embedding_started", 65, `Embedding ${changedChunks.length} changed chunks...`);
  const withVectors = await embedChunks(changedChunks);

  await onProgress?.("pinecone_started", 80, `Upserting ${changedChunks.length} vectors to Pinecone...`);
  await upsertChunks(userId, withVectors);
  await saveChunkHashes(userId, changedChunks);

  return { upserted: changedChunks.length, skipped: allChunks.length - changedChunks.length };
}
