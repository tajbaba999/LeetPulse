"use client";

// Hand-rolled SVG charts (no chart library), matching LeetPulse.dc.html.

export function DifficultyDonut({ easy, medium, hard }: { easy: number; medium: number; hard: number }) {
  const total = easy + medium + hard;
  const r = 46;
  const c = 2 * Math.PI * r;

  const seg = (v: number) => (total > 0 ? (v / total) * c : 0);
  const easySeg = seg(easy);
  const medSeg = seg(medium);
  const hardSeg = seg(hard);

  const ring = (dash: number, offset: number, color: string) => (
    <circle
      cx={60}
      cy={60}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={14}
      strokeDasharray={`${dash} ${c - dash}`}
      strokeDashoffset={-offset}
      transform="rotate(-90 60 60)"
      strokeLinecap={dash > 0 && dash < c ? "round" : "butt"}
    />
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={60} cy={60} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={14} />
        {ring(easySeg, 0, "var(--easy)")}
        {ring(medSeg, easySeg, "var(--medium)")}
        {ring(hardSeg, easySeg + medSeg, "var(--hard)")}
        <text x={60} y={55} textAnchor="middle" fill="var(--text)" fontWeight={700} fontSize={20}>{total}</text>
        <text x={60} y={72} textAnchor="middle" fill="var(--text-faint)" fontSize={10}>solved</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {[
          { label: "Easy", value: easy, color: "var(--easy)" },
          { label: "Medium", value: medium, color: "var(--medium)" },
          { label: "Hard", value: hard, color: "var(--hard)" },
        ].map((row) => (
          <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, display: "inline-block" }} />
              {row.label}
            </span>
            <span className="font-mono" style={{ fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendChart({ values }: { values: number[] }) {
  const w = 480;
  const h = 180;
  const pad = 10;

  if (values.length === 0) {
    return (
      <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 13 }}>
        No snapshots yet — re-sync to build history.
      </div>
    );
  }

  if (values.length === 1) {
    return (
      <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em" }}>{values[0].toLocaleString()}</div>
        <div style={{ color: "var(--text-faint)", fontSize: 13 }}>1 snapshot — sync again to see a trend chart.</div>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = values.length;

  const points = values.map((v, i) => {
    const x = n === 1 ? w / 2 : pad + (i / (n - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${points[0].x.toFixed(1)},${h} ${polyline} ${points[n - 1].x.toFixed(1)},${h}`;

  return (
    <svg width="100%" height={180} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#trendGrad)" opacity={0.5} />
      <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="var(--bg-elevated)" stroke="var(--accent)" strokeWidth={2} />
      ))}
    </svg>
  );
}

export function Bar({ value, max, color = "var(--accent)" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
    </div>
  );
}
