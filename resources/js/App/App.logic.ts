import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';

import LoginPage from '../components/LoginPage/LoginPage.vue';

import AppSidebar from '../components/AppSidebar/AppSidebar.vue';
import type { AppNavView } from '../components/AppSidebar/AppSidebar.logic';

import AppTopbar from '../components/AppTopbar/AppTopbar.vue';

import GlobalToast from '../components/GlobalToast/GlobalToast.vue';

import DashboardView from '../components/views/DashboardView/DashboardView.vue';

import ProjectsView from '../components/views/ProjectsView/ProjectsView.vue';

import ModelsView from '../components/views/ModelsView/ModelsView.vue';

import UsersView from '../components/views/UsersView/UsersView.vue';

import LogsView from '../components/views/LogsView/LogsView.vue';

import SettingsView from '../components/views/SettingsView/SettingsView.vue';

import ViewerCo from '../components/ViewerCo/ViewerCo.vue';

import {
  checkSession,
  isAuthenticated,
  isAdmin,
  logout,
  isAuthLoading,
} from '../services/auth-service';

import {
  fetchBackendProject,
  type BackendProject,
} from '../services/backend-client';

export function useApp<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>() {
  const currentView = ref<AppNavView>('dashboard');

  const isPasswordResetLink = ref(
    typeof window !== 'undefined' && window.location.hash.startsWith('#reset-password?')
  );

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

    if (hash.startsWith('#reset-password?')) {
      isPasswordResetLink.value = true;
      return;
    }
    isPasswordResetLink.value = false;
  
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

  return {
    ref,
    onMounted,
    onUnmounted,
    nextTick,
    watch,
    LoginPage,
    AppSidebar,
    AppTopbar,
    GlobalToast,
    DashboardView,
    ProjectsView,
    ModelsView,
    UsersView,
    LogsView,
    SettingsView,
    ViewerCo,
    checkSession,
    isAuthenticated,
    isPasswordResetLink,
    isAdmin,
    logout,
    isAuthLoading,
    fetchBackendProject,
    currentView,
    selectedProject,
    isSidebarCollapsed,
    toastRef,
    handleToggleSidebar,
    showToast,
    triggerViewerResize,
    syncRouteFromHash,
    handleNavigate,
    handleOpenProject,
    handleProjectChanged,
    handleReturnGallery,
    handleLogout,
    onLoginSuccess,
  };
}
