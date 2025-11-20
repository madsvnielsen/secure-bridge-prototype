<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BridgeConfiguration extends Model
{
    protected $table = 'bridge_configurations';

    protected $fillable = [
        'bridge_configuration_id',
        'bridge_name',
        'project_ids',
        'cert_serial'
    ];

    protected $casts = [
        'project_ids' => 'array',
    ];
}
