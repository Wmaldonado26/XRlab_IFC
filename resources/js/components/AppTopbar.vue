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

<script setup lang="ts">
import { computed } from 'vue';
import { currentUser } from '../services/auth-service';
import type { AppNavView } from './AppSidebar.vue';

const props = defineProps<{
  currentView: AppNavView;
  isSidebarCollapsed?: boolean;
}>();

defineEmits<{
  (e: 'navigate', view: AppNavView): void;
  (e: 'toast', message: string): void;
  (e: 'toggle-sidebar'): void;
  (e: 'return-gallery'): void;
}>();

const titleMap: Record<AppNavView, string> = {
  dashboard: 'Dashboard',
  projects: 'Proyectos',
  models: 'Modelos BIM',
  viewer: 'Visor 3D',
  users: 'Gestión de usuarios',
  logs: 'Actividad y logs',
  settings: 'Configuración',
};

const currentTitle = computed(() => {
  return titleMap[props.currentView] || 'Plataforma BIM';
});

const userInitials = computed(() => {
  if (!currentUser.value?.name) return 'XR';
  const parts = currentUser.value.name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
});
</script>
