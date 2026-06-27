import Express from "express";

import type { Platform } from "../../types/coding-profiles.js";

import prisma from "../../db.js";
import { getQueueForPlatform } from "../../queues/sync.queue.js";
import { codingProfileSchema } from "../../validators/profile.validator.js";

const platforms: Platform[] = ["leetcode", "geeksforgeeks", "codechef", "codeforces"];

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

    // Extract usernames from URLs before validation
    const raw = req.body as Record<string, string | undefined>;
    const normalized = {
      leetcode: extractUsername(raw.leetcode),
      codeforces: extractUsername(raw.codeforces),
      codechef: extractUsername(raw.codechef),
      hackerrank: extractUsername(raw.hackerrank),
      geeksforgeeks: extractUsername(raw.geeksforgeeks),
    };

    const allprofiles = codingProfileSchema.safeParse(normalized);

    if (!allprofiles.success) {
      log.warn("Coding profile creation request failed validation");
      return res.status(422).json({ message: "Invalid coding profiles" });
    }

    const { leetcode, codeforces, codechef, hackerrank, geeksforgeeks } = allprofiles.data;

    const existingProfile = await prisma.codingProfiles.findUnique({
      where: { userId: user.userId },
    });

    if (existingProfile) {
      log.warn("Coding profiles already exist for user");
      return res.status(400).json({ message: "Coding profiles already exist" });
    }

    await prisma.codingProfiles.create({
      data: { userId: user.userId, leetcode, codeforces, codechef, hackerrank, geeksforgeeks },
    });

    // Queue sync jobs for each platform that has a username provided.
    // Priority 3 = signup full sync (lower than manual update).
    // jobId deduplicates: if this user+platform job is already queued/active, the add is a no-op.
    for (const platform of platforms) {
      const username = allprofiles.data[platform];
      if (username) {
        const queue = getQueueForPlatform(platform);
        await queue.add(`sync-${platform}`, {
          userId: user.userId,
          platform,
          username,
        }, {
          priority: 3,
          jobId: `sync-${platform}-${user.userId}`,
        });
        log.info({ platform, username }, "Queued sync job");
      }
    }

    log.info("Coding profiles created successfully");
    res.status(200).json({ message: "Successfully added coding profiles" });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to create coding profiles");
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

    // Extract usernames from URLs before validation
    const raw = req.body as Record<string, string | undefined>;
    const normalized = {
      leetcode: extractUsername(raw.leetcode),
      codeforces: extractUsername(raw.codeforces),
      codechef: extractUsername(raw.codechef),
      hackerrank: extractUsername(raw.hackerrank),
      geeksforgeeks: extractUsername(raw.geeksforgeeks),
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

    // Re-sync platforms that were updated.
    // Priority 1 = manual "Update Profile" click (highest priority per architecture).
    // jobId deduplicates: replaces any existing queued job for this user+platform.
    for (const platform of platforms) {
      const username = parsed.data[platform];
      if (username) {
        const queue = getQueueForPlatform(platform);
        await queue.add(`sync-${platform}`, {
          userId: user.userId,
          platform,
          username,
        }, {
          priority: 1,
          jobId: `sync-${platform}-${user.userId}`,
        });
        log.info({ platform, username }, "Queued sync job for updated platform");
      }
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

    const [profiles, leetCodeStats, codeforcesStats, codechefStats, geeksforgeeksStats] = await Promise.all([
      prisma.codingProfiles.findUnique({ where: { userId: user.userId } }),
      prisma.leetCodeStats.findUnique({ where: { userId: user.userId } }),
      prisma.codeforcesStats.findUnique({ where: { userId: user.userId } }),
      prisma.codechefStats.findUnique({ where: { userId: user.userId } }),
      prisma.geeksforgeeksStats.findUnique({ where: { userId: user.userId } }),
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
        codeforces: codeforcesStats,
        codechef: codechefStats,
        geeksforgeeks: geeksforgeeksStats,
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
