<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaltoRequest extends Model
{
    protected $fillable = [
        'request_id',
        'bridge_configuration_id',
        'type',
        'command',
        'payload',
        'status',
        'result',
        'error_message',
    ];

    protected $casts = [
        'payload' => 'array',
        'result'  => 'array',
    ];
}
