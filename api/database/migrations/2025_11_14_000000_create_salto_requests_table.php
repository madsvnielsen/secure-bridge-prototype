<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('salto_requests', function (Blueprint $table) {
            $table->id();
            $table->uuid('request_id')->unique();
            $table->string('bridge_configuration_id');
            $table->string('type')->default('command');
            $table->string('command');
            $table->json('payload')->nullable();

            $table->string('status')->default('pending'); 
            // pending | completed | failed | timed_out

            $table->json('result')->nullable();       
            $table->text('error_message')->nullable(); 

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salto_requests');
    }
};