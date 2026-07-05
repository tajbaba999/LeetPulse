import type { CSSProperties } from "react";

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 14, color: "var(--text-dim)", marginTop: 4 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ padding: 24, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, ...style }}>
      {children}
    </div>
  );
}

export function CardTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{children}</div>
      {right}
    </div>
  );
}

export function StateBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-dim)", fontSize: 14 }}>{children}</div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <StateBlock>
      <div style={{ color: "var(--hard)", marginBottom: onRetry ? 12 : 0 }}>{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ padding: "8px 16px", background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}
        >
          Retry
        </button>
      )}
    </StateBlock>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <StateBlock>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 16, height: 16, border: "2px solid var(--surface-2)", borderTopColor: "var(--accent)", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
        {label}
      </div>
    </StateBlock>
  );
}

export function diffColor(difficulty: string): { fg: string; soft: string } {
  const d = difficulty.toLowerCase();
  if (d === "easy") return { fg: "var(--easy)", soft: "var(--easy-soft)" };
  if (d === "hard") return { fg: "var(--hard)", soft: "var(--hard-soft)" };
  return { fg: "var(--medium)", soft: "var(--medium-soft)" };
}
