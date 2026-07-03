import OpenAI from "openai";

import type { Chunk } from "./document-builder.js";

export type ChunkWithVector = Chunk & { vector: number[] };

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    // eslint-disable-next-line node/no-process-env
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export async function embedChunks(chunks: Chunk[]): Promise<ChunkWithVector[]> {
  if (chunks.length === 0)
    return [];

  // OpenAI supports up to 2048 inputs per request — batch all chunks in one call
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: chunks.map(c => c.text),
  });

  return chunks.map((chunk, i) => ({
    ...chunk,
    vector: response.data[i].embedding,
  }));
}
