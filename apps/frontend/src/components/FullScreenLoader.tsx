export default function FullScreenLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "var(--bg)",
        color: "var(--text-dim)",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          border: "3px solid var(--surface-2)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <div style={{ fontSize: 13 }}>{label}</div>
    </div>
  );
}
