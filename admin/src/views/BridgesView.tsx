import {
  cardStyle,
  inputStyle,
  primaryButtonStyle,
  smallDangerButtonStyle,
  statusPillActiveStyle,
  statusPillRevokedStyle,
  tableStyle,
  tableWrapperStyle,
  tdMono,
  tdStyle,
  thStyle,
  trHoverStyle,
} from "../styles";
import type { BridgeConfig, CommandRecord } from "../types";

type Props = {
  bridges: BridgeConfig[];
  commands: CommandRecord[];
  selectedBridgeId: string | null;
  setSelectedBridgeId: (id: string | null) => void;
  onRevoke: (id: string) => void;
  commandText: string;
  setCommandText: (v: string) => void;
  onSendCommand: () => void; // parent uses selectedBridgeId + commandText
  commandSending: boolean;
};

export function BridgesView({
  bridges,
  commands,
  selectedBridgeId,
  setSelectedBridgeId,
  onRevoke,
  commandText,
  setCommandText,
  onSendCommand,
  commandSending,
}: Props) {
  const activeBridge =
    bridges.find((b) => b.bridge_configuration_id === selectedBridgeId) ?? null;

  const latestCommand =
    activeBridge &&
    getLatestCommandForBridge(commands, activeBridge.bridge_configuration_id);

  function openBridge(b: BridgeConfig) {
    setSelectedBridgeId(b.bridge_configuration_id);
  }

  function closeModal() {
    setSelectedBridgeId(null);
  }

  return (
    <>
      <section style={cardStyle}>
        <h2 style={{ margin: 0, marginBottom: "0.6rem", fontSize: "1.05rem" }}>
          Bridges
        </h2>

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>

            <tbody>
              {bridges.map((b) => {
                const selected =
                  selectedBridgeId === b.bridge_configuration_id;
                const revoked = !!b.revoked_at;

                return (
                  <tr
                    key={b.bridge_configuration_id}
                    style={{
                      ...trHoverStyle,
                      background: selected ? "#eef3ff" : "transparent",
                    }}
                    onClick={() => openBridge(b)}
                  >
                    <td style={tdStyle}>{b.bridge_name || "Unnamed"}</td>
                    <td
                      style={{
                        ...tdMono,
                        whiteSpace: "normal",
                        wordBreak: "break-all",
                      }}
                    >
                      {b.bridge_configuration_id}
                    </td>
                    <td style={tdStyle}>
                      {revoked ? (
                        <span style={statusPillRevokedStyle}>Revoked</span>
                      ) : (
                        <span style={statusPillActiveStyle}>Active</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {bridges.length === 0 && (
                <tr>
                  <td style={tdStyle} colSpan={3}>
                    No bridges yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {activeBridge && (
        <div style={modalOverlayStyle} onClick={closeModal}>
          <div
            style={modalCardStyle}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.9rem",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem" }}>
                  {activeBridge.bridge_name || "Unnamed bridge"}
                </h3>
                <div
                  style={{
                    marginTop: "0.15rem",
                    fontSize: "0.75rem",
                    color: "#6b7280",
                  }}
                >
                  Bridge configuration details
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
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

            {/* Info grid */}
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
                {activeBridge.revoked_at ? (
                  <span style={statusPillRevokedStyle}>Revoked</span>
                ) : (
                  <span style={statusPillActiveStyle}>Active</span>
                )}
              </InfoRow>

              <InfoRow label="Cert serial">
                {activeBridge.cert_serial ?? "N/A"}
              </InfoRow>

              <InfoRow label="Created">
                {new Date(activeBridge.created_at).toLocaleString()}
              </InfoRow>

              <InfoRow label="Updated">
                {new Date(activeBridge.updated_at).toLocaleString()}
              </InfoRow>

              {activeBridge.revoked_at && (
                <InfoRow label="Revoked at">
                  {new Date(activeBridge.revoked_at).toLocaleString()}
                </InfoRow>
              )}

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
                  Configuration ID
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
                  {activeBridge.bridge_configuration_id}
                </div>
              </div>
            </div>

            {/* Latest command */}
            {latestCommand && (
              <div
                style={{
                  marginTop: "0.2rem",
                  marginBottom: "0.8rem",
                  padding: "0.7rem 0.8rem",
                  borderRadius: "0.7rem",
                  border: "1px solid var(--shadow)",
                  background: "var(--hococo_grey)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.8rem",
                    marginBottom: "0.3rem",
                    fontWeight: 500,
                  }}
                >
                  Latest command
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem 0.9rem",
                    fontSize: "0.78rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  <span>
                    <strong>Command:</strong> {latestCommand.command}
                  </span>
                  <span>
                    <strong>Status:</strong> {latestCommand.status}
                  </span>
                  <span>
                    <strong>At:</strong>{" "}
                    {new Date(latestCommand.created_at).toLocaleString()}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "0.76rem",
                    borderRadius: "0.5rem",
                    padding: "0.4rem 0.5rem",
                    background: "var(--white)",
                    border: "1px solid var(--shadow)",
                    maxHeight: "120px",
                    overflow: "auto",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {formatCommandResult(latestCommand)}
                </div>
              </div>
            )}

            {/* Command + revoke */}
            {!activeBridge.revoked_at && (
              <>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <label
                    htmlFor="bridgeCommand"
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 500,
                    }}
                  >
                    Command
                  </label>
                  <input
                    id="bridgeCommand"
                    value={commandText}
                    onChange={(e) => setCommandText(e.target.value)}
                    style={inputStyle}
                    placeholder="get_doors"
                  />
                  <button
                    style={primaryButtonStyle}
                    disabled={commandSending || !commandText.trim()}
                    onClick={onSendCommand}
                  >
                    {commandSending ? "Sending..." : "Send command"}
                  </button>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    style={smallDangerButtonStyle}
                    onClick={() =>
                      onRevoke(activeBridge.bridge_configuration_id)
                    }
                    type="button"
                  >
                    Revoke
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* Helpers */

function getLatestCommandForBridge(
  commands: CommandRecord[],
  bridgeConfigurationId: string
): CommandRecord | null {
  const filtered = commands.filter(
    (c) => c.bridge_configuration_id === bridgeConfigurationId
  );
  if (!filtered.length) return null;
  return filtered.slice().sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return tb - ta;
  })[0];
}

function formatCommandResult(c: CommandRecord): string {
  if (c.error_message) return c.error_message;
  if (!c.result) return "No result";
  try {
    const s = JSON.stringify(c.result, null, 2);
    if (s.length <= 800) return s;
    return s.slice(0, 780) + " …";
  } catch {
    return String(c.result);
  }
}

/* Modal styles */

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
  maxWidth: 520,
  background: "var(--white)",
  borderRadius: "0.9rem",
  border: "1px solid var(--shadow)",
  boxShadow: "0 22px 50px rgba(15, 23, 42, 0.25)",
  padding: "1.2rem 1.4rem 1.1rem",
};

/* Small subcomponent */

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
