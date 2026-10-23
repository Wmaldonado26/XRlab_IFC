import { computed } from 'vue';

import { currentUser, isAdmin } from '../../services/auth-service';

export type AppNavView =
  | 'dashboard'
  | 'projects'
  | 'models'
  | 'viewer'
  | 'users'
  | 'logs'
  | 'settings';

export function useAppSidebar<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>() {
  

  

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
    isAdmin,
    userInitials,
  };
}
