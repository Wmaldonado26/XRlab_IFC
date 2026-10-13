<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { currentUser } from '../../services/auth-service';

const emit = defineEmits<{
  (e: 'show-toast', message: string): void;
}>();

const profileName = ref('');
const profileEmail = ref('');

// Viewer preferences persisted in localStorage
const quality = ref('alta');
const units = ref('m');
const initialCamera = ref('fit');

onMounted(() => {
  if (currentUser.value) {
    profileName.value = currentUser.value.name;
    profileEmail.value = currentUser.value.email;
  }
  const savedQuality = localStorage.getItem('xrlab_pref_quality');
  if (savedQuality) quality.value = savedQuality;
  const savedUnits = localStorage.getItem('xrlab_pref_units');
  if (savedUnits) units.value = savedUnits;
  const savedCamera = localStorage.getItem('xrlab_pref_camera');
  if (savedCamera) initialCamera.value = savedCamera;
});

function handleSave() {
  localStorage.setItem('xrlab_pref_quality', quality.value);
  localStorage.setItem('xrlab_pref_units', units.value);
  localStorage.setItem('xrlab_pref_camera', initialCamera.value);
  emit('show-toast', 'Preferencias guardadas correctamente');
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Configuración</h1>
        <p>Preferencias generales de la plataforma.</p>
      </div>
      <button class="primary-btn" @click="handleSave">
        Guardar cambios
      </button>
    </div>

    <div class="grid-2">
      <!-- PERFIL CORPORATIVO -->
      <section class="panel">
        <div class="panel-head">
          <h3>Perfil corporativo</h3>
          <span>Información de cuenta</span>
        </div>
        <div style="padding: 20px">
          <div class="form-group">
            <label>Nombre completo</label>
            <input v-model="profileName" placeholder="Tu nombre" disabled style="background: #f8fafc; color: #475569">
          </div>
          <div class="form-group">
            <label>Correo corporativo</label>
            <input v-model="profileEmail" type="email" disabled style="background: #f8fafc; color: #475569">
          </div>
          <div class="form-group">
            <label>Rol asignado</label>
            <input
              :value="currentUser?.role === 'admin' ? 'Administrador' : 'Ingeniero / Usuario'"
              disabled
              style="background: #f8fafc; color: #475569"
            >
          </div>
        </div>
      </section>

      <!-- PREFERENCIAS DEL VISOR -->
      <section class="panel">
        <div class="panel-head">
          <h3>Preferencias del visor 3D</h3>
          <span>Motor That Open / Three.js</span>
        </div>
        <div style="padding: 20px">
          <div class="form-group">
            <label>Calidad de visualización</label>
            <select v-model="quality">
              <option value="alta">Alta (60 FPS, sombreado completo)</option>
              <option value="media">Media (Balanceada)</option>
              <option value="automatica">Automática (Ajuste según GPU)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Unidades de medida</label>
            <select v-model="units">
              <option value="m">Metros (m)</option>
              <option value="mm">Milímetros (mm)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Comportamiento inicial de cámara</label>
            <select v-model="initialCamera">
              <option value="fit">Enfocar modelo completo</option>
              <option value="iso">Perspectiva Isométrica</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
