<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('bridge_configurations', function (Blueprint $table) {
            $table->id();

            $table->uuid('bridge_configuration_id')->unique();

            $table->string('bridge_name');

            $table->json('project_ids')->nullable();

            $table->unsignedInteger('cert_serial')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bridge_configurations');
    }
};
