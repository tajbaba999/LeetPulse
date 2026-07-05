import Express from "express";

import prisma from "@leetplus/db";

const router = Express.Router();

// ── GET /codingprofile/history ──
router.get("/history", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);

    const snapshots = await prisma.leetCodeHistory.findMany({
      where: { userId: user.userId },
      orderBy: { snapshotAt: "desc" },
      take: limit,
      select: {
        id: true, snapshotAt: true, totalSolved: true, totalQuestions: true,
        easySolved: true, mediumSolved: true, hardSolved: true, ranking: true,
        acceptanceRate: true, streak: true, contestRating: true, contestGlobalRanking: true,
        contestTopPercentage: true, attendedContestsCount: true, problemsSolvedList: true,
        contestHistory: true, skillStats: true, languageStats: true,
      },
    });

    res.status(200).json({ snapshots, total: snapshots.length });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to fetch history");
    res.status(500).json({ message: "Server Error!" });
  }
});

// ── GET /codingprofile/history/diff ──
router.get("/history/diff", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const fromId = req.query.from as string | undefined;
    const toId = req.query.to as string | undefined;

    let older: Record<string, unknown> | null = null;
    let newer: Record<string, unknown> | null = null;

    if (fromId && toId) {
      [older, newer] = await Promise.all([
        prisma.leetCodeHistory.findFirst({ where: { userId: user.userId, id: fromId } }),
        prisma.leetCodeHistory.findFirst({ where: { userId: user.userId, id: toId } }),
      ]);
    }
    else {
      const snapshots = await prisma.leetCodeHistory.findMany({
        where: { userId: user.userId },
        orderBy: { snapshotAt: "desc" },
        take: 2,
      });
      newer = snapshots[0] ?? null;
      older = snapshots[1] ?? null;
    }

    if (!older || !newer) {
      return res.status(404).json({ message: "Need at least 2 snapshots to compute diff" });
    }

    const oldProblems = new Set(
      Array.isArray(older.problemsSolvedList)
        ? (older.problemsSolvedList as Array<{ titleSlug: string }>).map(p => p.titleSlug)
        : [],
    );
    const newProblems = Array.isArray(newer.problemsSolvedList)
      ? (newer.problemsSolvedList as Array<{ titleSlug: string; title: string; difficulty: string }>)
      : [];
    const newlySolved = newProblems.filter(p => !oldProblems.has(p.titleSlug));

    res.status(200).json({
      from: { snapshotAt: older.snapshotAt, totalSolved: older.totalSolved },
      to: { snapshotAt: newer.snapshotAt, totalSolved: newer.totalSolved },
      diff: {
        totalSolved: (newer.totalSolved as number) - (older.totalSolved as number),
        easy: (newer.easySolved as number) - (older.easySolved as number),
        medium: (newer.mediumSolved as number) - (older.mediumSolved as number),
        hard: (newer.hardSolved as number) - (older.hardSolved as number),
        contestRating: Math.round(((newer.contestRating as number) - (older.contestRating as number)) * 100) / 100,
        ranking: (newer.ranking as number) - (older.ranking as number),
        newlySolvedCount: newlySolved.length,
        newlySolved,
      },
    });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to compute diff");
    res.status(500).json({ message: "Server Error!" });
  }
});

export default router;
