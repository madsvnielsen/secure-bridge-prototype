import { useState } from "react";
import { API_BASE } from "../api";
import { StatusPillPairing } from "../components/StatusPillPairing";
import {
  cardStyle,
  inputStyle,
  primaryButtonStyle,
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
  twoColLayoutStyle,
  smallPreStyle,
} from "../styles";
import type { PairingTx } from "../types";

type PairingViewProps = {
  pairingTxs: PairingTx[];
  onClaimSuccess: () => void;
};

export function PairingView({ pairingTxs, onClaimSuccess }: PairingViewProps) {
  const [code, setCode] = useState("");
  const [bridgeName, setBridgeName] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [active, setActive] = useState<PairingTx | null>(null);

  async function handleClaim() {
    setClaimMessage(null);
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setClaimMessage("Please enter a 6-digit numeric code.");
      return;
    }

    setClaiming(true);
    try {
      const res = await fetch(`${API_BASE}/hub/pair/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairingCode: trimmed,
          bridgeName: bridgeName.trim() || "Unnamed bridge",
        }),
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (!res.ok) {
        const payloadText =
          typeof data === "string" ? data : JSON.stringify(data, null, 2);
        setClaimMessage(`Error ${res.status}: ${payloadText}`);
        return;
      }

      setClaimMessage("Bridge claimed successfully.");
      setCode("");
      onClaimSuccess();
    } catch (err: any) {
      setClaimMessage(`Network error: ${err?.message ?? String(err)}`);
    } finally {
      setClaiming(false);
    }
  }

  return (
    <>
      <div style={twoColLayoutStyle}>
        {/* Left: history table */}
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Pairing sessions</h2>
            <span style={smallBadgeStyle}>{pairingTxs.length} total</span>
          </div>
          <p style={sectionSubtleStyle}>
            History of pairing flows and their status.
          </p>

          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Tx ID</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created</th>
                </tr>
              </thead>
              <tbody>
                {pairingTxs.map((p) => (
                  <tr
                    key={p.id}
                    style={{ ...trStaticStyle, cursor: "pointer" }}
                    onClick={() => setActive(p)}
                  >
                    <td
                      style={{
                        ...tdMonoStyle,
                        maxWidth: 220,
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      }}
                      title={p.pairing_tx_id}
                    >
                      {p.pairing_tx_id}
                    </td>
                    <td style={tdStyle}>
                      <span style={StatusPillPairing(p.status)}>
                        {p.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {pairingTxs.length === 0 && (
                  <tr style={trStaticStyle}>
                    <td style={tdStyle} colSpan={3}>
                      No pairing sessions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right: claim form */}
        <section style={cardStyle}>
          <h2
            style={{ margin: 0, marginBottom: "0.6rem", fontSize: "1.05rem" }}
          >
            Claim pairing
          </h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              marginTop: "0.5rem",
            }}
          >
            <label
              htmlFor="bridgeName"
              style={{
                fontSize: "0.85rem",
                marginBottom: "0.25rem",
                display: "block",
              }}
            >
              Bridge name
            </label>
            <input
              id="bridgeName"
              value={bridgeName}
              onChange={(e) => setBridgeName(e.target.value)}
              placeholder="Name"
              style={inputStyle}
            />
          </div>

          <div style={{ marginTop: "0.75rem" }}>
            <label
              htmlFor="pairingCode"
              style={{
                fontSize: "0.85rem",
                marginBottom: "0.25rem",
                display: "block",
              }}
            >
              Pairing code
            </label>
            <input
              id="pairingCode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              inputMode="numeric"
              style={inputStyle}
            />
          </div>

          <div style={{ marginTop: "0.9rem" }}>
            <button
              type="button"
              onClick={handleClaim}
              disabled={claiming}
              style={primaryButtonStyle}
            >
              {claiming ? "Claiming..." : "Claim bridge"}
            </button>
          </div>

          {claimMessage && (
            <div
              style={{
                marginTop: "0.7rem",
                fontSize: "0.8rem",
                whiteSpace: "pre-wrap",
                padding: "0.45rem 0.55rem",
                borderRadius: "0.6rem",
                background: "var(--hococo_grey)",
                border: "1px solid var(--shadow)",
              }}
            >
              {claimMessage}
            </div>
          )}
        </section>
      </div>

      {active && (
        <div style={modalOverlayStyle} onClick={() => setActive(null)}>
          <div
            style={modalCardStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.8rem",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1rem" }}>Pairing details</h3>
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

            {/* meta grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "0.5rem 1.1rem",
                fontSize: "0.85rem",
                marginBottom: "0.9rem",
              }}
            >
              <InfoRow label="Status">
                <span style={StatusPillPairing(active.status)}>
                  {active.status}
                </span>
              </InfoRow>
              <InfoRow label="Created">
                {new Date(active.created_at).toLocaleString()}
              </InfoRow>

              <InfoRow label="Expires">
                {new Date(active.expires_at).toLocaleString()}
              </InfoRow>

              <InfoRow label="Hub claimed">
                {active.hub_claimed_at
                  ? new Date(active.hub_claimed_at).toLocaleString()
                  : "Not claimed"}
              </InfoRow>

              <InfoRow label="Completed">
                {active.completed_at
                  ? new Date(active.completed_at).toLocaleString()
                  : "Not completed"}
              </InfoRow>

              <InfoRow label="Claimed bridge">
                {active.claimed_bridge_configuration_id ?? "Not claimed"}
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
                  Transaction ID
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
                  {active.pairing_tx_id}
                </div>
              </div>
            </div>

            {active.ip_created && (
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "#6b7280",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#94a3b8",
                    marginRight: "0.3rem",
                  }}
                >
                  IP created
                </span>
                <span style={smallPreStyle}>{active.ip_created}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* modal styles */

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
  maxWidth: 560,
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
