"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import type { LeetCodeStats } from "@/lib/api/types";

// Display name → aliases to match LeetCode skillStats tag names
const TOPIC_ALIASES: Record<string, string[]> = {
  "Array": ["array"],
  "String": ["string"],
  "Hash Table": ["hash table", "hash map"],
  "Dynamic Programming": ["dynamic programming"],
  "Tree": ["tree", "binary tree", "binary search tree", "n-ary tree"],
  "Graph": ["graph"],
  "Two Pointers": ["two pointers", "two pointer"],
  "Sliding Window": ["sliding window"],
  "Linked List": ["linked list"],
  "Matrix": ["matrix"],
  "Backtracking": ["backtracking"],
  "Stack": ["stack"],
  "Heap": ["heap", "priority queue"],
  "Union Find": ["union find", "union-find", "disjoint set"],
  "Binary Search": ["binary search"],
  "Greedy": ["greedy"],
  "Sorting": ["sort", "sorting"],
  "Prefix Sum": ["prefix sum"],
};

const CURATED = Object.keys(TOPIC_ALIASES);
const WEAK_THRESHOLD = 0.3;

function matchTag(tagMap: Map<string, number>, topic: string): number {
  // Direct match first
  const direct = tagMap.get(topic);
  if (direct !== undefined) return direct;
  // Try aliases
  const aliases = TOPIC_ALIASES[topic] ?? [];
  for (const alias of aliases) {
    for (const [key, val] of tagMap) {
      if (key.toLowerCase() === alias) return val;
    }
  }
  return 0;
}

export function WeaknessRadar({ stats }: { stats: LeetCodeStats }) {
  const skillStats = stats.skillStats;
  if (!skillStats) {
    return <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 13 }}>No skill data available.</div>;
  }

  // Flatten all tiers into one map
  const tagMap = new Map<string, number>();
  for (const tier of [skillStats.fundamental, skillStats.intermediate, skillStats.advanced]) {
    for (const tag of tier ?? []) {
      tagMap.set(tag.tagName, (tagMap.get(tag.tagName) ?? 0) + tag.problemsSolved);
    }
  }

  const radarData = CURATED.map((topic) => ({
    topic,
    value: matchTag(tagMap, topic),
  }));

  const maxValue = Math.max(...radarData.map((d) => d.value), 1);

  const data = radarData.map((d) => ({
    ...d,
    pct: Math.round((d.value / maxValue) * 100),
  }));

  const weakTopics = data
    .filter((d) => d.pct < WEAK_THRESHOLD * 100)
    .sort((a, b) => a.pct - b.pct);

  let insight = "";
  if (weakTopics.length >= 2) {
    insight = `${weakTopics[0].topic} and ${weakTopics[1].topic} need immediate attention`;
  } else if (weakTopics.length === 1) {
    insight = `${weakTopics[0].topic} needs attention`;
  } else {
    const sorted = [...data].sort((a, b) => a.pct - b.pct);
    insight = `${sorted[0].topic} is your weakest area (${sorted[0].value} solved)`;
  }

  return (
    <div>
      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis
              dataKey="topic"
              tick={({ x, y, payload }) => {
                const entry = data.find((d) => d.topic === payload.value);
                const isWeak = entry ? entry.pct < WEAK_THRESHOLD * 100 : false;
                return (
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isWeak ? "#e05555" : "var(--text-dim)"}
                    fontSize={10}
                    fontWeight={600}
                  >
                    {payload.value} {entry?.value ?? 0}
                  </text>
                );
              }}
            />
            <Radar
              dataKey="pct"
              stroke="#6482ff"
              fill="#6482ff"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={{ r: 3, fill: "#6482ff", stroke: "var(--bg-elevated, #1a1a2e)", strokeWidth: 1.5 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
        {insight}
      </div>
    </div>
  );
}
