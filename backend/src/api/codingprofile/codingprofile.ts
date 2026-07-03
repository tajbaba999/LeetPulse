import Express from "express";

import prisma from "../../db.js";
import { fetchLeetcodeQueue } from "../../queues/fetch.queue.js";
import { codingProfileSchema } from "../../validators/profile.validator.js";

// Extract username from a URL or return as-is if already a username
function extractUsername(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || value;
  }
  catch {
    return value;
  }
}

const router = Express.Router();

router.post("/", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const log = req.log.child({ userId: user.userId });

    const raw = req.body as Record<string, string | undefined>;
    const normalized = {
      leetcode: extractUsername(raw.leetcode),
    };

    const allprofiles = codingProfileSchema.safeParse(normalized);

    if (!allprofiles.success) {
      log.warn("Coding profile creation request failed validation");
      return res.status(422).json({ message: "Invalid coding profiles" });
    }

    const { leetcode } = allprofiles.data;

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

    if (leetcode) {
      await fetchLeetcodeQueue.add(
        "fetch-leetcode",
        { userId: user.userId, platform: "leetcode", username: leetcode },
        { priority: 3, jobId: `fetch-leetcode-${user.userId}` },
      );
      log.info({ username: leetcode }, "Queued fetch job");
    }

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

    await fetchLeetcodeQueue.add(
      "fetch-leetcode",
      { userId: user.userId, platform: "leetcode", username: profile.leetcode },
      { priority: 1, jobId: `fetch-leetcode-${user.userId}` },
    );

    log.info({ username: profile.leetcode }, "Queued sync job");
    res.status(202).json({ message: "Sync started", username: profile.leetcode });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to start sync");
    res.status(500).json({ message: "Server Error!" });
  }
});

router.put("/", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const log = req.log.child({ userId: user.userId });

    const raw = req.body as Record<string, string | undefined>;
    const normalized = {
      leetcode: extractUsername(raw.leetcode),
    };

    const parsed = codingProfileSchema.safeParse(normalized);

    if (!parsed.success) {
      log.warn("Coding profile update request failed validation");
      return res.status(422).json({ message: "Invalid coding profiles" });
    }

    const fieldsToUpdate = Object.fromEntries(
      Object.entries(parsed.data).filter(([_, v]) => v !== undefined),
    );

    if (Object.keys(fieldsToUpdate).length === 0) {
      log.warn("Coding profile update attempted with no fields");
      return res.status(400).json({ message: "No fields provided to update" });
    }

    const existingProfile = await prisma.codingProfiles.findUnique({
      where: { userId: user.userId },
    });

    if (!existingProfile) {
      log.warn("Coding profile update attempted but no profile exists");
      return res.status(404).json({ message: "Coding profiles not found. Create them first." });
    }

    await prisma.codingProfiles.update({
      where: { userId: user.userId },
      data: fieldsToUpdate,
    });

    if (parsed.data.leetcode) {
      await fetchLeetcodeQueue.add(
        "fetch-leetcode",
        { userId: user.userId, platform: "leetcode", username: parsed.data.leetcode },
        { priority: 1, jobId: `fetch-leetcode-${user.userId}` },
      );
      log.info({ username: parsed.data.leetcode }, "Queued fetch job for updated platform");
    }

    log.info({ updatedFields: Object.keys(fieldsToUpdate) }, "Coding profiles updated successfully");
    res.status(200).json({ message: "Successfully updated coding profiles" });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to update coding profiles");
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

router.delete("/", async (req, res) => {
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
      log.warn("Coding profile deletion attempted but no profile exists");
      return res.status(404).json({ message: "Coding profiles not found. Create them first." });
    }

    await prisma.codingProfiles.delete({
      where: { userId: user.userId },
    });

    log.info("Coding profiles deleted successfully");
    res.status(200).json({ message: "Successfully deleted coding profiles" });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to delete coding profiles");
    res.status(500).json({ message: "Server Error!" });
  }
});

export default router;
