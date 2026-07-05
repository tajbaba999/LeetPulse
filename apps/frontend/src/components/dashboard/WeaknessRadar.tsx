"use client";

import { useEffect, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { RadarChart } from "@mui/x-charts/RadarChart";
import type { TopicMatrix } from "@/lib/api/types";

const TOPICS_ORDER = [
  "Array", "String", "Hash Table",   "DP", "Tree",
  "Graph", "Two Pointers", "Sliding Window", "Linked List", "Matrix",
  "Backtracking", "Stack", "Heap", "Union Find", "Binary Search",
  "Greedy", "Sorting", "Prefix Sum",
];

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    text: { primary: "#e0e0e0", secondary: "#9e9e9e" },
    divider: "rgba(255,255,255,0.12)",
    background: { paper: "#1a1a2e", default: "#0d0d1a" },
  },
});

const lightTheme = createTheme({
  palette: {
    mode: "light",
    text: { primary: "#1a1a1a", secondary: "#666" },
    divider: "rgba(0,0,0,0.1)",
    background: { paper: "#fff", default: "#fafafa" },
  },
});

function useThemeMode() {
  const [mode, setMode] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const check = () => {
      const theme = document.documentElement.getAttribute("data-theme");
      setMode(theme === "light" ? "light" : "dark");
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return mode;
}

export function WeaknessRadar({ data }: { data: TopicMatrix }) {
  const mode = useThemeMode();

  if (!data || data.length === 0) {
    return <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 13 }}>No topic data available.</div>;
  }

  const sorted = [...data].sort((a, b) => {
    const ai = TOPICS_ORDER.indexOf(a.topic);
    const bi = TOPICS_ORDER.indexOf(b.topic);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const metrics = sorted.map((d) => d.topic);
  const easyData = sorted.map((d) => d.easy);
  const mediumData = sorted.map((d) => d.medium);
  const hardData = sorted.map((d) => d.hard);
  const maxValue = Math.max(...easyData, ...mediumData, ...hardData, 1);

  const totals = sorted.map((d) => ({ topic: d.topic, total: d.easy + d.medium + d.hard }));
  const sortedByTotal = [...totals].sort((a, b) => a.total - b.total);
  const weakTopics = sortedByTotal.filter((t) => t.total > 0).slice(0, 2);
  let insight = "";
  if (weakTopics.length >= 2) {
    insight = `${weakTopics[0].topic} and ${weakTopics[1].topic} need immediate attention`;
  } else if (weakTopics.length === 1) {
    insight = `${weakTopics[0].topic} needs attention`;
  } else if (sortedByTotal.length > 0) {
    insight = `${sortedByTotal[0].topic} is your weakest area`;
  }

  return (
    <ThemeProvider theme={mode === "dark" ? darkTheme : lightTheme}>
      <CssBaseline />
      <RadarChart
        height={340}
        radar={{ max: maxValue, metrics }}
        series={[
          { label: "Easy", data: easyData, color: "#4caf50", fillArea: true, hideMark: false },
          { label: "Medium", data: mediumData, color: "#ffc107", fillArea: true, hideMark: false },
          { label: "Hard", data: hardData, color: "#f44336", fillArea: true, hideMark: false },
        ]}
      />
      <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
        {insight}
      </div>
    </ThemeProvider>
  );
}
