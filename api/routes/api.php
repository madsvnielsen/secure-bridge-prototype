<?php

use App\Models\PairingTx;
use App\Models\BridgeConfiguration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use App\Services\BridgeCertificateIssuer;


Route::get('/health', fn () => response()->json(['ok' => true]));

if (app()->environment('local')) {
    // --- DEV: list all pairing transactions ---
    Route::get('/dev/pairing-txs', function () {
        return PairingTx::orderByDesc('created_at')->get();
    });
     Route::get('/dev/bridge-configs', function () {
        return BridgeConfiguration::orderByDesc('created_at')->get();
    });
}


Route::post('/bridges/pair/start', function (Request $request) {
    $data = $request->validate([
        'bridgeIdentifier' => 'required|string|max:255',
        'pairingCode'      => 'required|digits:6',
        'csr'              => 'required|string',
    ]);

    $csrPem = $data['csr'];

    // --- 1) PoP check ---
    $csrSubject = openssl_csr_get_subject($csrPem);
    $csrPubKey  = openssl_csr_get_public_key($csrPem);

    if ($csrSubject === false || $csrPubKey === false) {
        return response()->json([
            'error'   => 'invalid_csr',
            'message' => 'CSR could not be parsed or is invalid.',
        ], 400);
    }

    openssl_free_key($csrPubKey);

    $pairingTxId = (string) Str::uuid();

    $secret = config('app.pairing_code_secret', env('PAIRING_CODE_SECRET'));

    if (empty($secret)) {
        throw new RuntimeException('PAIRING_CODE_SECRET not configured');
    }

    $pairingCodeHash = hash_hmac('sha256', $data['pairingCode'], $secret);

    $now       = now();
    $expiresAt = $now->copy()->addMinutes(15);

    $tx = PairingTx::create([
        'pairing_tx_id'                 => $pairingTxId,
        'pairing_code_hash'             => $pairingCodeHash,
        'status'                        => 'pending',
        'csr_pem'                       => $csrPem,
        'expires_at'                    => $expiresAt,
        'hub_claimed_at'                => null,
        'completed_at'                  => null,
        'ip_created'                    => $request->ip(),
        'claimed_bridge_configuration_id' => null,
    ]);

    return response()->json([
        'pairingTxId' => $pairingTxId,
        'status'      => $tx->status,
        'expiresAt'   => $expiresAt->toIso8601String(),
    ], 201);
});

Route::post('/hub/pair/claim', function (Request $request) {
    $data = $request->validate([
        'pairingCode' => 'required|digits:6',
        'bridgeName'  => 'required|string|max:255', 
    ]);

    $secret = config('app.pairing_code_secret', env('PAIRING_CODE_SECRET'));

    if (empty($secret)) {
        throw new RuntimeException('PAIRING_CODE_SECRET not configured');
    }

    // 1) Look up pending pairing TX by hash + expiry + state
    $hash = hash_hmac('sha256', $data['pairingCode'], $secret);

    $tx = PairingTx::where('pairing_code_hash', $hash)
        ->where('status', 'pending')
        ->where('expires_at', '>', now())
        ->first();

    if (! $tx) {
        return response()->json([
            'error'   => 'invalid_or_expired_code',
            'message' => 'No matching pending pairing transaction for this code.',
        ], 404);
    }

    // 2) Create new BridgeConfiguration with UUIDv4 
    $bridgeConfigurationId = (string) Str::uuid();

    $bridgeConfig = BridgeConfiguration::create([
        'bridge_configuration_id' => $bridgeConfigurationId,
        'bridge_name'             => $data['bridgeName'],
        'project_ids'             => []
    ]);

    // 3) Update TX
    $tx->status                         = 'await_finalization';
    $tx->hub_claimed_at                 = now();
    $tx->claimed_bridge_configuration_id = $bridgeConfigurationId;
    $tx->save();

    // 4) Return bridgeConfigurationId
    return response()->json([
        'pairingTxId'           => $tx->pairing_tx_id,
        'status'                => $tx->status,
        'bridgeConfigurationId' => $bridgeConfigurationId,
        'bridgeName'            => $bridgeConfig->bridge_name,
        'projectIds'            => $bridgeConfig->project_ids,
        'expiresAt'             => optional($tx->expires_at)->toIso8601String(),
    ]);
});


Route::get('/bridges/pair/status', function (Request $request) {
    $pairingTxId = $request->query('pairingTxId');

    if (! $pairingTxId) {
        return response()->json([
            'error'   => 'missing_param',
            'message' => 'pairingTxId is required',
        ], 400);
    }

    $tx = PairingTx::where('pairing_tx_id', $pairingTxId)->first();

    if (! $tx) {
        return response()->json([
            'error'   => 'not_found',
            'message' => 'Pairing transaction not found',
        ], 404);
    }

    return response()->json([
        'status'                  => $tx->status,
        'expiresAt'               => optional($tx->expires_at)->toIso8601String()
    ]);
});

Route::post('/bridges/pair/finalize', function (Request $request, BridgeCertificateIssuer $issuer) {
    $data = $request->validate([
        'pairingTxId' => 'required|uuid',
    ]);

    $tx = PairingTx::where('pairing_tx_id', $data['pairingTxId'])->first();

    if (! $tx) {
        return response()->json([
            'error'   => 'not_found',
            'message' => 'Pairing transaction not found',
        ], 404);
    }

    // Check expiry & state
    if ($tx->expires_at <= now()) {
        $tx->status = 'expired';
        $tx->save();

        return response()->json([
            'error'   => 'expired',
            'message' => 'Pairing transaction has expired',
        ], 400);
    }

    if ($tx->status !== 'await_finalization') {
        return response()->json([
            'error'   => 'invalid_state',
            'message' => "Cannot finalize pairing in state '{$tx->status}'",
        ], 400);
    }

    if (! $tx->claimed_bridge_configuration_id) {
        return response()->json([
            'error'   => 'missing_bridge_configuration',
            'message' => 'Pairing transaction has no associated bridge configuration',
        ], 400);
    }

    // Issue certificate from stored CSR
    $result = $issuer->issue($tx->csr_pem, $tx->claimed_bridge_configuration_id);

    // Update TX state + audit fields
    $tx->status       = 'completed';
    $tx->completed_at = now();
    $tx->save();

    // Base URLs (configure via .env / config)
    $wssUrl     = config('app.wss_url', env('WSS_URL', 'wss://ws.hococo.internal/ws'));
    $apiBaseUrl = config('app.api_base_url', env('API_BASE_URL', 'https://api.hococo.internal/api'));

    return response()->json([
        'pairingTxId'              => $tx->pairing_tx_id,
        'status'                   => $tx->status,
        'bridgeConfigurationId'    => $tx->claimed_bridge_configuration_id,
        'deviceCertificateChainPem'=> $result['deviceCertificateChainPem'],
        'caBundlePem'              => $result['caBundlePem'],
        'wssUrl'                   => $wssUrl,
        'apiBaseUrl'               => $apiBaseUrl,
    ]);
});

