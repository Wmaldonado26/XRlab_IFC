<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import LoginPage from './components/LoginPage.vue';
import AppSidebar, { type AppNavView } from './components/AppSidebar.vue';
import AppTopbar from './components/AppTopbar.vue';
import GlobalToast from './components/GlobalToast.vue';
import DashboardView from './components/views/DashboardView.vue';
import ProjectsView from './components/views/ProjectsView.vue';
import ModelsView from './components/views/ModelsView.vue';
import UsersView from './components/views/UsersView.vue';
import LogsView from './components/views/LogsView.vue';
import SettingsView from './components/views/SettingsView.vue';
import ViewerCo from './components/ViewerCo.vue';
import {
  checkSession,
  isAuthenticated,
  isAdmin,
  logout,
  isAuthLoading,
} from './services/auth-service';
import {
  fetchBackendProject,
  type BackendProject,
} from './services/backend-client';

const currentView = ref<AppNavView>('dashboard');
const selectedProject = ref<BackendProject | null>(null);
const isSidebarCollapsed = ref(false);
const toastRef = ref<InstanceType<typeof GlobalToast> | null>(null);

function handleToggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
  try {
    localStorage.setItem('xrlab_sidebar_collapsed', isSidebarCollapsed.value ? 'true' : 'false');
  } catch {}
  triggerViewerResize();
}

function showToast(message: string) {
  toastRef.value?.show(message);
}

function triggerViewerResize() {
  nextTick(() => {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 80);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 250);
  });
}

async function syncRouteFromHash() {
  const hash = window.location.hash || '';

  if (hash.startsWith('#project=')) {
    const projectId = hash.replace('#project=', '').trim();
    if (projectId) {
      if (selectedProject.value && selectedProject.value.id === projectId) {
        currentView.value = 'viewer';
        triggerViewerResize();
        return;
      }
      try {
        const proj = await fetchBackendProject(projectId);
        selectedProject.value = proj;
        currentView.value = 'viewer';
        triggerViewerResize();
        return;
      } catch (err: any) {
        console.warn('Acceso denegado o proyecto no encontrado:', err);
        showToast(`No es posible abrir el proyecto: ${err.message || 'Acceso no autorizado'}`);
        window.location.hash = '#projects';
        selectedProject.value = null;
        currentView.value = 'projects';
        return;
      }
    }
  }

  if (hash === '#viewer') {
    currentView.value = 'viewer';
    triggerViewerResize();
    return;
  }
  if (hash === '#projects') {
    currentView.value = 'projects';
    return;
  }
  if (hash === '#models') {
    currentView.value = 'models';
    return;
  }
  if (hash === '#users') {
    currentView.value = isAdmin.value ? 'users' : 'dashboard';
    return;
  }
  if (hash === '#logs') {
    currentView.value = 'logs';
    return;
  }
  if (hash === '#settings') {
    currentView.value = 'settings';
    return;
  }

  // Default to dashboard
  currentView.value = 'dashboard';
}

function handleNavigate(view: AppNavView | string) {
  if (view === 'users' && !isAdmin.value) {
    showToast('Acceso restringido a Administradores');
    return;
  }
  currentView.value = view as AppNavView;
  if (view === 'viewer') {
    if (selectedProject.value) {
      window.location.hash = `#project=${selectedProject.value.id}`;
    } else {
      window.location.hash = '#viewer';
    }
    triggerViewerResize();
  } else {
    window.location.hash = `#${view}`;
  }
}

function handleOpenProject(project: BackendProject) {
  selectedProject.value = project;
  currentView.value = 'viewer';
  window.location.hash = `#project=${project.id}`;
  triggerViewerResize();
  showToast(`Cargando proyecto: ${project.name}`);
}

function handleProjectChanged(project: BackendProject) {
  selectedProject.value = project;
  window.location.hash = `#project=${project.id}`;
}

function handleReturnGallery() {
  currentView.value = 'projects';
  window.location.hash = '#projects';
  isSidebarCollapsed.value = false;
  triggerViewerResize();
}

watch(currentView, (newView) => {
  if (newView === 'viewer') {
    isSidebarCollapsed.value = true;
    triggerViewerResize();
  }
});

async function handleLogout() {
  try {
    await logout();
    showToast('Sesión cerrada correctamente');
  } catch (err: any) {
    console.error('Error al cerrar sesión:', err);
  }
}

function onLoginSuccess() {
  showToast('Bienvenido a COTECMAR XRlab');
  syncRouteFromHash();
}

onMounted(async () => {
  try {
    if (localStorage.getItem('xrlab_sidebar_collapsed') === 'true') {
      isSidebarCollapsed.value = true;
    }
  } catch {}
  await checkSession();
  await syncRouteFromHash();
  window.addEventListener('hashchange', syncRouteFromHash);
});

onUnmounted(() => {
  window.removeEventListener('hashchange', syncRouteFromHash);
});
</script>

<template>
  <main class="app-root">
    <!-- Pantalla de Carga Inicial de Sesión -->
    <div v-if="isAuthLoading" class="auth-loading-screen">
      <div class="brand" style="margin-bottom: 16px;">
        <div class="brand-mark">⚓</div>
        <div>
          <div style="font-weight: 800; font-size: 18px; color: var(--navy)">COTECMAR</div>
          <div style="font-size: 11px; color: var(--blue); font-weight: 700">XRlab</div>
        </div>
      </div>
      <div class="spinner-sm" style="border-top-color: var(--blue);"></div>
      <p style="color: var(--muted); font-size: 12px; margin-top: 12px;">Conectando con plataforma BIM...</p>
    </div>

    <!-- Pantalla de Login Corporativo -->
    <LoginPage
      v-else-if="!isAuthenticated"
      @login-success="onLoginSuccess"
    />

    <!-- Shell Empresarial Permanente -->
    <div v-else class="app" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
      <!-- Barra lateral corporativa -->
      <AppSidebar
        :current-view="currentView"
        :is-collapsed="isSidebarCollapsed"
        @navigate="handleNavigate"
        @logout="handleLogout"
        @toggle-sidebar="handleToggleSidebar"
      />

      <!-- Contenedor Principal -->
      <main class="main">
        <!-- Barra superior corporativa -->
        <AppTopbar
          :current-view="currentView"
          :is-sidebar-collapsed="isSidebarCollapsed"
          @navigate="handleNavigate"
          @toast="showToast"
          @toggle-sidebar="handleToggleSidebar"
          @return-gallery="handleReturnGallery"
        />

        <!-- VISTA DASHBOARD -->
        <div v-show="currentView === 'dashboard'">
          <DashboardView
            @navigate="handleNavigate"
            @open-project="handleOpenProject"
            @show-toast="showToast"
          />
        </div>

        <!-- VISTA PROYECTOS -->
        <div v-show="currentView === 'projects'">
          <ProjectsView
            @open-project="handleOpenProject"
            @show-toast="showToast"
          />
        </div>

        <!-- VISTA MODELOS BIM -->
        <div v-show="currentView === 'models'">
          <ModelsView
            @open-project="handleOpenProject"
            @show-toast="showToast"
          />
        </div>

        <!-- VISTA USUARIOS (Solo Administrador) -->
        <div v-if="isAdmin" v-show="currentView === 'users'">
          <UsersView
            @show-toast="showToast"
          />
        </div>

        <!-- VISTA ACTIVIDAD Y LOGS -->
        <div v-show="currentView === 'logs'">
          <LogsView
            @show-toast="showToast"
          />
        </div>

        <!-- VISTA CONFIGURACIÓN -->
        <div v-show="currentView === 'settings'">
          <SettingsView
            @show-toast="showToast"
          />
        </div>

        <!-- VISTA VISOR 3D (Preservado en DOM para no perder contexto WebGL ni fragmentos GPU) -->
        <div
          v-show="currentView === 'viewer'"
          class="viewer-embedded-wrapper"
        >
          <ViewerCo
            :initial-project="selectedProject"
            @return-gallery="handleReturnGallery"
            @project-changed="handleProjectChanged"
          />
        </div>
      </main>
    </div>

    <!-- Toast Global de Notificaciones -->
    <GlobalToast ref="toastRef" />
  </main>
</template>

<style>
.app-root {
  width: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  position: relative;
  background: var(--bg);
  overflow-x: hidden;
}

.auth-loading-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #ffffff;
}

.viewer-embedded-wrapper {
  height: calc(100vh - 76px);
  width: 100%;
  position: relative;
  overflow: hidden;
  background: #091622;
}

.spinner-sm {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(18, 76, 145, 0.2);
  border-top-color: var(--blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
