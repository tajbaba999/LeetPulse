"use client";

import { useEffect, useState } from "react";

import { Card, CardTitle, LoadingBlock, PageHeader } from "@/components/ui";
import { getHistory } from "@/lib/api/codingprofile";
import type { HistorySnapshot } from "@/lib/api/types";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth-context";

function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { codingProfile } = useAppData();
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory(30).then((r) => setHistory(r.snapshots)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const stats = codingProfile?.stats.leetcode ?? null;
  const username = codingProfile?.profiles?.leetcode ?? "";
  const name = user?.name ?? username ?? "You";
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const rows: { label: string; value: string }[] = [
    { label: "Ranking", value: stats ? `#${stats.ranking.toLocaleString()}` : "—" },
    { label: "Contest rating", value: stats && stats.contestRating ? Math.round(stats.contestRating).toLocaleString() : "—" },
    { label: "Contests entered", value: stats ? `${stats.attendedContestsCount}` : "—" },
    { label: "Acceptance rate", value: stats ? `${Number(stats.acceptanceRate).toFixed(1)}%` : "—" },
    { label: "Member since", value: fmtDate(user?.createdAt) },
    { label: "Last synced", value: fmtDate(stats?.updatedAt, true) },
  ];

  return (
    <div style={{ padding: "36px 44px" }} className="animate-fadeup">
      <PageHeader title="Profile & history" subtitle="Snapshots are captured on every sync." />

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
        <Card style={{ height: "fit-content" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>
              {initials || "·"}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{name}</div>
              <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{username || user?.email}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {rows.map((r) => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-dim)" }}>{r.label}</span>
                <span className="font-mono" style={{ fontWeight: 600 }}>{r.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle right={<span className="font-mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>{history.length} snapshots</span>}>Snapshot history</CardTitle>
          {loading ? (
            <LoadingBlock label="Loading history…" />
          ) : history.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)", padding: "8px 0" }}>No snapshots yet — they accumulate each time you sync.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {history.map((snap, i) => {
                const prev = history[i + 1];
                const delta = prev ? snap.totalSolved - prev.totalSolved : 0;
                return (
                  <div key={snap.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16, alignItems: "center", padding: "12px 0", borderBottom: i < history.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ fontSize: 13 }}>{fmtDate(snap.snapshotAt, true)}</div>
                    <div className="font-mono" style={{ fontSize: 13, color: "var(--text-dim)" }}>{snap.totalSolved.toLocaleString()} solved</div>
                    <div className="font-mono" style={{ fontSize: 12, fontWeight: 600, minWidth: 44, textAlign: "right", color: delta > 0 ? "var(--easy)" : "var(--text-faint)" }}>
                      {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
