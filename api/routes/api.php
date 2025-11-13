<?php

use App\Models\PairingTx;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

Route::get('/health', fn () => response()->json(['ok' => true]));

if (app()->environment('local')) {
    // --- DEV: list all pairing transactions ---
    Route::get('/dev/pairing-txs', function () {
        return PairingTx::orderByDesc('created_at')->get();
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
