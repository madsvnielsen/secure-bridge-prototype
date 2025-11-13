<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PairingTx extends Model
{
    protected $table = 'pairing_txs';

    protected $fillable = [
        'pairing_tx_id',
        'pairing_code_hash',
        'status',
        'csr_pem',
        'expires_at',
        'hub_claimed_at',
        'completed_at',
        'ip_created',
        'claimed_bridge_configuration_id',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'hub_claimed_at' => 'datetime',
        'completed_at' => 'datetime',
    ];
}
