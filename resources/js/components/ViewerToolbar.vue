<template>
  <div class="viewer-toolbar-wrap">
    <div class="toolbar-dock">
      <!-- Cargar IFC (Solo Administrador) -->
      <button
        v-if="isAdmin"
        type="button"
        class="dock-item"
        title="Cargar modelo IFC"
        @click="$emit('openIfc')"
      >
        <span class="dock-icon">📂</span>
        <span class="dock-label">Cargar IFC</span>
      </button>

      <!-- Cargar Frag (Solo Administrador) -->
      <button
        v-if="isAdmin"
        type="button"
        class="dock-item"
        title="Cargar archivos de fragmentos (.frag)"
        @click="$emit('openFrag')"
      >
        <span class="dock-icon">🧩</span>
        <span class="dock-label">Cargar Frag</span>
      </button>

      <div v-if="isAdmin" class="dock-divider"></div>

      <!-- Planos de Sección / Corte 3D -->
      <button
        type="button"
        class="dock-item"
        :class="{ active: isSectionActive }"
        title="Plano de corte 3D interactivo"
        @click="$emit('toggleSection')"
      >
        <span class="dock-icon">📐</span>
        <span class="dock-label">Sección</span>
      </button>

      <!-- Vistas Ortogonales Dropdown/Pills -->
      <div class="views-group">
        <button
          type="button"
          class="dock-item view-btn"
          title="Vista Superior / Planta (Cubierta)"
          @click="$emit('setCameraView', 'top')"
        >
          <span class="dock-icon">⬆️</span>
          <span class="dock-label">Planta</span>
        </button>
        <button
          type="button"
          class="dock-item view-btn"
          title="Vista Frontal / Proa-Popa"
          @click="$emit('setCameraView', 'front')"
        >
          <span class="dock-icon">🚢</span>
          <span class="dock-label">Proa</span>
        </button>
        <button
          type="button"
          class="dock-item view-btn"
          title="Vista Lateral / Babor-Estribor"
          @click="$emit('setCameraView', 'side')"
        >
          <span class="dock-icon">↔️</span>
          <span class="dock-label">Perfil</span>
        </button>
        <button
          type="button"
          class="dock-item view-btn"
          title="Vista Isométrica 3D"
          @click="$emit('setCameraView', 'iso')"
        >
          <span class="dock-icon">🧭</span>
          <span class="dock-label">Iso</span>
        </button>
      </div>

      <div class="dock-divider"></div>

      <!-- Catálogo / Mis Proyectos -->
      <button
        type="button"
        class="dock-item"
        :title="isAdmin ? 'Catálogo de Proyectos y Caché Local' : 'Mis Proyectos Asignados'"
        @click="$emit('openProjects')"
      >
        <span class="dock-icon">🗂️</span>
        <span class="dock-label">{{ isAdmin ? 'Proyectos' : 'Mis Proyectos' }}</span>
      </button>

      <!-- Limpiar Escena -->
      <button
        type="button"
        class="dock-item clear-btn"
        title="Limpiar modelos y liberar memoria"
        @click="$emit('clearScene')"
      >
        <span class="dock-icon">🧹</span>
        <span class="dock-label">Limpiar</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isAdmin } from '../services/auth-service';

defineProps<{
  isSectionActive: boolean;
}>();

defineEmits<{
  (e: 'openIfc'): void;
  (e: 'openFrag'): void;
  (e: 'toggleSection'): void;
  (e: 'setCameraView', view: 'top' | 'front' | 'side' | 'iso'): void;
  (e: 'openProjects'): void;
  (e: 'clearScene'): void;
}>();
</script>

<style scoped>
.viewer-toolbar-wrap {
  position: absolute;
  top: 50%;
  right: 18px;
  transform: translateY(-50%);
  z-index: 1000;
  pointer-events: all;
  user-select: none;
}

.toolbar-dock {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid #e5e9f0;
  border-radius: 14px;
  padding: 10px 6px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.28);
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}

.toolbar-dock::-webkit-scrollbar {
  width: 4px;
}

.toolbar-dock::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}

.dock-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 9px;
  padding: 6px 8px;
  color: #526074;
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 52px;
  width: 100%;
}

.dock-item:hover {
  background: #edf2ff;
  color: #234BA1;
  transform: scale(1.04);
}

.dock-item.active {
  background: #edf2ff;
  border-color: #87a2d3;
  color: #234BA1;
  font-weight: 700;
}

.dock-icon {
  font-size: 1.15rem;
  line-height: 1;
}

.dock-label {
  font-size: 0.68rem;
  font-weight: 700;
  margin-top: 3px;
  letter-spacing: 0.02em;
}

.dock-divider {
  width: 32px;
  height: 1px;
  background: #e5e9f0;
  margin: 3px 0;
}

.views-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  background: #f8faff;
  border-radius: 9px;
  padding: 3px;
  border: 1px solid #e5e9f0;
  width: 100%;
}

.view-btn {
  padding: 5px 6px;
  min-width: unset;
  width: 100%;
}

.clear-btn:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}
</style>
