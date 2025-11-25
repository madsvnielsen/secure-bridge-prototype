

export const shellStyle: React.CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
};

export const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  marginBottom: "1.5rem",
};

export const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.7rem",
  letterSpacing: "-0.02em",
};

export const subtitleStyle: React.CSSProperties = {
  margin: "0.25rem 0 0 0",
  fontSize: "0.9rem",
  color: "#6b7280",
};

export const chipStyle: React.CSSProperties = {
  padding: "0.25rem 0.8rem",
  borderRadius: 999,
  fontSize: "0.75rem",
  fontWeight: 600,
  background: "var(--white)",
  border: "1px solid var(--shadow)",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
};

export const chipDotStyle: React.CSSProperties = {
  width: "0.45rem",
  height: "0.45rem",
  borderRadius: 999,
  background: "var(--hococo_violet)",
};

export const tabsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  marginBottom: "1rem",
};

export const tabButtonBaseStyle: React.CSSProperties = {
  appearance: "none",
  border: "1px solid transparent",
  borderRadius: 999,
  padding: "0.35rem 0.9rem",
  fontSize: "0.85rem",
  background: "transparent",
  cursor: "pointer",
  color: "#4b5563",
  outline: "none", // remove default black outline
};

export const tabButtonActiveStyle: React.CSSProperties = {
  background: "var(--white)",
  borderColor: "var(--shadow)",
  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
  color: "var(--hococo_green)",
  fontWeight: 600,
};

export const refreshButtonStyle: React.CSSProperties = {
  marginLeft: "auto",
  appearance: "none",
  borderRadius: 999,
  border: "1px solid var(--shadow)",
  padding: "0.35rem 0.9rem",
  background: "var(--white)",
  fontSize: "0.8rem",
  cursor: "pointer",
  outline: "none",
};

export const errorBannerStyle: React.CSSProperties = {
  margin: "0.75rem 0",
  padding: "0.6rem 0.8rem",
  borderRadius: "0.75rem",
  background: "var(--misty-rose)",
  border: "1px solid rgba(220,38,38,0.4)",
  fontSize: "0.85rem",
  color: "#7f1d1d",
};

export const twoColLayoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.4fr)",
  gap: "1.3rem",
};

export const cardStyle: React.CSSProperties = {
  background: "var(--white)",
  borderRadius: "1rem",
  padding: "1.5rem 1.75rem",
  border: "1px solid var(--shadow)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.04)",
};

export const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

export const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.05rem",
};

export const sectionSubtleStyle: React.CSSProperties = {
  margin: "0.4rem 0 0.6rem 0",
  fontSize: "0.85rem",
  color: "#6b7280",
};

export const smallBadgeStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  padding: "0.15rem 0.6rem",
  borderRadius: 999,
  background: "var(--hococo_grey)",
  color: "#4b5563",
};

export const tableWrapperStyle: React.CSSProperties = {
  marginTop: "0.75rem",
  borderRadius: "0.75rem",
  border: "1px solid var(--shadow)",
  overflow: "hidden",
  background: "var(--white)",
};


export const trClickableStyle: React.CSSProperties = {
  cursor: "pointer",
};

export const trStaticStyle: React.CSSProperties = {
  cursor: "default",
};

export const statusPillActiveStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "0.1rem 0.55rem",
  borderRadius: 999,
  fontSize: "0.75rem",
  fontWeight: 600,
  background: "rgba(25,54,49,0.08)",
  color: "var(--hococo_green)",
  border: "1px solid rgba(25,54,49,0.4)",
};

export const statusPillRevokedStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "0.1rem 0.55rem",
  borderRadius: 999,
  fontSize: "0.75rem",
  fontWeight: 600,
  background: "rgba(220,38,38,0.08)",
  color: "#b91c1c",
  border: "1px solid rgba(220,38,38,0.5)",
};

export const smallActionButtonStyle: React.CSSProperties = {
  appearance: "none",
  borderRadius: 999,
  border: "1px solid var(--shadow)",
  background: "var(--white)",
  padding: "0.15rem 0.6rem",
  fontSize: "0.8rem",
  cursor: "pointer",
  outline: "none",
};

export const smallDangerButtonStyle: React.CSSProperties = {
  ...smallActionButtonStyle,
  borderColor: "rgba(220,38,38,0.5)",
  color: "#b91c1c",
};

export const targetBridgeBoxStyle: React.CSSProperties = {
  borderRadius: "0.75rem",
  border: "1px dashed var(--shadow)",
  padding: "0.7rem 0.8rem",
  background: "var(--hococo_grey)",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: "0.6rem",
  border: "1px solid var(--shadow)",
  padding: "0.5rem 0.75rem",
  fontSize: "0.9rem",
  background: "var(--white)",
};

export const primaryButtonStyle: React.CSSProperties = {
  appearance: "none",
  border: "none",
  borderRadius: 999,
  padding: "0.5rem 1.3rem",
  fontSize: "0.9rem",
  fontWeight: 600,
  background: "linear-gradient(135deg, var(--royal-blue), var(--hococo_violet))",
  color: "#ffffff",
  cursor: "pointer",
  boxShadow: "0 12px 25px rgba(100,47,255,0.28)",
  outline: "none",
};

export const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.85rem",
  tableLayout: "fixed", // important so columns don’t jump
};

export const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem 0.75rem",
  background: "var(--hococo_grey)",
  borderBottom: "1px solid var(--shadow)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const tdStyle: React.CSSProperties = {
  padding: "0.45rem 0.75rem",
  borderBottom: "1px solid var(--shadow)",
  verticalAlign: "top",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const tdMonoStyle: React.CSSProperties = {
  ...tdStyle,
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  fontSize: "0.8rem",
};

export const tdMono: React.CSSProperties = {
  ...tdStyle,
  fontFamily:
    "ui-monospace, Menlo, Monaco, Consolas, 'Courier New', monospace",
  fontSize: "0.8rem",
};

export const trHoverStyle: React.CSSProperties = {
  cursor: "pointer",
};

export const smallPreStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.75rem",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

