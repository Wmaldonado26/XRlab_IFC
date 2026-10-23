import { computed } from 'vue';

import { currentUser } from '../../services/auth-service';

import type { AppNavView } from '../AppSidebar/AppSidebar.logic';

export function useAppTopbar(props: { currentView: AppNavView; isSidebarCollapsed: boolean }) {
  

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

  return {
    computed,
    currentUser,
    titleMap,
    currentTitle,
    userInitials,
  };
}
