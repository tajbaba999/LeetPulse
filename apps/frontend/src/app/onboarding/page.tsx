"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { CheckIcon, LogoMark } from "@/components/icons";
import { getCodingProfile, streamSync } from "@/lib/api/codingprofile";
import { useAuth } from "@/lib/auth-context";

const PENDING_LEETCODE_KEY = "leetpulse.pendingLeetcode";

// Canonical sync stages, keyed to the backend's linear pct so we can render a
// checklist from the flat {stage,pct,msg} progress events.
const STAGES: { label: string; threshold: number }[] = [
  { label: "Fetch LeetCode profile", threshold: 10 },
  { label: "Fetch contest history", threshold: 15 },
  { label: "Fetch question progress", threshold: 20 },
  { label: "Fetch session progress", threshold: 24 },
  { label: "Fetch skills & languages", threshold: 32 },
  { label: "Fetch submission calendar", threshold: 42 },
  { label: "Save snapshot to database", threshold: 70 },
  { label: "Index everything for AI chat", threshold: 99 },
  { label: "Done", threshold: 100 },
];

type Phase = "need-username" | "syncing" | "indexing" | "error";

export default function OnboardingPage() {
  const router = useRouter();
  const { status } = useAuth();
  const [phase, setPhase] = useState<Phase>("syncing");
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState("Starting sync…");
  const [error, setError] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const startedRef = useRef(false);

  const runSync = useCallback(
    async (leetcode: string | undefined, kind: "initial-sync" | "sync" = "initial-sync") => {
      setPhase("syncing");
      setError(null);
      setPct(0);
      setMsg("Starting sync…");

      await streamSync(kind, leetcode, (event) => {
        if (event.type === "error") {
          setError(event.data.msg || "Sync failed");
          setPhase("error");
          return;
        }
        setPct(event.data.pct);
        setMsg(event.data.msg);
        if (event.type === "completed") {
          window.localStorage.removeItem(PENDING_LEETCODE_KEY);
          router.replace("/dashboard");
        }
      }).catch((err) => {
        setError(err instanceof Error ? err.message : "Sync failed");
        setPhase("error");
      });
    },
    [router],
  );

  useEffect(() => {
    if (status !== "authenticated" || startedRef.current) return;
    startedRef.current = true;

    (async () => {
      const isResync = new URLSearchParams(window.location.search).get("resync") === "1";
      if (isResync) {
        // Re-sync uses the linked username server-side; no body needed.
        runSync(undefined, "sync");
        return;
      }

      const pending = window.localStorage.getItem(PENDING_LEETCODE_KEY) ?? undefined;
      if (pending) {
        runSync(pending);
        return;
      }
      // No stashed username — check if the account already has one linked.
      try {
        const profile = await getCodingProfile();
        if (profile.profiles?.leetcode) {
          runSync(profile.profiles.leetcode);
        } else {
          setPhase("need-username");
        }
      } catch {
        // No coding profile yet — ask for a username.
        setPhase("need-username");
      }
    })();
  }, [status, runSync]);

  const currentStageIndex = STAGES.findIndex((s) => pct < s.threshold);
  const activeIndex = currentStageIndex === -1 ? STAGES.length - 1 : currentStageIndex;
  const stageLabel = phase === "indexing" ? "Indexing for AI chat" : STAGES[activeIndex]?.label ?? "Working…";

  if (phase === "need-username") {
    return (
      <CenteredCard>
        <div style={{ padding: "28px 32px" }}>
          <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Link your LeetCode</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 20 }}>
            Enter your LeetCode username so we can pull your submissions and stats.
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (usernameInput.trim()) runSync(usernameInput.trim());
            }}
            style={{ display: "flex", gap: 10 }}
          >
            <input
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="ada_codes"
              autoFocus
              style={{ flex: 1, padding: "12px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none", fontFamily: "inherit" }}
            />
            <button
              type="submit"
              style={{ padding: "12px 18px", background: "var(--accent)", color: "white", fontWeight: 700, fontSize: 13, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}
            >
              Start sync
            </button>
          </form>
        </div>
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, var(--accent-strong), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <LogoMark size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Syncing your profile</div>
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Pulling data from LeetCode and indexing it for chat</div>
          </div>
        </div>
        <div className="font-mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>
          <span>{Math.round(pct)}% complete</span>
          <span>{stageLabel}</span>
        </div>
        <div style={{ height: 8, background: "var(--surface-2)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--accent-strong), var(--accent))", borderRadius: 6, transition: "width 0.4s ease" }} />
        </div>
        {error && (
          <div style={{ marginTop: 14, fontSize: 13, color: "var(--hard)", background: "var(--hard-soft)", padding: "10px 12px", borderRadius: 10 }}>
            {error}{" "}
            <span onClick={() => { startedRef.current = false; window.location.reload(); }} style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>
              Retry
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: "20px 24px 28px" }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {STAGES.map((stage, i) => {
            const done = pct >= stage.threshold || (phase === "indexing" && i < STAGES.length - 1);
            const active = i === activeIndex && phase !== "error";
            return (
              <li key={stage.label} style={{ marginTop: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 8 }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: done ? "var(--easy)" : active ? "var(--accent)" : "var(--surface-2)",
                      animation: active && !done ? "pulseDot 1.2s ease infinite" : "none",
                    }}
                  >
                    {done && <CheckIcon size={11} width={4} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: done || active ? "var(--text)" : "var(--text-faint)" }}>
                      {stage.label}
                    </div>
                    {active && !done && (
                      <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>{msg}</div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </CenteredCard>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 40 }}>
      <div
        style={{
          width: 620,
          maxWidth: "100%",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          boxShadow: "var(--shadow)",
          overflow: "hidden",
          animation: "fadeUp 0.5s ease both",
        }}
      >
        {children}
      </div>
    </div>
  );
}
