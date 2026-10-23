<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('conversion_jobs', function (Blueprint $table) {
            $table->string('stage', 100)->nullable()->after('progress');
            $table->string('original_ifc_name')->nullable()->after('parts_json');
            $table->string('original_ifc_path')->nullable()->after('original_ifc_name');
            $table->unsignedBigInteger('total_size_bytes')->nullable()->after('original_ifc_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('conversion_jobs', function (Blueprint $table) {
            $table->dropColumn(['stage', 'original_ifc_name', 'original_ifc_path', 'total_size_bytes']);
        });
    }
};
