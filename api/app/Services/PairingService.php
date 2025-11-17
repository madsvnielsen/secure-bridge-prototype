<?php

namespace App\Services;

use App\Models\PairingTx;
use App\Models\BridgeConfiguration;
use Illuminate\Support\Str;
use RuntimeException;

class PairingService
{
    public function __construct(
        private readonly CertificateAuthority $certificateAuthority,
    ) {
    }

    /**
     * Start a new pairing transaction.

     */
    public function startPairing(
        string $bridgeIdentifier,
        string $pairingCode,
        string $csrPem,
        string $ipCreated
    ): PairingTx {
        // CSR check
        $this->certificateAuthority->validateBridgeCsr($csrPem);

        $pairingTxId = (string) Str::uuid();

        $secret = config('app.pairing_code_secret', env('PAIRING_CODE_SECRET'));
        if (empty($secret)) {
            throw new RuntimeException('PAIRING_CODE_SECRET not configured');
        }

        $pairingCodeHash = hash_hmac('sha256', $pairingCode, $secret);

        $now       = now();
        $expiresAt = $now->copy()->addMinutes(15);

        $tx = PairingTx::create([
            'pairing_tx_id'                   => $pairingTxId,
            'pairing_code_hash'               => $pairingCodeHash,
            'status'                          => 'pending',
            'csr_pem'                         => $csrPem,
            'expires_at'                      => $expiresAt,
            'hub_claimed_at'                  => null,
            'completed_at'                    => null,
            'ip_created'                      => $ipCreated,
            'claimed_bridge_configuration_id' => null,
        ]);

        return $tx;
    }

    /**
     * Hub claim
     */
    public function claimPairing(string $pairingCode, string $bridgeName): ?array
    {
        $secret = config('app.pairing_code_secret', env('PAIRING_CODE_SECRET'));
        if (empty($secret)) {
            throw new RuntimeException('PAIRING_CODE_SECRET not configured');
        }

        $hash = hash_hmac('sha256', $pairingCode, $secret);

        $tx = PairingTx::where('pairing_code_hash', $hash)
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->first();

        if (! $tx) {
            // No matching pairing TX
            return null;
        }

        $bridgeConfigurationId = (string) Str::uuid();

        $bridgeConfig = BridgeConfiguration::create([
            'bridge_configuration_id' => $bridgeConfigurationId,
            'bridge_name'             => $bridgeName,
            'project_ids'             => [],
        ]);

        $tx->status                          = 'await_finalization';
        $tx->hub_claimed_at                  = now();
        $tx->claimed_bridge_configuration_id = $bridgeConfigurationId;
        $tx->save();

        return [
            'tx'           => $tx,
            'bridgeConfig' => $bridgeConfig,
        ];
    }

   
    public function getPairingTx(string $pairingTxId): ?PairingTx
    {
        return PairingTx::where('pairing_tx_id', $pairingTxId)->first();
    }


 public function finalizePairing(string $pairingTxId): array
    {
        $tx = PairingTx::where('pairing_tx_id', $pairingTxId)->first();

        if (! $tx) {
            throw new RuntimeException('not_found');
        }

        if ($tx->expires_at <= now()) {
            $tx->status = 'expired';
            $tx->save();

            throw new RuntimeException('expired');
        }

        if ($tx->status !== 'await_finalization') {
            throw new RuntimeException('invalid_state:' . $tx->status);
        }

        if (! $tx->claimed_bridge_configuration_id) {
            throw new RuntimeException('missing_bridge_configuration');
        }

        // Issue device certificate via CertificateAuthority
        $result = $this->certificateAuthority->issueBridgeCertificate(
            $tx->csr_pem,
            $tx->claimed_bridge_configuration_id
        );

        $tx->status       = 'completed';
        $tx->completed_at = now();
        $tx->save();

        return [
            'tx'                        => $tx,
            'deviceCertificateChainPem' => $result['deviceCertificateChainPem'],
            'caBundlePem'               => $result['caBundlePem'],
        ];
    }
}
