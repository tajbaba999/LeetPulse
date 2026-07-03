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
