<script setup lang="ts">
import type { AppNavView } from './AppSidebar.logic';
import { useAppSidebar } from './AppSidebar.logic';
defineProps<{
  currentView: AppNavView;
  isCollapsed?: boolean;
}>();
defineEmits(["logout", "navigate", "toggle-sidebar"]);
const { computed, currentUser, isAdmin, userInitials } = useAppSidebar();
</script>

<template>
  <aside class="sidebar" :class="{ 'is-collapsed': isCollapsed }">
    <!-- Corporate Brand -->
    <div class="side-brand">
      <img :src="'/Logo/logo.png'" alt="COTECMAR" class="side-brand-logo" />
    </div>

    <!-- Navigation List -->
    <nav class="nav">
      <div class="nav-title">Principal</div>

      <a
        class="nav-item"
        :class="{ active: currentView === 'dashboard' }"
        @click.prevent="$emit('navigate', 'dashboard')"
      >
        <span class="nav-icon">▦</span>
        <span>Dashboard</span>
      </a>

      <a
        class="nav-item"
        :class="{ active: currentView === 'projects' }"
        @click.prevent="$emit('navigate', 'projects')"
      >
        <span class="nav-icon">◫</span>
        <span>Proyectos</span>
      </a>

      <a
        class="nav-item"
        :class="{ active: currentView === 'models' }"
        @click.prevent="$emit('navigate', 'models')"
      >
        <span class="nav-icon">◇</span>
        <span>Modelos BIM</span>
      </a>

      <a
        class="nav-item"
        :class="{ active: currentView === 'viewer' }"
        @click.prevent="$emit('navigate', 'viewer')"
      >
        <span class="nav-icon">◉</span>
        <span>Visor 3D</span>
      </a>

      <div class="nav-title">Administración</div>

      <a
        v-if="isAdmin"
        class="nav-item"
        :class="{ active: currentView === 'users' }"
        @click.prevent="$emit('navigate', 'users')"
      >
        <span class="nav-icon">♙</span>
        <span>Usuarios</span>
      </a>

      <a
        class="nav-item"
        :class="{ active: currentView === 'logs' }"
        @click.prevent="$emit('navigate', 'logs')"
      >
        <span class="nav-icon">≡</span>
        <span>Actividad y logs</span>
      </a>

      <a
        class="nav-item"
        :class="{ active: currentView === 'settings' }"
        @click.prevent="$emit('navigate', 'settings')"
      >
        <span class="nav-icon">⚙</span>
        <span>Configuración</span>
      </a>
    </nav>

    <!-- Bottom User Profile & Logout -->
    <div class="side-bottom">
      <div class="user-mini">
        <div class="avatar" :title="currentUser?.email">
          {{ userInitials }}
        </div>
        <div style="min-width: 0;">
          <strong>{{ currentUser?.name || 'Usuario COTECMAR' }}</strong>
          <span>{{ isAdmin ? 'Administrador' : 'Ingeniero / Usuario' }}</span>
        </div>
      </div>
      <button type="button" class="logout" @click="$emit('logout')">
        Cerrar sesión
      </button>
    </div>
  </aside>
</template>
<style src="./AppSidebar.css"></style>
