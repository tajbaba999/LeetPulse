"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Bar, DifficultyDonut, TrendChart } from "@/components/dashboard/charts";
import { ResyncIcon } from "@/components/icons";
import { Card, CardTitle, LoadingBlock, PageHeader } from "@/components/ui";
import { getHistory } from "@/lib/api/codingprofile";
import type { HistorySnapshot, LeetCodeStats } from "@/lib/api/types";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth-context";

const PAGE = { padding: "36px 44px" };

export default function DashboardPage() {
  const { codingProfile, loading } = useAppData();
  const { user } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<HistorySnapshot[]>([]);

  useEffect(() => {
    getHistory(8).then((r) => setHistory(r.snapshots)).catch(() => {});
  }, []);

  if (loading) {
    return <div style={PAGE}><LoadingBlock label="Loading dashboard…" /></div>;
  }

  const stats = codingProfile?.stats.leetcode ?? null;
  const firstName = (user?.name ?? "there").split(" ")[0];

  if (!stats) {
    return (
      <div style={PAGE} className="animate-fadeup">
        <PageHeader title={`Hey ${firstName}`} subtitle="No synced data yet." />
        <Card>
          <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-dim)" }}>
            Run a sync to pull your LeetCode stats.
            <div style={{ marginTop: 16 }}>
              <button onClick={() => router.push("/onboarding?resync=1")} style={resyncBtn}>Sync now</button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const acceptancePct = Number(stats.acceptanceRate ?? 0).toFixed(1);

  const statCards = [
    { label: "Total solved", value: stats.totalSolved.toLocaleString(), sub: `of ${stats.totalQuestions.toLocaleString()}` },
    { label: "Global ranking", value: `#${stats.ranking.toLocaleString()}` },
    { label: "Acceptance", value: `${acceptancePct}%` },
    { label: "Current streak", value: `${stats.streak}`, sub: "days" },
  ];

  const trendValues = [...history].reverse().map((s) => s.totalSolved);

  return (
    <div style={PAGE} className="animate-fadeup">
      <PageHeader
        title={`Hey ${firstName}`}
        subtitle="Here's how your practice looks."
        right={
          <div onClick={() => router.push("/onboarding?resync=1")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-dim)" }}>
            <ResyncIcon size={14} /> Re-sync
          </div>
        }
      />

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {statCards.map((card) => (
          <Card key={card.label} style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 14 }}>{card.label}</div>
            <div style={{ fontWeight: 700, fontSize: 28, letterSpacing: "-0.02em" }}>{card.value}</div>
            {card.sub && <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>{card.sub}</div>}
          </Card>
        ))}
      </div>

      {/* Trend + Donut */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <CardTitle right={<span className="font-mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>last {trendValues.length} snapshots</span>}>Solved over time</CardTitle>
          <TrendChart values={trendValues} />
        </Card>
        <Card style={{ display: "flex", flexDirection: "column" }}>
          <CardTitle>Difficulty split</CardTitle>
          <DifficultyDonut easy={stats.easySolved} medium={stats.mediumSolved} hard={stats.hardSolved} />
        </Card>
      </div>

      {/* Languages + Submissions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <LanguageCard stats={stats} />
        <SubmissionsCard stats={stats} />
      </div>

      {/* Skill coverage */}
      <SkillCoverage stats={stats} />
    </div>
  );
}

function LanguageCard({ stats }: { stats: LeetCodeStats }) {
  const langs = (stats.languageStats ?? []).slice().sort((a, b) => b.problemsSolved - a.problemsSolved).slice(0, 6);
  const max = langs[0]?.problemsSolved ?? 0;
  return (
    <Card>
      <CardTitle>Solved by language</CardTitle>
      {langs.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-faint)" }}>No language data.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {langs.map((l) => (
            <div key={l.languageName}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                <span>{l.languageName}</span>
                <span className="font-mono" style={{ color: "var(--text-faint)" }}>{l.problemsSolved}</span>
              </div>
              <Bar value={l.problemsSolved} max={max} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SubmissionsCard({ stats }: { stats: LeetCodeStats }) {
  const ac = stats.sessionProgress?.acSubmissionNum ?? [];
  const total = stats.sessionProgress?.totalSubmissionNum ?? [];
  const sum = (arr: { submissions: number }[]) => arr.reduce((s, x) => s + (x.submissions ?? 0), 0);
  const submitted = sum(total);
  const accepted = sum(ac);
  const failed = Math.max(0, submitted - accepted);
  const beats = Math.round(stats.questionProgress?.totalQuestionBeatsPercentage ?? 0);

  const byDiff = ["Easy", "Medium", "Hard"].map((d) => {
    const a = ac.find((x) => x.difficulty === d)?.submissions ?? 0;
    const t = total.find((x) => x.difficulty === d)?.submissions ?? 0;
    return { d, accepted: a, failed: Math.max(0, t - a), total: t };
  });

  const tiles = [
    { label: "Submitted", value: submitted, bg: "var(--surface-2)", fg: "var(--text)" },
    { label: "Accepted", value: accepted, bg: "var(--easy-soft)", fg: "var(--easy)" },
    { label: "Failed", value: failed, bg: "var(--hard-soft)", fg: "var(--hard)" },
  ];

  return (
    <Card>
      <CardTitle right={<span className="font-mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>beats {beats}%</span>}>Submissions</CardTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ padding: 12, background: t.bg, borderRadius: 10 }}>
            <div style={{ fontSize: 10.5, color: t.fg === "var(--text)" ? "var(--text-faint)" : t.fg, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{t.label}</div>
            <div className="font-mono" style={{ fontWeight: 700, fontSize: 18, color: t.fg }}>{t.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {byDiff.map((row) => {
          const accW = row.total > 0 ? (row.accepted / row.total) * 100 : 0;
          const failW = row.total > 0 ? (row.failed / row.total) * 100 : 0;
          const color = row.d === "Easy" ? "var(--easy)" : row.d === "Hard" ? "var(--hard)" : "var(--medium)";
          return (
            <div key={row.d}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 5 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
                  {row.d}
                </span>
                <span className="font-mono" style={{ color: "var(--text-faint)" }}>{row.accepted} ok · {row.failed} fail</span>
              </div>
              <div style={{ height: 5, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${accW}%`, background: color }} />
                <div style={{ width: `${failW}%`, background: "var(--hard)", opacity: 0.5 }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SkillCoverage({ stats }: { stats: LeetCodeStats }) {
  const skills = stats.skillStats;
  const groups = [
    { name: "Fundamental", skills: skills?.fundamental ?? [] },
    { name: "Intermediate", skills: skills?.intermediate ?? [] },
    { name: "Advanced", skills: skills?.advanced ?? [] },
  ];
  const hasAny = groups.some((g) => g.skills.length > 0);

  return (
    <Card>
      <CardTitle>Skill coverage</CardTitle>
      {!hasAny ? (
        <div style={{ fontSize: 13, color: "var(--text-faint)" }}>No skill data.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
          {groups.map((grp) => {
            const top = grp.skills.slice().sort((a, b) => b.problemsSolved - a.problemsSolved).slice(0, 5);
            const max = top[0]?.problemsSolved ?? 0;
            return (
              <div key={grp.name}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-faint)", marginBottom: 12 }}>{grp.name}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {top.length === 0 && <div style={{ fontSize: 12, color: "var(--text-faint)" }}>—</div>}
                  {top.map((sk) => (
                    <div key={sk.tagName}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                        <span>{sk.tagName}</span>
                        <span className="font-mono" style={{ color: "var(--text-faint)" }}>{sk.problemsSolved}</span>
                      </div>
                      <Bar value={sk.problemsSolved} max={max} color="var(--accent)" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

const resyncBtn: React.CSSProperties = {
  padding: "10px 18px",
  background: "var(--accent)",
  color: "white",
  fontWeight: 700,
  fontSize: 13,
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontFamily: "inherit",
};
