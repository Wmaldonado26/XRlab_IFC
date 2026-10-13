<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('auth:clear-attempts', function () {
    \Illuminate\Support\Facades\DB::table('login_attempts')->truncate();
    $this->info('Todos los intentos fallidos de inicio de sesión han sido reiniciados exitosamente.');
})->purpose('Limpiar bloqueos e intentos fallidos de inicio de sesión');
