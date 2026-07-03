import Express from "express";

import prisma from "../../db.js";
import { env } from "../../env.js";
import { fetchLeetcodeQueue } from "../../queues/fetch.queue.js";
import { processLeetcodeQueue } from "../../queues/process.queue.js";

function extractUsername(value: string | undefined): string | undefined {
  if (!value)
    return undefined;
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || value;
  }
  catch {
    return value;
  }
}

function resolveUsername(body: string | undefined): string | undefined {
  const fromBody = extractUsername(body);
  if (fromBody)
    return fromBody;
  return env.LEETCODE_USERNAME?.trim() || undefined;
}

async function cleanOldJobs(userId: string): Promise<void> {
  const fetchJobId = `fetch-leetcode-${userId}`;
  const processJobId = `process-leetcode-${userId}`;
  const oldFetchJob = await fetchLeetcodeQueue.getJob(fetchJobId);
  if (oldFetchJob)
    await oldFetchJob.remove().catch(() => {});
  const oldProcessJob = await processLeetcodeQueue.getJob(processJobId);
  if (oldProcessJob)
    await oldProcessJob.remove().catch(() => {});
}

const router = Express.Router();

// ── POST /codingprofile ──
// Creates coding profile. Body is optional if LEETCODE_USERNAME is in .env.
router.post("/", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const log = req.log.child({ userId: user.userId });
    const raw = req.body as Record<string, string | undefined>;
    const username = resolveUsername(raw.leetcode);

    const existingProfile = await prisma.codingProfiles.findUnique({
      where: { userId: user.userId },
    });

    if (existingProfile) {
      log.warn("Coding profiles already exist for user");
      return res.status(400).json({ message: "Coding profiles already exist" });
    }

    await prisma.codingProfiles.create({
      data: { userId: user.userId, leetcode: username ?? null },
    });

    if (username) {
      await fetchLeetcodeQueue.add(
        "fetch-leetcode",
        { userId: user.userId, username },
        { priority: 3, jobId: `fetch-leetcode-${user.userId}` },
      );
      log.info({ username }, "Queued fetch job");
    }

    log.info("Coding profiles created successfully");
    res.status(200).json({
      message: "Successfully added coding profiles",
      leetcode: username ?? null,
      syncQueued: !!username,
    });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to create coding profiles");
    res.status(500).json({ message: "Server Error!" });
  }
});

// ── POST /codingprofile/initial-sync ──
// After signup: creates profile + queues full sync. Body is optional if LEETCODE_USERNAME is in .env.
router.post("/initial-sync", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const log = req.log.child({ userId: user.userId });
    const raw = req.body as Record<string, string | undefined>;
    const username = resolveUsername(raw?.leetcode);

    if (!username) {
      return res.status(400).json({
        message: "LeetCode username is required. Provide in body or set LEETCODE_USERNAME in .env",
      });
    }

    // Create profile if not exists (immutable — won't overwrite if exists)
    const existingProfile = await prisma.codingProfiles.findUnique({
      where: { userId: user.userId },
    });

    if (!existingProfile) {
      await prisma.codingProfiles.create({
        data: { userId: user.userId, leetcode: username },
      });
    }

    // Clean old jobs then queue fresh fetch
    await cleanOldJobs(user.userId);
    const fetchJobId = `fetch-leetcode-${user.userId}`;
    await fetchLeetcodeQueue.add(
      "fetch-leetcode",
      { userId: user.userId, username },
      { priority: 3, jobId: fetchJobId },
    );

    log.info({ username }, "Initial sync queued");
    res.status(202).json({
      message: "Initial sync started",
      username,
      fetchJobId,
      note: "Stream progress: GET /codingprofile/sync/stream?token=<accessToken>",
    });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to start initial sync");
    res.status(500).json({ message: "Server Error!" });
  }
});

// ── POST /codingprofile/sync ──
// Smart sync: compares DB vs live LeetCode, picks optimal strategy.
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
      return res.status(404).json({ message: "No coding profile linked. Call POST /codingprofile first." });
    }

    const username = profile.leetcode || env.LEETCODE_USERNAME?.trim();
    if (!username) {
      return res.status(400).json({ message: "No LeetCode username linked." });
    }

    // Compare DB vs live
    const dbStats = await prisma.leetCodeStats.findUnique({
      where: { userId: user.userId },
      select: { totalSolved: true },
    });
    const dbSolved = dbStats?.totalSolved ?? 0;

    let liveSolved = 0;
    try {
      const { fetchLeetCodeProfile } = await import("../../fetchers/leetcodeFetcher.js");
      const liveProfile = await fetchLeetCodeProfile(username);
      liveSolved = liveProfile.totalSolved;
    }
    catch {
      log.warn("Could not fetch live LeetCode profile, falling back to full sync");
    }

    const diff = Math.abs(liveSolved - dbSolved);
    let strategy: "full" | "progress" | "incremental";

    if (dbSolved === 0 || dbSolved > liveSolved)
      strategy = "full";
    else if (diff > 20)
      strategy = "progress";
    else strategy = "incremental";

    await cleanOldJobs(user.userId);
    await fetchLeetcodeQueue.add(
      "fetch-leetcode",
      { userId: user.userId, username },
      { priority: 1, jobId: `fetch-leetcode-${user.userId}` },
    );

    res.status(202).json({
      message: `Sync started (${strategy})`,
      username,
      strategy,
      dbSolved,
      liveSolved,
      diff,
    });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to start sync");
    res.status(500).json({ message: "Server Error!" });
  }
});

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
        id: true,
        snapshotAt: true,
        totalSolved: true,
        totalQuestions: true,
        easySolved: true,
        mediumSolved: true,
        hardSolved: true,
        ranking: true,
        acceptanceRate: true,
        streak: true,
        contestRating: true,
        contestGlobalRanking: true,
        contestTopPercentage: true,
        attendedContestsCount: true,
        problemsSolvedList: true,
        contestHistory: true,
        skillStats: true,
        languageStats: true,
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

// ── GET /codingprofile/activity ──
// Returns parsed submission calendar for activity queries.
// Query params: ?year=2026&month=7 (both optional)
router.get("/activity", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const stats = await prisma.leetCodeStats.findUnique({
      where: { userId: user.userId },
      select: { calendarData: true },
    });

    if (!stats?.calendarData) {
      return res.status(404).json({ message: "No calendar data yet. Run a sync first." });
    }

    const cal = stats.calendarData as Record<string, unknown>;
    const rawCalendar = (cal.submissionCalendar ?? {}) as Record<string, number>;

    // Parse timestamps into date-keyed format
    const days: Array<{ date: string; dayOfWeek: number; submissions: number }> = [];
    for (const [ts, count] of Object.entries(rawCalendar)) {
      const d = new Date(Number(ts) * 1000);
      days.push({
        date: d.toISOString().split("T")[0],
        dayOfWeek: d.getDay(),
        submissions: count,
      });
    }
    days.sort((a, b) => a.date.localeCompare(b.date));

    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;

    let filtered = days;
    if (year)
      filtered = filtered.filter(d => d.date.startsWith(String(year)));
    if (month)
      filtered = filtered.filter(d => d.date.startsWith(`${year ?? new Date().getFullYear()}-${String(month).padStart(2, "0")}`));

    const totalDays = filtered.length;
    const totalSubmissions = filtered.reduce((sum, d) => sum + d.submissions, 0);

    res.status(200).json({
      activeYears: cal.activeYears,
      totalActiveDays: cal.totalActiveDays,
      streak: cal.streak,
      query: { year: year ?? "all", month: month ?? "all" },
      totalDaysActive: totalDays,
      totalSubmissions,
      days: filtered,
    });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to fetch activity");
    res.status(500).json({ message: "Server Error!" });
  }
});

// ── GET /codingprofile/questions ──
// Returns all solved problems with topic tags from DB.
// Query params: ?difficulty=easy&tag=arrays&limit=50
router.get("/questions", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const difficulty = req.query.difficulty as string | undefined;
    const tag = req.query.tag as string | undefined;

    const problems = await prisma.leetCodeProblem.findMany({
      where: { userId: user.userId },
      orderBy: { lastSubmittedAt: "desc" },
    });

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

    const sliced = filtered.slice(0, limit);

    res.status(200).json({
      total: filtered.length,
      limit,
      difficulty: difficulty ?? "all",
      tag: tag ?? "all",
      questions: sliced.map(p => ({
        frontendId: p.titleSlug.split("-").pop() ?? "",
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
