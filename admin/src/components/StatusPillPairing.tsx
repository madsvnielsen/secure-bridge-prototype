export function StatusPillPairing(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "0.1rem 0.55rem",
    borderRadius: 999,
    fontSize: "0.75rem",
    fontWeight: 600,
  };
  if (status === "completed") {
    return {
      ...base,
      background: "rgba(25,54,49,0.08)",
      border: "1px solid rgba(25,54,49,0.4)",
      color: "var(--hococo_green)",
    };
  }
  if (status === "pending" || status === "await_finalization") {
    return {
      ...base,
      background: "rgba(255,208,104,0.2)",
      border: "1px solid rgba(234,179,8,0.6)",
      color: "#92400e",
    };
  }
  return {
    ...base,
    background: "rgba(148,163,184,0.2)",
    border: "1px solid rgba(148,163,184,0.6)",
    color: "#475569",
  };
}