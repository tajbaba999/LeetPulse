"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorState, LoadingBlock, PageHeader, diffColor } from "@/components/ui";
import { getQuestions } from "@/lib/api/codingprofile";
import type { Question } from "@/lib/api/types";

const DIFFICULTIES = ["all", "Easy", "Medium", "Hard"];
const GRID = "44px 1fr 92px 96px 80px 1.2fr 110px";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function QuestionsPage() {
  const [difficulty, setDifficulty] = useState("all");
  const [tag, setTag] = useState("");
  const [debouncedTag, setDebouncedTag] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTag(tag), 300);
    return () => clearTimeout(t);
  }, [tag]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getQuestions({ difficulty, tag: debouncedTag || undefined, limit: 500 })
      .then((r) => {
        if (cancelled) return;
        setQuestions(r.questions);
        setTotal(r.total);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load questions");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [difficulty, debouncedTag, reloadKey]);

  const chip = (active: boolean): React.CSSProperties => ({
    padding: "9px 16px",
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    color: active ? "white" : "var(--text-dim)",
    background: active ? "var(--accent)" : "var(--surface)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
  });

  const subtitle = useMemo(() => `${questions.length} of ${total} solved problems`, [questions.length, total]);

  return (
    <div style={{ padding: "36px 44px" }} className="animate-fadeup">
      <PageHeader title="Questions" subtitle={subtitle} />

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {DIFFICULTIES.map((d) => (
          <div key={d} style={chip(difficulty === d)} onClick={() => setDifficulty(d)}>
            {d === "all" ? "All" : d}
          </div>
        ))}
        <input
          placeholder="Filter by tag…"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          style={{ marginLeft: "auto", padding: "9px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)", fontSize: 13, width: 200, outline: "none", fontFamily: "inherit" }}
        />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 720 }}>
            <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-faint)", borderBottom: "1px solid var(--border)" }}>
              <div>#</div><div>Title</div><div>Difficulty</div><div>Status</div><div>Submits</div><div>Tags</div><div>Solved</div>
            </div>

            {loading ? (
              <LoadingBlock label="Loading questions…" />
            ) : error ? (
              <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
            ) : questions.length === 0 ? (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-faint)", fontSize: 14 }}>No problems match these filters.</div>
            ) : (
              questions.map((q, i) => {
                const dc = diffColor(q.difficulty);
                const accepted = (q.questionStatus ?? q.lastResult ?? "").toUpperCase().includes("AC") || q.questionStatus === "SOLVED";
                return (
                  <a
                    key={q.titleSlug}
                    href={`https://leetcode.com/problems/${q.titleSlug}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "grid", gridTemplateColumns: GRID, padding: "14px 20px", alignItems: "center", borderBottom: "1px solid var(--border)", fontSize: 13, textDecoration: "none", color: "inherit" }}
                  >
                    <div className="font-mono" style={{ color: "var(--text-faint)" }}>{i + 1}</div>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 10 }}>{q.title}</div>
                    <div>
                      <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, color: dc.fg, background: dc.soft }}>{q.difficulty}</span>
                    </div>
                    <div>
                      <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, color: accepted ? "var(--easy)" : "var(--text-dim)", background: accepted ? "var(--easy-soft)" : "var(--surface-2)" }}>
                        {accepted ? "Solved" : "Attempted"}
                      </span>
                    </div>
                    <div className="font-mono" style={{ color: "var(--text-faint)" }}>{q.numSubmitted}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(q.topicTags ?? []).slice(0, 2).map((t) => (
                        <span key={t.slug} style={{ padding: "3px 9px", background: "var(--surface-2)", borderRadius: 6, fontSize: 11, color: "var(--text-dim)" }}>{t.name}</span>
                      ))}
                    </div>
                    <div className="font-mono" style={{ color: "var(--text-faint)", fontSize: 12 }}>{formatDate(q.lastSubmittedAt)}</div>
                  </a>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
