import { useEffect, useState } from "react";
import { PairingView } from "./views/PairingView";
import { CommandsView } from "./views/CommandsView";
import { BridgesView } from "./views/BridgesView";
import { chipDotStyle, chipStyle, errorBannerStyle, headerStyle, refreshButtonStyle, shellStyle, subtitleStyle, tabsStyle, titleStyle } from "./styles";
import { TabButton } from "./components/TabButton";
import { API_BASE } from "./api";


type PairingTx = {
  id: number;
  pairing_tx_id: string;
  status: string;
  expires_at: string;
  hub_claimed_at: string | null;
  completed_at: string | null;
  ip_created: string | null;
  claimed_bridge_configuration_id: string | null;
  created_at: string;
  updated_at: string;
};

type BridgeConfig = {
  id: number;
  bridge_configuration_id: string;
  bridge_name: string;
  project_ids: unknown[];
  cert_serial: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

type CommandRecord = {
  id: number;
  request_id: string;
  bridge_configuration_id: string;
  type: string;
  command: string;
  payload: unknown;
  status: string;
  result: unknown;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type View = "bridges" | "commands" | "pairing";

export function AdminHubApp() {
  const [view, setView] = useState<View>("bridges");

  const [pairingTxs, setPairingTxs] = useState<PairingTx[]>([]);
  const [bridges, setBridges] = useState<BridgeConfig[]>([]);
  const [commands, setCommands] = useState<CommandRecord[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedBridgeId, setSelectedBridgeId] = useState<string | null>(null);
  const [commandText, setCommandText] = useState("");
  const [commandSending, setCommandSending] = useState(false);

  useEffect(() => {
    refreshAll();
  }, []);

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const [pairingRes, commandsRes, bridgesRes] = await Promise.all([
        fetch(`${API_BASE}/hub/pairing-txs`),
        fetch(`${API_BASE}/hub/commands`),
        fetch(`${API_BASE}/hub/bridge-configs`),
      ]);

      if (!pairingRes.ok || !commandsRes.ok || !bridgesRes.ok) {
        throw new Error("Failed loading data from API");
      }

      const [pairingJson, commandsJson, bridgesJson] = await Promise.all([
        pairingRes.json(),
        commandsRes.json(),
        bridgesRes.json(),
      ]);

      setPairingTxs(pairingJson);
      setCommands(commandsJson);
      setBridges(bridgesJson);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function revokeBridge(bridgeConfigurationId: string) {
    if (
      !window.confirm(
        "Revoke this bridge?"
      )
    ) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/hub/bridges/${encodeURIComponent(
          bridgeConfigurationId
        )}/revoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Revoke failed (${res.status}): ${text}`);
      }

      const bridgesRes = await fetch(`${API_BASE}/hub/bridge-configs`);
      const bridgesJson = await bridgesRes.json();
      setBridges(bridgesJson);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error revoking bridge");
    }
  }

  async function sendCommand() {
    if (!selectedBridgeId) {
      setError("Select a bridge first.");
      return;
    }
    if (!commandText.trim()) {
      setError("Command cannot be empty.");
      return;
    }
    setCommandSending(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/hub/bridges/${encodeURIComponent(
          selectedBridgeId
        )}/command`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: commandText.trim(),
            payload: {}
          }),
        }
      );

      const text = await res.text();
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }

      if (!res.ok) {
        throw new Error(
          `Command failed (${res.status}): ${JSON.stringify(payload, null, 2)}`
        );
      }

      setCommandText("");
      const commandsRes = await fetch(`${API_BASE}/hub/commands`);
      const commandsJson = await commandsRes.json();
      setCommands(commandsJson);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error sending command");
    } finally {
      setCommandSending(false);
    }
  }

  return (
    <div className="hub-shell" style={shellStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Hococo Admin Hub</h1>
          <p style={subtitleStyle}>
            Monitor bridges, pairing flows and send commands through the
            prototype API.
          </p>
        </div>
        <div style={chipStyle}>
          <span style={chipDotStyle} />
          <span>Prototype admin console</span>
        </div>
      </header>

      <nav style={tabsStyle}>
        <TabButton
          label="Bridges"
          active={view === "bridges"}
          onClick={() => setView("bridges")}
        />
        <TabButton
          label="Commands"
          active={view === "commands"}
          onClick={() => setView("commands")}
        />
        <TabButton
          label="Pairing sessions"
          active={view === "pairing"}
          onClick={() => setView("pairing")}
        />

        <button
          style={refreshButtonStyle}
          onClick={refreshAll}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </nav>

      {error && (
        <div style={errorBannerStyle}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {view === "bridges" && (
        <BridgesView
          bridges={bridges}
          commands={commands}
          selectedBridgeId={selectedBridgeId}
          setSelectedBridgeId={setSelectedBridgeId}
          onRevoke={revokeBridge}
          commandText={commandText}
          setCommandText={setCommandText}
          onSendCommand={sendCommand}
          commandSending={commandSending}
        />
      )}

      {view === "commands" && <CommandsView commands={commands} />}

      {view === "pairing" && (
        <PairingView pairingTxs={pairingTxs} onClaimSuccess={refreshAll} />
      )}
    </div>
  );
}





