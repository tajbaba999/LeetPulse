"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LogoMark } from "@/components/icons";
import { signin, signup } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";

const PENDING_LEETCODE_KEY = "leetpulse.pendingLeetcode";

export default function LoginPage() {
  const { status, login } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [leetcode, setLeetcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  const isSignup = mode === "signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const tokens = isSignup
        ? await signup(name.trim(), email.trim(), password)
        : await signin(email.trim(), password);
      await login(tokens);

      if (isSignup) {
        if (leetcode.trim()) window.localStorage.setItem(PENDING_LEETCODE_KEY, leetcode.trim());
        router.replace("/onboarding");
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    textAlign: "center",
    padding: "10px 0",
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    color: active ? "var(--text)" : "var(--text-faint)",
    background: active ? "var(--bg-elevated)" : "transparent",
    boxShadow: active ? "var(--shadow)" : "none",
  });

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-dim)",
    marginBottom: 6,
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 480px" }}>
        {/* ── Hero ── */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            overflow: "hidden",
          }}
          className="hero-panel"
        >
          <div style={{ position: "absolute", inset: 0, background: "oklch(0.1 0 0)", overflow: "hidden" }}>
            <div style={{ position: "absolute", width: "70%", height: "70%", left: "-10%", top: "-10%", borderRadius: "50%", background: "oklch(0.58 0.21 260.84 / 0.55)", filter: "blur(90px)", animation: "blobDrift1 22s ease-in-out infinite" }} />
            <div style={{ position: "absolute", width: "60%", height: "60%", right: "-10%", bottom: "-5%", borderRadius: "50%", background: "oklch(0.68 0.19 260.84 / 0.4)", filter: "blur(100px)", animation: "blobDrift2 26s ease-in-out infinite" }} />
            <div style={{ position: "absolute", width: "45%", height: "45%", left: "20%", bottom: "10%", borderRadius: "50%", background: "oklch(0.4 0.16 260.84 / 0.5)", filter: "blur(80px)", animation: "blobDrift3 19s ease-in-out infinite" }} />
          </div>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, oklch(0 0 0 / 0.15) 0%, oklch(0 0 0 / 0.05) 30%, oklch(0 0 0 / 0.15) 65%, oklch(0 0 0 / 0.55) 100%)", pointerEvents: "none" }} />

          <div style={{ position: "relative", padding: "32px 32px 0" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 16px 10px 10px", background: "oklch(0.1 0 0 / 0.72)", border: "1px solid oklch(1 0 0 / 0.12)", borderRadius: 12, backdropFilter: "blur(10px)" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, var(--accent-strong), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <LogoMark size={16} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em", color: "white" }}>LeetPulse</div>
            </div>
          </div>

          <div style={{ position: "relative", maxWidth: 520, padding: "0 32px", animation: "fadeUp 0.6s ease both" }}>
            <div style={{ padding: "24px 26px", background: "oklch(0.1 0 0 / 0.72)", border: "1px solid oklch(1 0 0 / 0.12)", borderRadius: 18, backdropFilter: "blur(10px)" }}>
              <div style={{ fontWeight: 700, fontSize: 36, lineHeight: 1.14, letterSpacing: "-0.02em", marginBottom: 12, color: "white" }}>
                Know your coding<br />trajectory, not just<br />your streak.
              </div>
              <div style={{ fontSize: 14, color: "oklch(0.85 0 0)", lineHeight: 1.6 }}>
                LeetPulse tracks every submission and turns it into a chat you can actually ask questions to.
              </div>
            </div>
          </div>

          <div style={{ position: "relative", padding: "24px 32px 32px" }}>
            <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "oklch(0.85 0 0)", marginBottom: 10, padding: "5px 10px", background: "oklch(0.1 0 0 / 0.82)", borderRadius: 8 }}>
              Ask LeetPulse — live from your synced data
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "18px 20px", background: "oklch(0.1 0 0 / 0.82)", border: "1px solid oklch(1 0 0 / 0.12)", borderRadius: 16, backdropFilter: "blur(10px)" }}>
              <div style={{ alignSelf: "flex-end", maxWidth: "80%", padding: "9px 14px", background: "var(--accent)", color: "white", borderRadius: "12px 12px 2px 12px", fontSize: 13 }}>
                What&apos;s my weakest topic right now?
              </div>
              <div style={{ alignSelf: "flex-start", maxWidth: "88%", padding: "9px 14px", background: "oklch(1 0 0 / 0.08)", color: "white", borderRadius: "12px 12px 12px 2px", fontSize: 13, lineHeight: 1.5 }}>
                Dynamic Programming — 62% acceptance vs. your 91% average. You&apos;ve untouched 1,789 Medium DP-tagged problems.
              </div>
              <div style={{ display: "flex", gap: 6, paddingLeft: 2, marginTop: 2 }}>
                {["skill-intermediate", "weakness-analysis"].map((t) => (
                  <span key={t} className="font-mono" style={{ fontSize: 10, color: "oklch(0.8 0 0)", background: "oklch(1 0 0 / 0.08)", padding: "3px 8px", borderRadius: 6 }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Form ── */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 64, background: "var(--bg)" }}>
          <div style={{ maxWidth: 340, margin: "0 auto", width: "100%", animation: "fadeUp 0.5s ease both" }}>
            <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 32 }}>
              <div style={tabStyle(!isSignup)} onClick={() => setMode("signin")}>Sign in</div>
              <div style={tabStyle(isSignup)} onClick={() => setMode("signup")}>Create account</div>
            </div>

            <div style={{ fontWeight: 700, fontSize: 26, marginBottom: 8, letterSpacing: "-0.02em" }}>
              {isSignup ? "Create your account" : "Welcome back"}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 28 }}>
              {isSignup ? "Start tracking your coding trajectory." : "Sign in to pick up where you left off."}
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {isSignup && (
                <div>
                  <div style={labelStyle}>Name</div>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" style={inputStyle} required />
                </div>
              )}
              <div>
                <div style={labelStyle}>Email</div>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} required />
              </div>
              <div>
                <div style={labelStyle}>Password</div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} required />
              </div>
              {isSignup && (
                <div>
                  <div style={labelStyle}>LeetCode username</div>
                  <input value={leetcode} onChange={(e) => setLeetcode(e.target.value)} placeholder="ada_codes" style={inputStyle} />
                </div>
              )}

              {error && (
                <div style={{ fontSize: 13, color: "var(--hard)", background: "var(--hard-soft)", padding: "10px 12px", borderRadius: 10 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: 8,
                  padding: 13,
                  textAlign: "center",
                  background: "var(--accent)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 14,
                  border: "none",
                  borderRadius: 10,
                  cursor: submitting ? "default" : "pointer",
                  opacity: submitting ? 0.7 : 1,
                  boxShadow: "var(--shadow)",
                  fontFamily: "inherit",
                }}
              >
                {submitting ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
              </button>
            </form>

            <div style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "var(--text-faint)" }}>
              {isSignup ? "Already have an account? " : "New to LeetPulse? "}
              <span
                onClick={() => setMode(isSignup ? "signin" : "signup")}
                style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}
              >
                {isSignup ? "Sign in" : "Create one"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
