<template>
  <div v-if="modelValue" class="modalback show" @click.self="onBackdropClick">
    <div class="login-card-split">
      <!-- PANEL IZQUIERDO DE MARCA (BRAND) -->
      <div class="brand">
        <div class="logo">
          <div class="mark">X</div>
          <span>XRlab <small>IFC PLATFORM</small></span>
        </div>
        <h1>Visualiza tus modelos BIM.</h1>
        <p>Gestiona proyectos, modelos IFC y visualización 3D desde una plataforma profesional.</p>
      </div>

      <!-- PANEL DERECHO DE FORMULARIO (LOGINBOX) -->
      <div class="loginbox">
        <div class="loginbox-header">
          <h2>Bienvenido</h2>
          <p class="sub">Ingresa para continuar.</p>
          <button
            v-if="allowClose"
            type="button"
            class="close"
            title="Cerrar"
            @click="$emit('update:modelValue', false)"
          >
            ×
          </button>
        </div>

        <div v-if="errorMessage" class="error-banner">
          <span class="error-icon">⚠️</span>
          <span>{{ errorMessage }}</span>
        </div>

        <form @submit.prevent="handleLogin">
          <div class="field">
            <label for="login-email">Correo</label>
            <input
              id="login-email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="admin@xrlab.com"
              :disabled="isLoading"
            />
          </div>

          <div class="field">
            <label for="login-password">Contraseña</label>
            <div class="pwd-input-wrap">
              <input
                id="login-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="current-password"
                placeholder="••••••••"
                :disabled="isLoading"
              />
              <button
                type="button"
                class="pwd-toggle"
                tabindex="-1"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? '👁️' : '🙈' }}
              </button>
            </div>
          </div>

          <button
            type="submit"
            class="btn primary login-btn"
            :disabled="isLoading || !email || !password"
          >
            <span v-if="isLoading" class="spinner-sm"></span>
            <span v-else>Iniciar sesión</span>
          </button>
        </form>

        <div class="login-security-note">
          <span class="meta">🛡️ Sesión segura cifrada con cookies HttpOnly</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { login } from '../services/auth-service';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    allowClose?: boolean;
  }>(),
  {
    allowClose: true,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'login-success'): void;
}>();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');

function onBackdropClick() {
  if (props.allowClose) {
    emit('update:modelValue', false);
  }
}

async function handleLogin() {
  if (!email.value || !password.value) return;

  isLoading.value = true;
  errorMessage.value = '';

  try {
    await login(email.value.trim(), password.value);
    emit('login-success');
    emit('update:modelValue', false);
    password.value = '';
  } catch (err: any) {
    errorMessage.value = err.message || 'Error al iniciar sesión. Compruebe sus credenciales.';
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.modalback {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(11, 22, 42, 0.65);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 99999;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modalback.show {
  display: flex;
}

.login-card-split {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  background: #ffffff;
  border-radius: 17px;
  overflow: hidden;
  max-width: 880px;
  width: 100%;
  box-shadow: 0 20px 48px rgba(11, 22, 42, 0.25);
  animation: modalScale 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalScale {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

/* BRAND PANEL */
.brand {
  background: var(--b);
  color: #ffffff;
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 19px;
  margin-bottom: 20px;
}

.mark {
  width: 35px;
  height: 35px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 800;
}

.logo small {
  display: block;
  font-size: 9px;
  color: #dce6ff;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.brand h1 {
  font-size: 34px;
  line-height: 1.2;
  margin: 15px 0 10px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.brand p {
  max-width: 440px;
  line-height: 1.6;
  color: #dce6ff;
  font-size: 14px;
  margin: 0;
}

/* LOGINBOX */
.loginbox {
  padding: 42px 36px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: #ffffff;
}

.loginbox-header {
  position: relative;
  margin-bottom: 20px;
}

.loginbox h2 {
  font-size: 26px;
  font-weight: 800;
  margin: 0 0 4px;
  color: #172033;
}

.sub {
  color: var(--muted);
  font-size: 13.5px;
  margin: 0;
}

.close {
  position: absolute;
  top: 0;
  right: 0;
  border: 0;
  background: #f1f3f6;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  font-size: 18px;
  color: #64748b;
  cursor: pointer;
}

.close:hover {
  background: #e2e8f0;
  color: #172033;
}

.error-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.field {
  margin: 16px 0;
}

.field label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 7px;
  color: #172033;
}

.field input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #d7dce6;
  border-radius: 9px;
  font-family: inherit;
  font-size: 13.5px;
  outline: none;
  background: #ffffff;
  color: #172033;
  transition: border-color 0.15s;
}

.field input:focus {
  border-color: var(--b);
  box-shadow: 0 0 0 3px rgba(35, 75, 161, 0.08);
}

.pwd-input-wrap {
  position: relative;
}

.pwd-input-wrap input {
  padding-right: 42px;
}

.pwd-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
}

.btn {
  border: 0;
  border-radius: 9px;
  padding: 12px 16px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.primary {
  background: var(--b);
  color: #ffffff;
}

.primary:hover:not(:disabled) {
  background: var(--b-hover);
  box-shadow: 0 4px 12px rgba(35, 75, 161, 0.2);
}

.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-btn {
  width: 100%;
  margin-top: 10px;
}

.login-security-note {
  text-align: center;
  margin-top: 18px;
}

.meta {
  font-size: 11px;
  color: var(--muted);
}

.spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .login-card-split {
    grid-template-columns: 1fr;
  }
  .brand {
    display: none;
  }
  .loginbox {
    padding: 30px 20px;
  }
}
</style>
