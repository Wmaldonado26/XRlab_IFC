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
        <h2>Bienvenido a XRlab</h2>
        <p class="subtitle">Ingresa con tus credenciales para continuar.</p>

        <!-- Feedback error alert -->
        <div v-if="errorMessage" class="alert-error">
          <span>⚠️</span>
          <span>{{ errorMessage }}</span>
        </div>

        <form @submit.prevent="handleSubmit">
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

        <div style="margin-top: 24px; padding: 12px 14px; border-radius: 11px; background: #f3f7fc; color: #65738a; font-size: 12px; line-height: 1.5;">
          <strong>Entorno Seguro:</strong> Autenticación validada mediante sesión protegida CSRF de Laravel.
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { login } from '../services/auth-service';

const emit = defineEmits<{
  (e: 'login-success'): void;
}>();

const email = ref('');
const password = ref('');
const rememberMe = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');

async function handleSubmit() {
  if (!email.value.trim() || !password.value) return;

  isLoading.value = true;
  errorMessage.value = '';

  try {
    await login(email.value.trim(), password.value);
    emit('login-success');
  } catch (err: any) {
    errorMessage.value = err.message || 'Credenciales no válidas. Comprueba tu correo y contraseña.';
  } finally {
    isLoading.value = false;
  }
}

function onForgotClick() {
  alert('Para restablecer tu contraseña corporativa, contacta al Administrador de COTECMAR XRlab.');
}
</script>

<style scoped>
.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
