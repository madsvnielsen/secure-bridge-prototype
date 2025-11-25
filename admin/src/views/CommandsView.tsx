import React, { useState } from "react";
import { StatusPillCommand } from "../components/StatusPillCommand";
import {
  cardStyle,
  sectionHeaderStyle,
  sectionSubtleStyle,
  sectionTitleStyle,
  smallBadgeStyle,
  tableStyle,
  tableWrapperStyle,
  tdMonoStyle,
  tdStyle,
  thStyle,
  trStaticStyle,
} from "../styles";
import type { CommandRecord } from "../types";

type CommandsViewProps = {
  commands: CommandRecord[];
};

function formatFullResult(c: CommandRecord): string {
  if (c.error_message) return c.error_message;
  if (!c.result) return "No result";

  try {
    return JSON.stringify(c.result, null, 2);
  } catch {
    return String(c.result);
  }
}

export function CommandsView({ commands }: CommandsViewProps) {
  const [active, setActive] = useState<CommandRecord | null>(null);

  return (
    <>
      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Commands</h2>
          <span style={smallBadgeStyle}>{commands.length} total</span>
        </div>
        <p style={sectionSubtleStyle}>
          Recently issued commands and their status.
        </p>

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Bridge config</th>
                <th style={thStyle}>Command</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Created</th>
              </tr>
            </thead>
            <tbody>
              {commands.map((c) => (
                <tr
                  key={c.id}
                  style={{ ...trStaticStyle, cursor: "pointer" }}
                  onClick={() => setActive(c)}
                >
                  <td style={tdMonoStyle}>{c.bridge_configuration_id}</td>
                  <td style={tdStyle}>{c.command}</td>
                  <td style={tdStyle}>
                    <span style={StatusPillCommand(c.status)}>{c.status}</span>
                  </td>
                  <td style={tdStyle}>
                    {new Date(c.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {commands.length === 0 && (
                <tr style={trStaticStyle}>
                  <td style={tdStyle} colSpan={4}>
                    No commands yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {active && (
        <div style={modalOverlayStyle} onClick={() => setActive(null)}>
          <div
            style={modalCardStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.8rem",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem" }}>
                  Command details
                </h3>
                <div
                  style={{
                    marginTop: "0.15rem",
                    fontSize: "0.75rem",
                    color: "#6b7280",
                  }}
                >
                  {active.command}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Meta grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "0.5rem 1.1rem",
                fontSize: "0.85rem",
                marginBottom: "0.8rem",
              }}
            >
              <InfoRow label="Status">
                <span style={StatusPillCommand(active.status)}>
                  {active.status}
                </span>
              </InfoRow>
              <InfoRow label="Created">
                {new Date(active.created_at).toLocaleString()}
              </InfoRow>
              <InfoRow label="Updated">
                {new Date(active.updated_at).toLocaleString()}
              </InfoRow>
              <InfoRow label="Request ID">
                <span style={{ ...tdMonoStyle, borderBottom: "none", padding: 0 }}>
                  {active.request_id}
                </span>
              </InfoRow>
              <div style={{ gridColumn: "1 / -1" }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#94a3b8",
                    marginBottom: "0.1rem",
                  }}
                >
                  Bridge configuration ID
                </div>
                <div
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
                    fontSize: "0.8rem",
                    wordBreak: "break-all",
                    padding: "0.45rem 0.6rem",
                    borderRadius: "0.55rem",
                    background: "var(--hococo_grey)",
                    border: "1px solid var(--shadow)",
                  }}
                >
                  {active.bridge_configuration_id}
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: "0.78rem",
                color: "#6b7280",
                marginBottom: "0.4rem",
              }}
            >
              Result
              
            </div>

            {/* Full result / error */}
            <div
              style={{
                fontSize: "0.76rem",
                borderRadius: "0.5rem",
                padding: "0.45rem 0.55rem",
                background: "var(--hococo_grey)",
                border: "1px solid var(--shadow)",
                maxHeight: "220px",
                overflow: "auto",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {formatFullResult(active)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* Modal styles (local copy, same vibe as BridgesView) */

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.35)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 40,
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 640,
  background: "var(--white)",
  borderRadius: "0.9rem",
  border: "1px solid var(--shadow)",
  boxShadow: "0 22px 50px rgba(15, 23, 42, 0.25)",
  padding: "1.2rem 1.4rem 1.1rem",
};

type InfoRowProps = {
  label: string;
  children: React.ReactNode;
};

function InfoRow({ label, children }: InfoRowProps) {
  return (
    <div>
      <div
        style={{
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#94a3b8",
          marginBottom: "0.1rem",
        }}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
