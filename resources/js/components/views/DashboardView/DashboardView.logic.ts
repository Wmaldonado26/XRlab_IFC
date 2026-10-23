import { ref, computed, onMounted } from 'vue';

import { currentUser, isAdmin } from '../../../services/auth-service';

import {
  fetchDashboardStats,
  type DashboardStats,
  type BackendProject,
} from '../../../services/backend-client';

export function useDashboardView<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(emit: (...args: any[]) => any) {
  const stats = ref<DashboardStats | null>(null);

  const isLoading = ref(true);

  const userFirstName = computed(() => {
    if (!currentUser.value?.name) return 'Ingeniero';
    return currentUser.value.name.trim().split(/\s+/)[0];
  });

  function truncate(text: string, max: number): string {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '...' : text;
  }

  async function loadStats() {
    isLoading.value = true;
    try {
      stats.value = await fetchDashboardStats();
    } catch (err) {
      console.warn('[Dashboard] Error cargando estadísticas:', err);
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(() => {
    loadStats();
  });

  return {
    ref,
    computed,
    onMounted,
    currentUser,
    isAdmin,
    fetchDashboardStats,
    stats,
    isLoading,
    userFirstName,
    truncate,
    loadStats,
  };
}
