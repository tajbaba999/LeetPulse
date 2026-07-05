import Express from "express";

import prisma from "@leetplus/db";

const router = Express.Router();

// ── GET /codingprofile ──
router.get("/", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const [profiles, leetCodeStats, problemCount, contestCount] = await Promise.all([
      prisma.codingProfiles.findUnique({ where: { userId: user.userId } }),
      prisma.leetCodeStats.findUnique({ where: { userId: user.userId } }),
      prisma.leetCodeProblem.count({ where: { userId: user.userId } }),
      prisma.leetCodeContestHistory.count({ where: { userId: user.userId } }),
    ]);

    if (!profiles) {
      return res.status(404).json({ message: "Coding profiles not found. Create them first." });
    }

    res.status(200).json({
      profiles,
      stats: { leetcode: leetCodeStats },
      counts: { problems: problemCount, contests: contestCount },
    });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to fetch coding profiles");
    return res.status(500).json({ message: "Server Error!" });
  }
});

export default router;
