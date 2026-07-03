import Express from "express";

import prisma from "../../db.js";
import { env } from "../../env.js";
import { fetchLeetcodeQueue } from "../../queues/fetch.queue.js";

const router = Express.Router();

router.post("/", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const log = req.log.child({ userId: user.userId });

    const leetcode = env.LEETCODE_USERNAME;

    const existingProfile = await prisma.codingProfiles.findUnique({
      where: { userId: user.userId },
    });

    if (existingProfile) {
      log.warn("Coding profiles already exist for user");
      return res.status(400).json({ message: "Coding profiles already exist" });
    }

    await prisma.codingProfiles.create({
      data: { userId: user.userId, leetcode },
    });

    await fetchLeetcodeQueue.add(
      "fetch-leetcode",
      { userId: user.userId, username: leetcode },
      { priority: 3, jobId: `fetch-leetcode-${user.userId}` },
    );
    log.info({ username: leetcode }, "Queued fetch job");

    log.info("Coding profiles created successfully");
    res.status(200).json({ message: "Successfully added coding profiles" });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to create coding profiles");
    res.status(500).json({ message: "Server Error!" });
  }
});

router.post("/sync", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const log = req.log.child({ userId: user.userId });

    const profile = await prisma.codingProfiles.findUnique({
      where: { userId: user.userId },
    });

    if (!profile) {
      log.warn("Sync attempted but no coding profile exists");
      return res.status(404).json({ message: "No coding profile linked. Call POST /codingprofile first." });
    }

    if (!profile.leetcode) {
      log.warn("Sync attempted but no LeetCode username linked");
      return res.status(400).json({ message: "No LeetCode username linked to this profile." });
    }

    const fetchJobId = `fetch-leetcode-${user.userId}`;
    const processJobId = `process-leetcode-${user.userId}`;

    await fetchLeetcodeQueue.add(
      "fetch-leetcode",
      { userId: user.userId, username: profile.leetcode },
      { priority: 1, jobId: fetchJobId },
    );

    log.info({ username: profile.leetcode }, "Queued sync job");
    res.status(202).json({ message: "Sync started", username: profile.leetcode, jobId: fetchJobId, processJobId });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to start sync");
    res.status(500).json({ message: "Server Error!" });
  }
});

router.get("/", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const log = req.log.child({ userId: user.userId });

    const [profiles, leetCodeStats] = await Promise.all([
      prisma.codingProfiles.findUnique({ where: { userId: user.userId } }),
      prisma.leetCodeStats.findUnique({ where: { userId: user.userId } }),
    ]);

    if (!profiles) {
      log.warn("Coding profiles not found for user");
      return res.status(404).json({ message: "Coding profiles not found. Create them first." });
    }

    log.info("Coding profiles fetched successfully");
    res.status(200).json({
      profiles,
      stats: {
        leetcode: leetCodeStats,
      },
    });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to fetch coding profiles");
    return res.status(500).json({ message: "Server Error!" });
  }
});

export default router;
