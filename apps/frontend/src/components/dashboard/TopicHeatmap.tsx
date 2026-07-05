"use client";

import type { TopicMatrix } from "@/lib/api/types";

const TOPICS_ORDER = [
  "Array", "String", "Hash Table",   "DP", "Tree",
  "Graph", "Two Pointers", "Sliding Window", "Linked List", "Matrix",
  "Backtracking", "Stack", "Heap", "Union Find", "Binary Search",
  "Greedy", "Sorting", "Prefix Sum",
];

function cellColor(count: number): { bg: string; fg: string } {
  if (count === 0) return { bg: "rgb(130, 35, 35)", fg: "#e05555" };
  if (count <= 4) return { bg: "rgb(238, 238, 230)", fg: "var(--text)" };
  if (count <= 19) return { bg: "rgb(210, 225, 190)", fg: "var(--text)" };
  return { bg: "rgb(140, 180, 80)", fg: "var(--text)" };
}

export function TopicHeatmap({ data }: { data: TopicMatrix }) {
  if (!data || data.length === 0) {
    return <div style={{ padding: 20, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>No topic data available.</div>;
  }

  // Sort data according to TOPICS_ORDER
  const sorted = [...data].sort((a, b) => {
    const ai = TOPICS_ORDER.indexOf(a.topic);
    const bi = TOPICS_ORDER.indexOf(b.topic);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const blindSpots = sorted.filter((r) => r.hard === 0).map((r) => r.topic);
  let footer = "";
  if (blindSpots.length > 0) {
    const list = blindSpots.length <= 2 ? blindSpots.join(" and ") : `${blindSpots[0]}, ${blindSpots[1]} and ${blindSpots.length - 2} more`;
    footer = `Red cells = blind spots. Zero hard ${list} problems.`;
  }

  return (
    <div>
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto repeat(3, 1fr)",
          gap: 8,
          marginBottom: 10,
          paddingLeft: 8,
        }}
      >
        <div />
        {["Easy", "Medium", "Hard"].map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-dim)",
              padding: "6px 0",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Data rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {sorted.map((row) => (
          <div
            key={row.topic}
            style={{
              display: "grid",
              gridTemplateColumns: "auto repeat(3, 1fr)",
              gap: 8,
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-dim)",
                paddingRight: 8,
                minWidth: 110,
                textAlign: "right",
              }}
            >
              {row.topic}
            </div>
            {([row.easy, row.medium, row.hard] as const).map((count, i) => {
              const { bg, fg } = cellColor(count);
              return (
                <div
                  key={`${row.topic}-${i}`}
                  style={{
                    background: bg,
                    borderRadius: 6,
                    padding: "12px 0",
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: 600,
                    color: fg,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {count}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {footer && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-faint)",
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
