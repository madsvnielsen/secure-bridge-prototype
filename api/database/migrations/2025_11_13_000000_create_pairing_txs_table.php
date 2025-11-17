<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('pairing_txs', function (Blueprint $table) {
            $table->id();

            $table->uuid('pairing_tx_id')->unique();

            $table->string('pairing_code_hash');
            $table->string('status')->default('pending'); 

            $table->text('csr_pem');

            $table->timestamp('expires_at');
            $table->timestamp('hub_claimed_at')->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->string('ip_created')->nullable();
            $table->uuid('claimed_bridge_configuration_id')->nullable();

            $table->timestamps(); 
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pairing_txs');
    }
};
