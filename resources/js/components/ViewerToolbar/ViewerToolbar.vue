<script setup lang="ts">
import { useViewerToolbar } from './ViewerToolbar.logic';
defineProps<{
  isSectionActive: boolean;
}>();
defineEmits(["clear-scene", "clearScene", "open-frag", "open-ifc", "open-projects", "openFrag", "openIfc", "openProjects", "set-camera-view", "setCameraView", "toggle-section", "toggleSection"]);
const { isAdmin } = useViewerToolbar();
</script>

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
<style scoped src="./ViewerToolbar.css"></style>




