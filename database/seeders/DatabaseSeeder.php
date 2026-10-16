<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@ifcxrlab.local'],
            [
                'name' => 'Administrador Principal',
                'password' => Hash::make('Admin2026!*'),
                'role' => 'admin',
                'is_active' => true,
            ]
        );
    }
}
