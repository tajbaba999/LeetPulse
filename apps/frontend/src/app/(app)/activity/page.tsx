"use client";

import { useEffect, useMemo, useState } from "react";

import { TopicHeatmap } from "@/components/dashboard/TopicHeatmap";
import { WeaknessRadar } from "@/components/dashboard/WeaknessRadar";
import { Card, ErrorState, LoadingBlock, PageHeader } from "@/components/ui";
import { getActivity, getTopicMatrix } from "@/lib/api/codingprofile";
import type { ActivityResponse, LeetCodeStats, TopicMatrix } from "@/lib/api/types";
import { useAppData } from "@/lib/app-data-context";

const WEEKS = 53;

function cellColor(count: number, max: number): string {
  if (count <= 0) return "var(--surface-2)";
  const ratio = max > 0 ? count / max : 0;
  if (ratio > 0.66) return "var(--accent)";
  if (ratio > 0.33) return "oklch(0.58 0.21 260.84 / 0.6)";
  return "oklch(0.58 0.21 260.84 / 0.3)";
}

function buildGrid(byDate: Map<string, number>) {
  // End at the most recent Saturday so columns align to weeks.
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end);
  start.setDate(start.getDate() - (WEEKS * 7 - 1));

  const weeks: { date: string; count: number }[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < WEEKS; w++) {
    const days: { date: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = cursor.toISOString().split("T")[0];
      days.push({ date: iso, count: byDate.get(iso) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }
  return weeks;
}

function computeStats(byDate: Map<string, number>) {
  const dates = [...byDate.entries()].filter(([, c]) => c > 0).map(([d]) => d).sort();
  // Longest streak of consecutive active days.
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of dates) {
    const t = new Date(d).getTime() / 86400000;
    if (prev !== null && Math.round(t - prev) === 1) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
    prev = t;
  }
  // Most active weekday.
  const weekdayTotals = new Array(7).fill(0);
  for (const [d, c] of byDate) weekdayTotals[new Date(d).getDay()] += c;
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const maxIdx = weekdayTotals.indexOf(Math.max(...weekdayTotals));
  const mostActive = weekdayTotals[maxIdx] > 0 ? names[maxIdx] : "—";
  return { longest, mostActive };
}

export default function ActivityPage() {
  const { codingProfile } = useAppData();
  const leetcodeStats: LeetCodeStats | null = codingProfile?.stats.leetcode ?? null;
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [topicMatrix, setTopicMatrix] = useState<TopicMatrix>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getActivity(),
      getTopicMatrix(),
    ])
      .then(([act, matrix]) => {
        if (!cancelled) { setData(act); setTopicMatrix(matrix); }
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load activity"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const { weeks, max, stats, totalSubmissions } = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of data?.submissions ?? []) byDate.set(s.date, s.submissions);
    const max = Math.max(1, ...[...byDate.values()]);
    return {
      weeks: buildGrid(byDate),
      max,
      stats: computeStats(byDate),
      totalSubmissions: data?.totalSubmissions ?? 0,
    };
  }, [data]);

  return (
    <div style={{ padding: "36px 44px" }} className="animate-fadeup">
      <PageHeader
        title="Activity"
        subtitle={data ? `${totalSubmissions.toLocaleString()} submissions across the last year` : undefined}
      />

      {loading ? (
        <LoadingBlock label="Loading activity…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : (
        <>
          <Card style={{ marginBottom: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 3, overflowX: "auto", paddingBottom: 6, justifyContent: "center" }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {week.map((day) => (
                    <div
                      key={day.date}
                      title={`${day.date}: ${day.count} submission${day.count === 1 ? "" : "s"}`}
                      style={{ width: 11, height: 11, borderRadius: 3, background: cellColor(day.count, max) }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, fontSize: 11, color: "var(--text-faint)" }}>
              Less
              {["var(--surface-2)", "oklch(0.58 0.21 260.84 / 0.3)", "oklch(0.58 0.21 260.84 / 0.6)", "var(--accent)"].map((c) => (
                <span key={c} style={{ width: 11, height: 11, borderRadius: 3, background: c, display: "inline-block" }} />
              ))}
              More
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
            <StatTile label="Current streak" value={`${data?.streak ?? 0}`} unit="days" />
            <StatTile label="Longest streak" value={`${stats.longest}`} unit="days" />
            <StatTile label="Most active day" value={stats.mostActive} />
          </div>

          {/* Weakness Radar + Topic Heatmap */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Weakness radar</div>
              {leetcodeStats && <WeaknessRadar stats={leetcodeStats} />}
            </Card>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Topic × difficulty heatmap</div>
              <TopicHeatmap data={topicMatrix} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 26, display: "flex", alignItems: "center", gap: 8 }}>
        {value} {unit && <span style={{ fontSize: 16 }}>{unit}</span>}
      </div>
    </Card>
  );
}
