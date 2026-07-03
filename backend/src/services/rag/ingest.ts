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
