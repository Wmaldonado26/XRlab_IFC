<script setup lang="ts">
import { useLoginModal } from './LoginModal.logic';
const props = withDefaults(defineProps<{
  allowClose?: boolean;
  modelValue: boolean;
}>(), { allowClose: true });
const emit = defineEmits(["login-success", "update:modelValue"]);
const { ref, login, email, password, showPassword, isLoading, errorMessage, onBackdropClick, handleLogin } = useLoginModal(props, emit);
</script>

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
<style scoped src="./LoginModal.css"></style>




