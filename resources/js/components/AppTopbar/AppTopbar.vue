<script setup lang="ts">
import type { AppNavView } from '../AppSidebar/AppSidebar.logic';
import { useAppTopbar } from './AppTopbar.logic';
const props = defineProps<{
  currentView: AppNavView;
  isSidebarCollapsed: boolean;
}>();
defineEmits(["navigate", "return-gallery", "toast", "toggle-sidebar"]);
const { computed, currentUser, titleMap, currentTitle, userInitials } = useAppTopbar(props);
</script>

<template>
  <header class="topbar">
    <!-- Left: Sidebar toggle + Breadcrumb -->
    <div class="topbar-left">
      <button
        v-if="currentView !== 'viewer'"
        type="button"
        class="sidebar-toggle-btn"
        :title="isSidebarCollapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'"
        @click="$emit('toggle-sidebar')"
      >
        <span>☰</span>
      </button>

      <!-- Botón de volver exclusivo para el visor 3D -->
      <button
        v-if="currentView === 'viewer'"
        type="button"
        class="topbar-back-btn"
        title="Volver a Proyectos"
        @click="$emit('return-gallery')"
      >
        ← Volver
      </button>

      <div v-if="currentView !== 'viewer'" class="breadcrumb">
        COTECMAR / <strong id="crumb">{{ currentTitle }}</strong>
      </div>
    </div>

    <!-- Top Actions -->
    <div class="top-actions">
      <button
        type="button"
        class="icon-btn"
        title="Notificaciones"
        @click="$emit('toast', 'No tienes notificaciones pendientes')"
      >
        <span>⌁</span>
        <i class="notification-dot"></i>
      </button>

      <button
        type="button"
        class="icon-btn"
        title="Configuración"
        @click="$emit('navigate', 'settings')"
      >
        <span>⚙</span>
      </button>

      <div class="avatar" :title="currentUser?.name">
        {{ userInitials }}
      </div>
    </div>
  </header>
</template>
<style src="./AppTopbar.css"></style>
