import Express from "express";

import prisma from "@leetplus/db";

const router = Express.Router();

// ── GET /codingprofile/questions ──
router.get("/questions", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const difficulty = req.query.difficulty as string | undefined;
    const tag = req.query.tag as string | undefined;

    let problems = await prisma.leetCodeProblem.findMany({
      where: { userId: user.userId },
      orderBy: { lastSubmittedAt: "desc" },
    });

    // Fallback: if LeetCodeProblem table is empty, read from latest history snapshot
    if (problems.length === 0) {
      const latest = await prisma.leetCodeHistory.findFirst({
        where: { userId: user.userId },
        orderBy: { snapshotAt: "desc" },
        select: { problemsSolvedList: true },
      });
      if (Array.isArray(latest?.problemsSolvedList)) {
        const list = latest.problemsSolvedList as Array<{
          title: string; titleSlug: string; difficulty: string;
          lastResult?: string; questionStatus?: string;
          lastSubmittedAt?: string; numSubmitted?: number;
          topicTags?: Array<{ name: string; nameTranslated?: string; slug: string }>;
        }>;
        problems = list.map(p => ({
          id: "", userId: user.userId,
          titleSlug: p.titleSlug, title: p.title, difficulty: p.difficulty,
          questionStatus: p.questionStatus ?? "",
          lastResult: p.lastResult ?? "",
          lastSubmittedAt: p.lastSubmittedAt ?? "",
          numSubmitted: p.numSubmitted ?? 0,
          topicTags: p.topicTags ?? [],
        }));
      }
    }

    let filtered = problems;

    if (difficulty) {
      const d = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
      filtered = filtered.filter(p => p.difficulty === d);
    }

    if (tag) {
      const tagLower = tag.toLowerCase();
      filtered = filtered.filter((p) => {
        const tags = p.topicTags as Array<{ name: string; slug: string }>;
        return Array.isArray(tags) && tags.some(t =>
          t.name.toLowerCase().includes(tagLower) || t.slug.toLowerCase().includes(tagLower),
        );
      });
    }

    const sliced = filtered.slice(offset, offset + limit);

    res.status(200).json({
      total: filtered.length,
      limit,
      offset,
      hasMore: offset + limit < filtered.length,
      difficulty: difficulty ?? "all",
      tag: tag ?? "all",
      questions: sliced.map(p => ({
        title: p.title,
        titleSlug: p.titleSlug,
        difficulty: p.difficulty,
        lastResult: p.lastResult,
        questionStatus: p.questionStatus,
        lastSubmittedAt: p.lastSubmittedAt,
        numSubmitted: p.numSubmitted,
        topicTags: p.topicTags,
      })),
    });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to fetch questions");
    res.status(500).json({ message: "Server Error!" });
  }
});

export default router;
