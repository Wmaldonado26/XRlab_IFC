<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        ResetPassword::createUrlUsing(static function ($user, string $token): string {
            return url('/#reset-password?'.http_build_query([
                'token' => $token,
                'email' => $user->getEmailForPasswordReset(),
            ]));
        });

        ResetPassword::toMailUsing(static function ($user, string $token): MailMessage {
            $resetUrl = url('/#reset-password?'.http_build_query([
                'token' => $token,
                'email' => $user->getEmailForPasswordReset(),
            ]));

            return (new MailMessage)
                ->subject('Restablece tu contraseÃ±a de XRlab')
                ->greeting('Hola '.$user->name)
                ->line('Recibimos una solicitud para cambiar la contraseÃ±a de tu cuenta.')
                ->action('Restablecer contraseÃ±a', $resetUrl)
                ->line('Este enlace vence en 60 minutos y solo puede utilizarse una vez.')
                ->line('Si no solicitaste este cambio, puedes ignorar este correo.');
        });
    }
}
