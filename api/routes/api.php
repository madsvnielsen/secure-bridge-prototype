<?php

use App\Models\PairingTx;
use App\Models\BridgeConfiguration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Services\CertificateAuthority;
use App\Services\AuthorizationAuthority;
use App\Services\PairingService;

Route::get('/health', fn () => response()->json(['ok' => true]));

if (app()->environment('local')) {
    Route::get('/dev/pairing-txs', function () {
        return PairingTx::orderByDesc('created_at')->get();
    });
    Route::get('/dev/bridge-configs', function () {
        return BridgeConfiguration::orderByDesc('created_at')->get();
    });
    
    Route::post('/dev/bridges/{id}/revoke', function (
        Request $request,
        string $id,
        CertificateAuthority $certificateAuthority
    ) {
        $bridgeConfig = BridgeConfiguration::where('bridge_configuration_id', $id)->first();

        if (! $bridgeConfig) {
            return response()->json([
                'error'   => 'not_found',
                'message' => 'Bridge configuration not found',
            ], 404);
        }

        if (! $bridgeConfig->cert_serial) {
            return response()->json([
                'error'   => 'no_certificate',
                'message' => 'This bridge configuration has no issued certificate to revoke.',
            ], 400);
        }

        try {
            $certificateAuthority->revokeBridgeCertificateBySerial(
                (string) $bridgeConfig->cert_serial
            );
        } catch (\RuntimeException $e) {
            return response()->json([
                'error'   => 'revoke_failed',
                'message' => $e->getMessage(),
            ], 500);
        }

        try {
            $baseUrl = config('app.ws_admin_url', env('WS_ADMIN_URL', 'https://ws.hococo.internal:9443/admin/ws'));

            Http::withOptions([
                'cert'    => env('WS_ADMIN_CERT', '/app/certs/api/api-client.crt'),
                'ssl_key' => env('WS_ADMIN_KEY', '/app/certs/api/api-client.key'),
                'verify'  => env('WS_ADMIN_CA', '/app/certs/ca/ca.crt'),
            ])->post($baseUrl . '/bridges/disconnect', [
                'bridgeConfigurationId' => $bridgeConfig->bridge_configuration_id,
            ]);
        } catch (\Throwable $e) {
            \Log::warning('Failed to notify WSS about revoked bridge', [
                'bridgeConfigurationId' => $bridgeConfig->bridge_configuration_id,
                'error'                 => $e->getMessage(),
            ]);
        }

        return response()->json([
            'bridgeConfigurationId' => $bridgeConfig->bridge_configuration_id,
            'status'                => 'revoked',
        ]);
    });

Route::post('/dev/bridges/{id}/commands', function (Request $request, string $id) {
    $data = $request->validate([
        'command'   => 'required|string|max:255',
        'type'      => 'sometimes|string|max:255',
        'payload'   => 'sometimes|array'
    ]);

    $bridgeConfig = BridgeConfiguration::where('bridge_configuration_id', $id)->first();
    if (! $bridgeConfig) {
        return response()->json([
            'error'   => 'not_found',
            'message' => 'Bridge configuration not found',
        ], 404);
    }

    $requestId = (string) Str::uuid();

    $saltoRequest = SaltoRequest::create([
        'request_id'             => $requestId,
        'bridge_configuration_id'=> $bridgeConfig->bridge_configuration_id,
        'type'                   => 'command',
        'command'                => $data['command'],
        'payload'                => $data['payload'],
        'status'                 => 'pending',
    ]);

    $baseUrl = config('app.ws_admin_url', env('WS_ADMIN_URL', 'https://ws.hococo.internal:9443/admin/ws'));

    try {
        $response = Http::withOptions([
            'cert'    => env('WS_ADMIN_CERT', '/app/certs/api/api-client.crt'),
            'ssl_key' => env('WS_ADMIN_KEY',  '/app/certs/api/api-client.key'),
            'verify'  => env('WS_ADMIN_CA',   '/app/certs/ca/ca.crt'),
            'timeout' => 2, // this HTTP call should be quick
        ])->post($baseUrl . '/bridges/command', [
            'bridgeConfigurationId' => $bridgeConfig->bridge_configuration_id,
            'type'                  => $saltoRequest->type,
            'command'               => $saltoRequest->command,
            'payload'               => $saltoRequest->payload,
            'requestId'             => $saltoRequest->request_id,
        ]);

        if (! $response->successful()) {
            $saltoRequest->update([
                'status'        => 'failed',
                'error_message' => 'WSS HTTP ' . $response->status(),
            ]);

            return response()->json([
                'error'   => 'ws_command_failed',
                'message' => 'WSS responded with HTTP ' . $response->status(),
                'body'    => $response->body(),
            ], 502);
        }

        $timeoutMs  = 1500;
        $intervalMs = 50;
        $elapsed    = 0;

        while ($elapsed < $timeoutMs) {
            $saltoRequest->refresh();

            if ($saltoRequest->status === 'completed') {
                return response()->json([
                    'requestId'             => $saltoRequest->request_id,
                    'bridgeConfigurationId' => $saltoRequest->bridge_configuration_id,
                    'status'                => 'ok',
                    'result'                => $saltoRequest->result,
                ], 200);
            }

            if ($saltoRequest->status === 'failed') {
                return response()->json([
                    'requestId'             => $saltoRequest->request_id,
                    'bridgeConfigurationId' => $saltoRequest->bridge_configuration_id,
                    'status'                => 'failed',
                    'error'                 => $saltoRequest->error_message,
                ], 502);
            }

            usleep($intervalMs * 1000);
            $elapsed += $intervalMs;
        }

        $saltoRequest->update([
            'status'        => 'timed_out',
            'error_message' => 'Bridge did not respond within 1.5s',
        ]);

        return response()->json([
            'requestId'             => $saltoRequest->request_id,
            'bridgeConfigurationId' => $saltoRequest->bridge_configuration_id,
            'status'                => 'timeout',
            'message'               => 'Bridge did not respond within 1.5 seconds',
        ], 504);
    } catch (\Throwable $e) {
        \Log::warning('Failed to send command to WSS', [
           'bridge_configuration_id' => $bridgeConfig->bridge_configuration_id,
           'command'                 => $data['command'],
           'error'                   => $e->getMessage(),
        ]);

        $saltoRequest->update([
            'status'        => 'failed',
            'error_message' => 'Could not reach WSS admin endpoint: ' . $e->getMessage(),
        ]);

        return response()->json([
            'error'   => 'ws_unreachable',
            'message' => 'Could not reach WSS admin endpoint',
        ], 502);
    }
});
}

Route::post('/api/bridges/results', function (Request $request) {
    $data = $request->validate([
        'requestId'             => 'required|string',
        'bridgeConfigurationId' => 'required|string',
        'success'               => 'required|boolean',
        'result'                => 'sometimes|array',
        'error'                 => 'sometimes|string',
    ]);

    $saltoRequest = SaltoRequest::where('request_id', $data['requestId'])
        ->where('bridge_configuration_id', $data['bridgeConfigurationId'])
        ->first();

    if (! $saltoRequest) {
        \Log::warning('Bridge sent result for unknown request', $data);

        return response()->json([
            'error'   => 'unknown_request',
            'message' => 'No matching SaltoRequest found',
        ], 404);
    }

    if ($data['success']) {
        $saltoRequest->update([
            'status' => 'completed',
            'result' => $data['result'] ?? [],
        ]);
    } else {
        $saltoRequest->update([
            'status'        => 'failed',
            'error_message' => $data['error'] ?? 'Unknown bridge error',
            'result'        => $data['result'] ?? null,
        ]);
    }

    return response()->json(['status' => 'ok']);
});

Route::post('/bridges/pair/start', function (Request $request, PairingService $pairingService) {
    $data = $request->validate([
        'bridgeIdentifier' => 'required|string|max:255',
        'pairingCode'      => 'required|digits:6',
        'csr'              => 'required|string',
    ]);

    try {
        $tx = $pairingService->startPairing(
            $data['bridgeIdentifier'],
            $data['pairingCode'],
            $data['csr'],
            $request->ip()
        );
    } catch (\RuntimeException $e) {
        return response()->json([
            'error'   => 'invalid_csr',
            'message' => $e->getMessage(),
        ], 400);
    }

    return response()->json([
        'pairingTxId' => $tx->pairing_tx_id,
        'status'      => $tx->status,
        'expiresAt'   => optional($tx->expires_at)->toIso8601String(),
    ], 201);
});

Route::post('/hub/pair/claim', function (Request $request, PairingService $pairingService) {
    $data = $request->validate([
        'pairingCode' => 'required|digits:6',
        'bridgeName'  => 'required|string|max:255',
    ]);

    try {
        $result = $pairingService->claimPairing(
            $data['pairingCode'],
            $data['bridgeName']
        );
    } catch (\RuntimeException $e) {
        return response()->json([
            'error'   => 'server_error',
            'message' => $e->getMessage(),
        ], 500);
    }

    if (! $result) {
        return response()->json([
            'error'   => 'invalid_or_expired_code',
            'message' => 'No matching pending pairing transaction for this code.',
        ], 404);
    }

    $tx           = $result['tx'];
    $bridgeConfig = $result['bridgeConfig'];

    return response()->json([
        'pairingTxId'           => $tx->pairing_tx_id,
        'status'                => $tx->status,
        'bridgeConfigurationId' => $bridgeConfig->bridge_configuration_id,
        'bridgeName'            => $bridgeConfig->bridge_name,
        'projectIds'            => $bridgeConfig->project_ids,
        'expiresAt'             => optional($tx->expires_at)->toIso8601String(),
    ]);
});

Route::get('/bridges/pair/status', function (Request $request, PairingService $pairingService) {
    $pairingTxId = $request->query('pairingTxId');

    if (! $pairingTxId) {
        return response()->json([
            'error'   => 'missing_param',
            'message' => 'pairingTxId is required',
        ], 400);
    }

    $tx = $pairingService->getPairingTx($pairingTxId);

    if (! $tx) {
        return response()->json([
            'error'   => 'not_found',
            'message' => 'Pairing transaction not found',
        ], 404);
    }

    return response()->json([
        'status'    => $tx->status,
        'expiresAt' => optional($tx->expires_at)->toIso8601String(),
    ]);
});

Route::post('/bridges/pair/finalize', function (Request $request, PairingService $pairingService) {
    $data = $request->validate([
        'pairingTxId' => 'required|uuid',
    ]);

    try {
        $result = $pairingService->finalizePairing($data['pairingTxId']);
    } catch (\RuntimeException $e) {
        $code = $e->getMessage();

        if ($code === 'not_found') {
            return response()->json([
                'error'   => 'not_found',
                'message' => 'Pairing transaction not found',
            ], 404);
        }

        if ($code === 'expired') {
            return response()->json([
                'error'   => 'expired',
                'message' => 'Pairing transaction has expired',
            ], 400);
        }

        if ($code === 'missing_bridge_configuration') {
            return response()->json([
                'error'   => 'missing_bridge_configuration',
                'message' => 'Pairing transaction has no associated bridge configuration',
            ], 400);
        }

        if (str_starts_with($code, 'invalid_state:')) {
            $state = substr($code, strlen('invalid_state:'));
            return response()->json([
                'error'   => 'invalid_state',
                'message' => "Cannot finalize pairing in state '{$state}'",
            ], 400);
        }

        // Unexpected error
        return response()->json([
            'error'   => 'server_error',
            'message' => $e->getMessage(),
        ], 500);
    }

    $tx                        = $result['tx'];
    $deviceCertificateChainPem = $result['deviceCertificateChainPem'];
    $caBundlePem               = $result['caBundlePem'];
    $serial                    = $result['caSerial'];

    $wssUrl     = config('app.wss_url', env('WSS_URL', 'wss://ws.hococo.internal/ws'));
    $apiBaseUrl = config('app.api_base_url', env('API_BASE_URL', 'https://api.hococo.internal/api'));

    $bridgeConfig = BridgeConfiguration::where('bridge_configuration_id', $tx->claimed_bridge_configuration_id)->first();
    if (!$bridgeConfig) {
        return response()->json([
            'error'   => 'not_found',
            'message' => 'Bridge configuration not found',
        ], 404);
    }

    $bridgeConfig->cert_serial = $serial;
    $bridgeConfig->save();

    return response()->json([
        'pairingTxId'               => $tx->pairing_tx_id,
        'status'                    => $tx->status,
        'bridgeConfigurationId'     => $tx->claimed_bridge_configuration_id,
        'deviceCertificateChainPem' => $deviceCertificateChainPem,
        'caBundlePem'               => $caBundlePem,
        'wssUrl'                    => $wssUrl,
        'apiBaseUrl'                => $apiBaseUrl,
    ]);
});

Route::post('/bridges/{id}/token', function (
    Request $request,
    string $id,
    CertificateAuthority $certificateAuthority,
    AuthorizationAuthority $authorizationAuthority
) {
    $bridgeConfig = BridgeConfiguration::where('bridge_configuration_id', $id)->first();

    if (! $bridgeConfig) {
        return response()->json([
            'error'   => 'not_found',
            'message' => 'Bridge configuration not found',
        ], 404);
    }

    try {
        $thumbprintX5tS256 = $certificateAuthority->getBridgeCertThumbprintFromRequest($request, $id);
    } catch (\RuntimeException $e) {
        return response()->json([
            'error'   => 'client_cert_invalid',
            'message' => $e->getMessage(),
        ], 403);
    }

    try {
        $tokenData = $authorizationAuthority->issueBridgeToken($id, $thumbprintX5tS256);
    } catch (\RuntimeException $e) {
        return response()->json([
            'error'   => 'token_issue_failed',
            'message' => $e->getMessage(),
        ], 500);
    }

    return response()->json($tokenData, 201);
});

