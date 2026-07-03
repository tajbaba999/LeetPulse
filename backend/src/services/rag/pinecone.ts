import { Pinecone } from "@pinecone-database/pinecone";

import type { ChunkWithVector } from "./embeddings.js";

let _pc: Pinecone | null = null;
/* eslint-disable node/no-process-env */
function getPinecone(): Pinecone {
  if (!_pc) _pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY ?? "" });
  return _pc;
}
const indexName = () => process.env.PINECONE_INDEX ?? "dsa-tracker";
/* eslint-enable node/no-process-env */

function getIndex() {
  return getPinecone().index(indexName());
}

export async function upsertChunks(userId: string, chunks: ChunkWithVector[]): Promise<void> {
  if (chunks.length === 0) return;

  const index = getIndex().namespace(userId);

  // Pinecone upsert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    await index.upsert({
      records: batch.map(c => ({
        id: c.id,
        values: c.vector,
        metadata: { type: c.type, chunkId: c.id, text: c.text },
      })),
    });
  }
}

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
