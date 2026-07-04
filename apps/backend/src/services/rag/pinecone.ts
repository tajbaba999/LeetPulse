import { Pinecone } from "@pinecone-database/pinecone";

import type { ChunkWithVector } from "./embeddings.js";

let _pc: Pinecone | null = null;
/* eslint-disable node/no-process-env */
function getPinecone(): Pinecone {
  if (!_pc)
    _pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY ?? "" });
  return _pc;
}
const indexName = () => process.env.PINECONE_INDEX ?? "dsa-tracker";
/* eslint-enable node/no-process-env */

let _indexReady = false;

async function ensureIndex(): Promise<void> {
  if (_indexReady)
    return;

  const pc = getPinecone();
  const name = indexName();

  try {
    const existing = await pc.describeIndex(name);
    if (existing.status?.ready) {
      _indexReady = true;
      return;
    }
  }
  catch {
    // Index doesn't exist — create it
  }

  try {
    await pc.createIndex({
      name,
      dimension: 768,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });

    // Wait for index to be ready
    for (let i = 0; i < 30; i++) {
      const desc = await pc.describeIndex(name);
      if (desc.status?.ready) {
        _indexReady = true;
        return;
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    _indexReady = true;
  }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to create Pinecone index "${name}": ${msg}`);
  }
}

function getIndex() {
  return getPinecone().index(indexName());
}

export async function upsertChunks(userId: string, chunks: ChunkWithVector[]): Promise<void> {
  if (chunks.length === 0)
    return;

  await ensureIndex();

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
  await ensureIndex();

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
