import { ref, onMounted } from 'vue';

import {
  fetchActivityLogs,
  type ActivityLogItem,
} from '../../../services/backend-client';

export function useLogsView<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(emit: (...args: any[]) => any) {
  const logs = ref<ActivityLogItem[]>([]);
  const currentPage = ref(1);
  const lastPage = ref(1);
  const total = ref(0);

  const isLoading = ref(true);

  async function loadLogs() {
    isLoading.value = true;
    try {
      const result = await fetchActivityLogs(currentPage.value);
      logs.value = result.logs;
      currentPage.value = result.currentPage;
      lastPage.value = result.lastPage;
      total.value = result.total;
    } catch (err: any) {
      emit('show-toast', err.message || 'Error cargando logs');
    } finally {
      isLoading.value = false;
    }
  }

  async function changePage(page: number) {
    if (page < 1 || page > lastPage.value) return;
    currentPage.value = page;
    await loadLogs();
  }

  function exportCsv() {
    if (logs.value.length === 0) {
      emit('show-toast', 'No hay registros de auditoría para exportar');
      return;
    }
    const headers = ['Fecha', 'Usuario', 'Acción', 'Recurso', 'Proyecto', 'Resultado'];
    const rows = logs.value.map((l) => [
      `"${l.date}"`,
      `"${l.user}"`,
      `"${l.action}"`,
      `"${l.resource}"`,
      `"${l.projectName || ''}"`,
      `"${l.result}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `xrlab_actividad_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    emit('show-toast', 'Registro de auditoría exportado en CSV');
  }

  onMounted(() => {
    loadLogs();
  });

  return {
    ref,
    onMounted,
    fetchActivityLogs,
    logs,
    currentPage,
    lastPage,
    total,
    isLoading,
    loadLogs,
    changePage,
    exportCsv,
  };
}
