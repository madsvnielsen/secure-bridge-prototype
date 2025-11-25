export type PairingTx = {
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

export type BridgeConfig = {
  id: number;
  bridge_configuration_id: string;
  bridge_name: string;
  project_ids: unknown[];
  cert_serial: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

export type CommandRecord = {
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
