import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';

import { appLogger, type AppLogEntry } from '../../services/logger';

import { viewerDiagnostics, type ViewerDiagnosticsSnapshot } from '../../services/viewer-diagnostics';

export function useErrorLogModal<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(props: TProps, emit: (...args: any[]) => any) {
  const allLogs = ref<AppLogEntry[]>([]);

  const currentFilter = ref<'all' | 'error' | 'warn' | 'backend' | 'frontend' | 'telemetry'>('all');

  const searchQuery = ref('');

  const isCopied = ref(false);

  const terminalBodyRef = ref<HTMLDivElement | null>(null);

  const telemetrySnapshot = ref<ViewerDiagnosticsSnapshot>(viewerDiagnostics.getSnapshot());

  let unsubscribe: (() => void) | null = null;

  let diagUnsubscribe: (() => void) | null = null;

  let pollTimer: any = null;

  const syncLogs = () => {
    allLogs.value = appLogger.getLogs();
  };

  const refreshLogs = async () => {
    await appLogger.fetchBackendLogs();
    syncLogs();
  };

  const clearLogs = async () => {
    appLogger.clear();
    try {
      await fetch('/api/logs', { method: 'DELETE' });
    } catch {}
    syncLogs();
  };

  const copyLogs = async () => {
    const text = filteredLogs.value
      .map((l) => `[${l.timestamp}] [${l.origin.toUpperCase()}] [${l.level.toUpperCase()}]${l.source ? ` (${l.source})` : ''}: ${l.message}`)
      .join('\n');
  
    try {
      await navigator.clipboard.writeText(text || 'No hay logs disponibles.');
      isCopied.value = true;
      setTimeout(() => {
        isCopied.value = false;
      }, 2500);
    } catch {
      isCopied.value = true;
      setTimeout(() => {
        isCopied.value = false;
      }, 2500);
    }
  };

  const close = () => {
    emit('update:modelValue', false);
  };

  const errorCount = computed(() => allLogs.value.filter((l) => l.level === 'error').length);

  const warnCount = computed(() => allLogs.value.filter((l) => l.level === 'warn').length);

  const backendCount = computed(() => allLogs.value.filter((l) => l.origin === 'backend').length);

  const frontendCount = computed(() => allLogs.value.filter((l) => l.origin === 'frontend').length);

  const filteredLogs = computed(() => {
    let list = allLogs.value;
  
    if (currentFilter.value === 'error') {
      list = list.filter((l) => l.level === 'error');
    } else if (currentFilter.value === 'warn') {
      list = list.filter((l) => l.level === 'warn');
    } else if (currentFilter.value === 'backend') {
      list = list.filter((l) => l.origin === 'backend');
    } else if (currentFilter.value === 'frontend') {
      list = list.filter((l) => l.origin === 'frontend');
    }
  
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      list = list.filter((l) => l.message.toLowerCase().includes(q) || (l.source && l.source.toLowerCase().includes(q)));
    }
  
    return list;
  });

  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen) {
        await refreshLogs();
        telemetrySnapshot.value = viewerDiagnostics.getSnapshot();
        nextTick(() => {
          if (terminalBodyRef.value) {
            terminalBodyRef.value.scrollTop = terminalBodyRef.value.scrollHeight;
          }
        });
      }
    }
  );

  onMounted(() => {
    syncLogs();
    unsubscribe = appLogger.subscribe(() => {
      syncLogs();
    });
  
    diagUnsubscribe = viewerDiagnostics.subscribe((snap) => {
      telemetrySnapshot.value = snap;
    });
  
    pollTimer = setInterval(() => {
      if (props.modelValue) {
        appLogger.fetchBackendLogs();
      }
    }, 4000);
  });

  onUnmounted(() => {
    if (unsubscribe) unsubscribe();
    if (diagUnsubscribe) diagUnsubscribe();
    if (pollTimer) clearInterval(pollTimer);
  });

  return {
    ref,
    computed,
    onMounted,
    onUnmounted,
    nextTick,
    watch,
    appLogger,
    viewerDiagnostics,
    allLogs,
    currentFilter,
    searchQuery,
    isCopied,
    terminalBodyRef,
    telemetrySnapshot,
    unsubscribe,
    diagUnsubscribe,
    pollTimer,
    syncLogs,
    refreshLogs,
    clearLogs,
    copyLogs,
    close,
    errorCount,
    warnCount,
    backendCount,
    frontendCount,
    filteredLogs,
  };
}
