<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $initialAdminPassword = env('XR_INITIAL_ADMIN_PASSWORD');

        if (! is_string($initialAdminPassword) || $initialAdminPassword === '') {
            return;
        }

        User::firstOrCreate(
            ['email' => 'admin@ifcxrlab.local'],
            [
                'name' => 'Administrador Principal',
                'password' => $initialAdminPassword,
                'role' => 'admin',
                'is_active' => true,
            ]
        );
    }
}
