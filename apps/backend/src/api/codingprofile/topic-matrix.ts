import Express from "express";

import prisma from "@leetplus/db";

const router = Express.Router();

type TopicConfig = { display: string; aliases: string[] };

const TOPIC_CONFIG: TopicConfig[] = [
  { display: "Array", aliases: ["array"] },
  { display: "String", aliases: ["string"] },
  { display: "Hash Table", aliases: ["hash table", "hash map"] },
  { display: "DP", aliases: ["dynamic programming"] },
  { display: "Tree", aliases: ["tree", "binary tree", "binary search tree", "n-ary tree"] },
  { display: "Graph", aliases: ["graph"] },
  { display: "Two Pointers", aliases: ["two pointers", "two pointer"] },
  { display: "Sliding Window", aliases: ["sliding window"] },
  { display: "Linked List", aliases: ["linked list"] },
  { display: "Matrix", aliases: ["matrix"] },
  { display: "Backtracking", aliases: ["backtracking"] },
  { display: "Stack", aliases: ["stack"] },
  { display: "Heap", aliases: ["heap", "priority queue"] },
  { display: "Union Find", aliases: ["union find", "union-find", "disjoint set"] },
  { display: "Binary Search", aliases: ["binary search"] },
  { display: "Greedy", aliases: ["greedy"] },
  { display: "Sorting", aliases: ["sort", "sorting"] },
  { display: "Prefix Sum", aliases: ["prefix sum"] },
];

const TOPIC_NAMES = TOPIC_CONFIG.map(t => t.display);

function matchTopic(tagName: string): string | null {
  const lower = tagName.toLowerCase();
  for (const cfg of TOPIC_CONFIG) {
    if (cfg.aliases.includes(lower)) return cfg.display;
  }
  return null;
}

// ── GET /codingprofile/topic-matrix ──
router.get("/topic-matrix", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const problems = await prisma.leetCodeProblem.findMany({
      where: { userId: user.userId },
      select: { difficulty: true, topicTags: true },
    });

    if (problems.length > 0) {
      const matrix: Record<string, { easy: number; medium: number; hard: number }> = {};
      for (const t of TOPIC_NAMES) matrix[t] = { easy: 0, medium: 0, hard: 0 };

      for (const p of problems) {
        const tags = p.topicTags as Array<{ name: string; slug?: string }>;
        if (!Array.isArray(tags)) continue;
        const diff = p.difficulty === "Easy" ? "easy" : p.difficulty === "Hard" ? "hard" : "medium";
        for (const tag of tags) {
          const matched = matchTopic(tag.name);
          if (matched) matrix[matched][diff]++;
        }
      }

      return res.json(TOPIC_NAMES.map(topic => ({
        topic, easy: matrix[topic].easy, medium: matrix[topic].medium, hard: matrix[topic].hard,
      })));
    }

    // Fallback: estimate from skillStats + overall difficulty ratios
    const stats = await prisma.leetCodeStats.findUnique({ where: { userId: user.userId } });
    if (!stats) return res.json(TOPIC_NAMES.map(topic => ({ topic, easy: 0, medium: 0, hard: 0 })));

    const skillStats = stats.skillStats as {
      fundamental: Array<{ tagName: string; problemsSolved: number }> | null;
      intermediate: Array<{ tagName: string; problemsSolved: number }> | null;
      advanced: Array<{ tagName: string; problemsSolved: number }> | null;
    } | null;

    if (!skillStats) return res.json(TOPIC_NAMES.map(topic => ({ topic, easy: 0, medium: 0, hard: 0 })));

    const tagMap = new Map<string, number>();
    for (const tier of [skillStats.fundamental, skillStats.intermediate, skillStats.advanced]) {
      for (const tag of tier ?? []) {
        const matched = matchTopic(tag.tagName);
        if (matched) tagMap.set(matched, (tagMap.get(matched) ?? 0) + tag.problemsSolved);
      }
    }

    const total = (stats.easySolved ?? 0) + (stats.mediumSolved ?? 0) + (stats.hardSolved ?? 0);
    const easyRatio = total > 0 ? stats.easySolved / total : 0.4;
    const medRatio = total > 0 ? stats.mediumSolved / total : 0.4;
    const hardRatio = total > 0 ? stats.hardSolved / total : 0.2;

    const result = TOPIC_NAMES.map(topic => {
      const solved = tagMap.get(topic) ?? 0;
      if (solved === 0) return { topic, easy: 0, medium: 0, hard: 0 };
      const easy = Math.round(solved * easyRatio);
      const hard = Math.round(solved * hardRatio);
      const medium = solved - easy - hard;
      return { topic, easy, medium: Math.max(0, medium), hard };
    });

    res.json(result);
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to fetch topic matrix");
    res.status(500).json({ message: "Server Error!" });
  }
});

export default router;
