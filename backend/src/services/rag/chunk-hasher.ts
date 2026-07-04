import { createHash } from "node:crypto";

import type { Chunk } from "./document-builder.js";

import prisma from "../../db.js";

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function getChangedChunks(userId: string, chunks: Chunk[]): Promise<Chunk[]> {
  const existingHashes = await prisma.ragChunkHash.findMany({ where: { userId } });
  const hashMap = new Map(existingHashes.map(r => [r.chunkId, r.hash]));

  return chunks.filter((chunk) => {
    const newHash = sha256(chunk.text);
    return hashMap.get(chunk.id) !== newHash;
  });
}

export async function saveChunkHashes(userId: string, chunks: Chunk[]): Promise<void> {
  const now = new Date();
  for (const chunk of chunks) {
    const hash = sha256(chunk.text);
    await prisma.ragChunkHash.upsert({
      where: { userId_chunkId: { userId, chunkId: chunk.id } },
      create: { userId, chunkId: chunk.id, hash, updatedAt: now },
      update: { hash, updatedAt: now },
    });
  }
}
