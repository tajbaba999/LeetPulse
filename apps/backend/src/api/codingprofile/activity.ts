import Express from "express";

import prisma from "@leetplus/db";

const router = Express.Router();

// ── GET /codingprofile/activity ──
router.get("/activity", async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const stats = await prisma.leetCodeStats.findUnique({
      where: { userId: user.userId },
      select: { calendarData: true, streak: true, username: true },
    });

    if (!stats?.calendarData) {
      return res.status(404).json({ message: "No calendar data yet. Run a sync first." });
    }

    const cal = stats.calendarData as Record<string, unknown>;
    const rawCalendar = (cal.submissionCalendar ?? {}) as Record<string, number>;

    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;

    const days: Array<{ date: string; dayOfWeek: number; submissions: number; timestamp: number }> = [];
    for (const [ts, count] of Object.entries(rawCalendar)) {
      const timestamp = Number(ts);
      const d = new Date(timestamp * 1000);
      const dateStr = d.toISOString().split("T")[0];

      if (year && !dateStr.startsWith(String(year)))
        continue;
      if (month && !dateStr.startsWith(`${year ?? new Date().getFullYear()}-${String(month).padStart(2, "0")}`))
        continue;

      days.push({ date: dateStr, dayOfWeek: d.getDay(), submissions: count, timestamp });
    }
    days.sort((a, b) => a.timestamp - b.timestamp);

    const totalSubmissions = days.reduce((sum, d) => sum + d.submissions, 0);

    res.status(200).json({
      username: stats.username,
      activeYears: cal.activeYears,
      totalActiveDays: cal.totalActiveDays,
      streak: stats.streak,
      query: { year: year ?? "all", month: month ?? "all" },
      totalDaysActive: days.length,
      totalSubmissions,
      submissions: days,
    });
  }
  catch (ex) {
    req.log.error({ err: ex }, "Failed to fetch activity");
    res.status(500).json({ message: "Server Error!" });
  }
});

export default router;
