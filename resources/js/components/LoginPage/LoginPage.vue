<script setup lang="ts">
import { useLoginPage } from './LoginPage.logic';
const emit = defineEmits(["login-success"]);
const { email, password, passwordConfirmation, rememberMe, isLoading, errorMessage, successMessage, mode, resetToken, handleSubmit, onForgotClick, backToLogin, handleRequestReset, handlePasswordReset } = useLoginPage(emit);
</script>

<template>
  <section class="login-page">
    <!-- Visual Left Panel (Corporate Branding) -->
    <div class="login-visual">
      <div class="brand">
        <div class="brand-mark">⚓</div>
        <div>
          <div class="brand-text-corp">COTECMAR</div>
          <div class="brand-sub">XRlab</div>
        </div>
      </div>

      <div class="ship-watermark">⚓</div>

      <div class="login-copy">
        <div class="eyebrow">Plataforma digital · BIM & XR</div>
        <h1>Construimos conocimiento desde el modelo.</h1>
        <p>Entorno centralizado para gestionar proyectos, modelos BIM, inspecciones y visualización 3D de COTECMAR.</p>
      </div>
    </div>

    <!-- Right Form Panel -->
    <div class="login-panel">
      <div class="login-box">
        <div class="eyebrow" style="color: var(--blue);">Acceso corporativo</div>
        <h2>{{ mode === 'reset' ? 'Crea una nueva contraseña' : mode === 'request-reset' ? 'Recupera tu acceso' : 'Bienvenido a XRlab' }}</h2>
        <p class="subtitle">{{ mode === 'reset' ? 'Define una contraseña segura para tu cuenta.' : mode === 'request-reset' ? 'Te enviaremos un enlace si el correo corresponde a una cuenta.' : 'Ingresa con tus credenciales para continuar.' }}</p>

        <!-- Feedback error alert -->
        <div v-if="errorMessage" class="alert-error">
          <span>⚠️</span>
          <span>{{ errorMessage }}</span>
        </div>
        <div v-if="successMessage" role="status" style="padding: 12px 15px; border-radius: 10px; background: #ecfdf5; border: 1px solid #bbf7d0; color: #166534; font-size: 13px; font-weight: 600; margin-bottom: 18px;">
          {{ successMessage }}
        </div>

        <form v-if="mode === 'login'" @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="login-email">Correo corporativo</label>
            <div class="input-wrap">
              <span>✉</span>
              <input
                id="login-email"
                v-model="email"
                type="email"
                placeholder="usuario@cotecmar.com"
                required
                :disabled="isLoading"
                autocomplete="email"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="login-password">Contraseña</label>
            <div class="input-wrap">
              <span>🔒</span>
              <input
                id="login-password"
                v-model="password"
                type="password"
                placeholder="••••••••"
                required
                :disabled="isLoading"
                autocomplete="current-password"
              />
            </div>

            <div class="password-row">
              <label style="font-weight: 500; font-size: 11.5px; color: #718096; cursor: pointer;">
                <input
                  v-model="rememberMe"
                  type="checkbox"
                  style="width: auto; vertical-align: middle; margin-right: 6px;"
                  :disabled="isLoading"
                />
                Recordarme
              </label>
              <a class="link" href="#" @click.prevent="onForgotClick">¿Olvidaste tu contraseña?</a>
            </div>
          </div>

          <button
            type="submit"
            class="primary-btn login-btn"
            :disabled="isLoading || !email.trim() || !password"
          >
            <span v-if="isLoading" class="spinner-sm"></span>
            <span v-if="isLoading">Verificando credenciales...</span>
            <span v-else>Iniciar sesión</span>
          </button>
        </form>

        <form v-else-if="mode === 'request-reset'" @submit.prevent="handleRequestReset">
          <div class="form-group">
            <label for="recovery-email">Correo corporativo</label>
            <div class="input-wrap">
              <span>✉</span>
              <input id="recovery-email" v-model="email" type="email" autocomplete="email" required :disabled="isLoading" />
            </div>
          </div>
          <button type="submit" class="primary-btn login-btn" :disabled="isLoading || !email.trim()">
            <span v-if="isLoading" class="spinner-sm"></span>
            <span>{{ isLoading ? 'Procesando solicitud...' : 'Enviar instrucciones' }}</span>
          </button>
          <button type="button" class="link" style="border: 0; background: transparent; padding: 0; margin-top: 18px; cursor: pointer;" @click="backToLogin">
            Volver al inicio de sesión
          </button>
        </form>

        <form v-else @submit.prevent="handlePasswordReset">
          <div class="form-group">
            <label for="reset-email">Correo corporativo</label>
            <div class="input-wrap">
              <span>✉</span>
              <input id="reset-email" v-model="email" type="email" autocomplete="email" readonly required />
            </div>
          </div>
          <div class="form-group">
            <label for="reset-password">Nueva contraseña</label>
            <div class="input-wrap">
              <span>🔒</span>
              <input id="reset-password" v-model="password" type="password" autocomplete="new-password" minlength="12" required :disabled="isLoading" />
            </div>
          </div>
          <div class="form-group">
            <label for="reset-password-confirmation">Confirmar contraseña</label>
            <div class="input-wrap">
              <span>🔒</span>
              <input id="reset-password-confirmation" v-model="passwordConfirmation" type="password" autocomplete="new-password" minlength="12" required :disabled="isLoading" />
            </div>
          </div>
          <button type="submit" class="primary-btn login-btn" :disabled="isLoading || !resetToken">
            <span v-if="isLoading" class="spinner-sm"></span>
            <span>{{ isLoading ? 'Actualizando contraseña...' : 'Guardar contraseña' }}</span>
          </button>
          <button type="button" class="link" style="border: 0; background: transparent; padding: 0; margin-top: 18px; cursor: pointer;" @click="onForgotClick">
            Solicitar un enlace nuevo
          </button>
        </form>

        <div style="margin-top: 24px; padding: 12px 14px; border-radius: 11px; background: #f3f7fc; color: #65738a; font-size: 12px; line-height: 1.5;">
          <strong>Entorno Seguro:</strong> Autenticación validada mediante sesión protegida CSRF de Laravel.
        </div>
      </div>
    </div>
  </section>
</template>
<style src="./LoginPage.shared.css"></style>
<style scoped src="./LoginPage.css"></style>




