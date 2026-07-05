"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ErrorState, LoadingBlock, PageHeader, diffColor } from "@/components/ui";
import { getLeetCodeProgress } from "@/lib/api/codingprofile";
import type { Question } from "@/lib/api/types";

const DIFFICULTIES = ["all", "Easy", "Medium", "Hard"];
const GRID = "44px 1fr 92px 96px 80px 1.2fr 110px";
const PAGE_SIZE = 50;

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTag(tag), 300);
    return () => clearTimeout(t);
  }, [tag]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setQuestions([]);
    setHasMore(true);
    getLeetCodeProgress({ skip: 0, limit: PAGE_SIZE })
      .then((r) => {
        if (cancelled) return;
        setQuestions(r.questions);
        setTotal(r.totalNum);
        setHasMore(r.hasMore);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load questions");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    getLeetCodeProgress({ skip: questions.length, limit: PAGE_SIZE })
      .then((r) => {
        setQuestions((prev) => [...prev, ...r.questions]);
        setTotal(r.totalNum);
        setHasMore(r.hasMore);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, questions.length]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 },
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => { observerRef.current?.disconnect(); };
  }, [loadMore]);

  // Client-side filter for difficulty/tag (since leetcode/progress returns all)
  const filtered = useMemo(() => {
    let result = questions;
    if (difficulty !== "all") {
      const d = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
      result = result.filter((q) => q.difficulty === d);
    }
    if (debouncedTag) {
      const t = debouncedTag.toLowerCase();
      result = result.filter((q) =>
        (q.topicTags ?? []).some((tag) =>
          tag.name.toLowerCase().includes(t) || tag.slug.toLowerCase().includes(t),
        ),
      );
    }
    return result;
  }, [questions, difficulty, debouncedTag]);

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

  const subtitle = useMemo(() => {
    if (total === 0 && !loading) return "No solved problems found";
    return `Showing ${filtered.length} of ${total} solved problems`;
  }, [filtered.length, total, loading]);

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
            ) : filtered.length === 0 ? (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-faint)", fontSize: 14 }}>No problems match these filters.</div>
            ) : (
              <>
                {filtered.map((q, i) => {
                  const dc = diffColor(q.difficulty);
                  const accepted = (q.questionStatus ?? q.lastResult ?? "").toUpperCase().includes("AC") || q.questionStatus === "SOLVED";
                  return (
                    <a
                      key={`${q.titleSlug}-${i}`}
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
                })}
                <div ref={sentinelRef} style={{ height: 1 }} />
                {loadingMore && (
                  <div style={{ padding: "20px", textAlign: "center" }}>
                    <LoadingBlock label="Loading more…" />
                  </div>
                )}
                {!hasMore && filtered.length > 0 && (
                  <div style={{ padding: "16px 20px", textAlign: "center", color: "var(--text-faint)", fontSize: 12 }}>
                    All {total} problems loaded
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
