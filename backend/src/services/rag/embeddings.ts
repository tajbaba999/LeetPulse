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
