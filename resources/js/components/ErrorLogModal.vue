<template>
  <div v-if="modelValue" class="log-modal-overlay" @click.self="close">
    <div class="log-modal-card">
      <!-- Header -->
      <div class="log-modal-header">
        <div class="header-left">
          <span class="terminal-icon">📟</span>
          <div>
            <h3 class="modal-title">Consola de Diagnóstico y Errores</h3>
            <p class="modal-subtitle">Eventos del Frontend, Web Workers y Microservicio Node.js de 64 bits</p>
          </div>
        </div>

        <div class="header-right">
          <span v-if="errorCount > 0" class="badge-error-count">
            {{ errorCount }} {{ errorCount === 1 ? 'error detectado' : 'errores detectados' }}
          </span>
          <span v-else class="badge-no-errors">
            ✓ Sin errores críticos
          </span>
          <button class="btn-icon-close" title="Cerrar" @click="close">✕</button>
        </div>
      </div>

      <!-- Controls & Filter Toolbar -->
      <div class="log-toolbar">
        <div class="filter-pills">
          <button
            class="pill-btn"
            :class="{ active: currentFilter === 'all' }"
            @click="currentFilter = 'all'"
          >
            Todos ({{ allLogs.length }})
          </button>
          <button
            class="pill-btn pill-error"
            :class="{ active: currentFilter === 'error' }"
            @click="currentFilter = 'error'"
          >
            Errores ({{ errorCount }})
          </button>
          <button
            class="pill-btn pill-warn"
            :class="{ active: currentFilter === 'warn' }"
            @click="currentFilter = 'warn'"
          >
            Advertencias ({{ warnCount }})
          </button>
          <button
            class="pill-btn pill-backend"
            :class="{ active: currentFilter === 'backend' }"
            @click="currentFilter = 'backend'"
          >
            Backend ({{ backendCount }})
          </button>
          <button
            class="pill-btn pill-frontend"
            :class="{ active: currentFilter === 'frontend' }"
            @click="currentFilter = 'frontend'"
          >
            Frontend ({{ frontendCount }})
          </button>
          <button
            class="pill-btn pill-telemetry"
            :class="{ active: currentFilter === 'telemetry' }"
            @click="currentFilter = 'telemetry'"
          >
            📊 Telemetría en Vivo
          </button>
        </div>

        <div class="toolbar-actions">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar en logs..."
              class="search-input"
            />
          </div>

          <button class="action-btn" title="Actualizar logs del backend" @click="refreshLogs">
            🔄 Actualizar
          </button>
          <button class="action-btn" :class="{ copied: isCopied }" title="Copiar logs al portapapeles" @click="copyLogs">
            {{ isCopied ? '✓ Copiado' : '📋 Copiar' }}
          </button>
          <button class="action-btn btn-danger" title="Limpiar lista de logs" @click="clearLogs">
            🗑️ Limpiar
          </button>
        </div>
      </div>

      <!-- Terminal Output Container -->
      <div ref="terminalBodyRef" class="terminal-body">
        <!-- Dashboard de Telemetría en Vivo -->
        <div v-if="currentFilter === 'telemetry'" class="telemetry-dashboard">
          <div class="telemetry-header">
            <div class="telemetry-title-group">
              <span class="telemetry-live-dot"></span>
              <h4 class="telemetry-title">Diagnóstico y Telemetría del Visor 3D en Tiempo Real</h4>
            </div>
            <span class="telemetry-timestamp">Muestreo: {{ new Date(telemetrySnapshot.timestamp).toLocaleTimeString() }}</span>
          </div>

          <div class="telemetry-grid">
            <!-- WebGL Context Card -->
            <div class="telemetry-card" :class="telemetrySnapshot.webglStatus === 'lost' ? 'card-danger' : 'card-success'">
              <div class="card-icon">🎮</div>
              <div class="card-info">
                <span class="card-label">Contexto WebGL</span>
                <span class="card-value">{{ telemetrySnapshot.webglStatus.toUpperCase() }}</span>
                <span class="card-sub">Resolución: {{ telemetrySnapshot.canvasResolution }} (DPR: {{ telemetrySnapshot.devicePixelRatio }})</span>
              </div>
            </div>

            <!-- Frame Rate & Latency -->
            <div class="telemetry-card">
              <div class="card-icon">⚡</div>
              <div class="card-info">
                <span class="card-label">Rendimiento Gráfico</span>
                <span class="card-value">{{ telemetrySnapshot.fps }} <small>FPS</small></span>
                <span class="card-sub">Latencia: {{ telemetrySnapshot.frameTimeMs }} ms / cuadro</span>
              </div>
            </div>

            <!-- Three.js Pipeline -->
            <div class="telemetry-card">
              <div class="card-icon">📐</div>
              <div class="card-info">
                <span class="card-label">Pipeline Three.js</span>
                <span class="card-value">{{ telemetrySnapshot.triangles.toLocaleString() }} <small>Δ</small></span>
                <span class="card-sub">{{ telemetrySnapshot.drawCalls }} Draw Calls · {{ telemetrySnapshot.geometriesCount }} Geometrías</span>
              </div>
            </div>

            <!-- JS Heap Memory -->
            <div class="telemetry-card" :class="telemetrySnapshot.jsHeapUsedMB && telemetrySnapshot.jsHeapUsedMB > 1200 ? 'card-warning' : ''">
              <div class="card-icon">🧠</div>
              <div class="card-info">
                <span class="card-label">Memoria JS Heap</span>
                <template v-if="telemetrySnapshot.memoryApiSupported && telemetrySnapshot.jsHeapUsedMB !== null">
                  <span class="card-value">{{ telemetrySnapshot.jsHeapUsedMB }} <small>MB</small></span>
                  <span class="card-sub">Total: {{ telemetrySnapshot.jsHeapTotalMB }} MB / Límite: {{ telemetrySnapshot.jsHeapLimitMB }} MB</span>
                </template>
                <template v-else>
                  <span class="card-value">N/D</span>
                  <span class="card-sub">performance.memory no expuesto (WebKit/Safari)</span>
                </template>
              </div>
            </div>

            <!-- GPU VRAM Estimate -->
            <div class="telemetry-card">
              <div class="card-icon">🖥️</div>
              <div class="card-info">
                <span class="card-label">GPU VRAM Estimada</span>
                <span class="card-value">~{{ telemetrySnapshot.gpuMemoryEstimatedMB }} <small>MB</small></span>
                <span class="card-sub">Framebuffer MSAA + Buffers de Vértices</span>
              </div>
            </div>

            <!-- Backend Free RAM -->
            <div class="telemetry-card">
              <div class="card-icon">🖧</div>
              <div class="card-info">
                <span class="card-label">RAM Microservicio Node.js</span>
                <span class="card-value">{{ telemetrySnapshot.backendFreeMemoryGB !== null ? telemetrySnapshot.backendFreeMemoryGB + ' GB' : 'N/D' }}</span>
                <span class="card-sub">Memoria RAM libre del servidor</span>
              </div>
            </div>

            <!-- Load Session Metrics -->
            <div class="telemetry-card full-width">
              <div class="card-icon">⏱️</div>
              <div class="card-info">
                <span class="card-label">Sesión de Carga & Concurrencia</span>
                <div class="load-metrics-inline">
                  <span>Cargas activas: <strong>{{ telemetrySnapshot.concurrentLoads }}</strong></span>
                  <span v-if="telemetrySnapshot.lastLoadDurationMs">Duración: <strong>{{ (telemetrySnapshot.lastLoadDurationMs / 1000).toFixed(2) }} s</strong></span>
                  <span v-if="telemetrySnapshot.lastLoadBytes">Transferido: <strong>{{ (telemetrySnapshot.lastLoadBytes / (1024 * 1024)).toFixed(1) }} MB</strong></span>
                  <span v-if="telemetrySnapshot.lastLoadPartsCount">Partes: <strong>{{ telemetrySnapshot.lastLoadPartsCount }}</strong></span>
                  <span v-if="telemetrySnapshot.lastLoadSpeedMBs">Velocidad efectiva: <strong>{{ telemetrySnapshot.lastLoadSpeedMBs }} MB/s</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Terminal Logs Normales -->
        <template v-else>
          <div v-if="filteredLogs.length === 0" class="empty-state">
            <span class="empty-icon">✨</span>
            <p class="empty-text">No hay registros que coincidan con el filtro actual.</p>
          </div>

          <div
            v-for="log in filteredLogs"
            :key="log.id"
            class="log-row"
            :class="`level-${log.level}`"
          >
            <span class="log-time">{{ log.timestamp }}</span>
            <span class="log-origin" :class="`origin-${log.origin}`">
              [{{ log.origin.toUpperCase() }}]
            </span>
            <span class="log-level" :class="`badge-${log.level}`">
              {{ log.level.toUpperCase() }}
            </span>
            <span v-if="log.source" class="log-source">({{ log.source }})</span>
            <pre class="log-message">{{ log.message }}</pre>
          </div>
        </template>
      </div>

      <!-- Footer -->
      <div class="log-modal-footer">
        <span class="footer-stats">
          <template v-if="currentFilter === 'telemetry'">
            Telemetría activa · Muestreo en vivo a 60 FPS
          </template>
          <template v-else>
            Mostrando {{ filteredLogs.length }} de {{ allLogs.length }} entradas registradas
          </template>
        </span>
        <button class="btn-footer-close" @click="close">
          Cerrar Consola
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { appLogger, type AppLogEntry } from '../services/logger';
import { viewerDiagnostics, type ViewerDiagnosticsSnapshot } from '../services/viewer-diagnostics';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

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
</script>

<style scoped>
.log-modal-overlay {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  background: rgba(2, 6, 23, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

.log-modal-card {
  width: min(96vw, 980px);
  height: min(88vh, 720px);
  background: #0f172a;
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(56, 189, 248, 0.15);
  color: #f8fafc;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* Header */
.log-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  background: #0a0f1d;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.terminal-icon {
  font-size: 1.5rem;
}

.modal-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: #f8fafc;
  line-height: 1.3;
}

.modal-subtitle {
  margin: 2px 0 0 0;
  font-size: 0.76rem;
  color: #94a3b8;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.badge-error-count {
  background: rgba(239, 68, 68, 0.18);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  animation: pulse-red 2s infinite alternate;
}

@keyframes pulse-red {
  from { opacity: 0.7; }
  to { opacity: 1; }
}

.badge-no-errors {
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.35);
  color: #86efac;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
}

.btn-icon-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.btn-icon-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

/* Toolbar */
.log-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 22px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.filter-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pill-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pill-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f1f5f9;
}

.pill-btn.active {
  background: #0284c7;
  border-color: #38bdf8;
  color: #ffffff;
  font-weight: 600;
}

.pill-btn.pill-error.active {
  background: #dc2626;
  border-color: #f87171;
}

.pill-btn.pill-warn.active {
  background: #d97706;
  border-color: #fbbf24;
}

.pill-btn.pill-backend.active {
  background: #7c3aed;
  border-color: #a78bfa;
}

.pill-btn.pill-frontend.active {
  background: #0d9488;
  border-color: #2dd4bf;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-box {
  display: flex;
  align-items: center;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 3px 8px;
  gap: 6px;
}

.search-icon {
  font-size: 0.75rem;
  opacity: 0.6;
}

.search-input {
  background: transparent;
  border: none;
  outline: none;
  color: #f8fafc;
  font-size: 0.76rem;
  width: 140px;
}

.action-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 0.74rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

.action-btn.copied {
  background: rgba(34, 197, 94, 0.2);
  border-color: #4ade80;
  color: #86efac;
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #f87171;
  color: #fca5a5;
}

/* Terminal Body */
.terminal-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 20px;
  background: #090d16;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.78rem;
  line-height: 1.5;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #64748b;
  gap: 8px;
}

.empty-icon {
  font-size: 2rem;
}

.empty-text {
  margin: 0;
  font-size: 0.85rem;
}

.log-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 4px;
  margin-bottom: 2px;
  transition: background 0.15s ease;
  word-break: break-all;
}

.log-row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.log-time {
  color: #64748b;
  flex-shrink: 0;
  user-select: none;
}

.log-origin {
  font-weight: 600;
  font-size: 0.68rem;
  flex-shrink: 0;
}

.origin-backend {
  color: #c084fc;
}

.origin-frontend {
  color: #38bdf8;
}

.log-level {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.badge-info {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.badge-warn {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.badge-error {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.log-source {
  color: #94a3b8;
  font-size: 0.72rem;
  flex-shrink: 0;
}

.log-message {
  margin: 0;
  color: #e2e8f0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  flex: 1;
}

.level-error {
  background: rgba(239, 68, 68, 0.06);
}

.level-error .log-message {
  color: #fca5a5;
  font-weight: 500;
}

.level-warn {
  background: rgba(245, 158, 11, 0.04);
}

.level-warn .log-message {
  color: #fde68a;
}

/* Footer */
.log-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 22px;
  background: #0a0f1d;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.footer-stats {
  font-size: 0.74rem;
  color: #64748b;
}

.btn-footer-close {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #f1f5f9;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-footer-close:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.3);
}

/* Telemetry Dashboard Styles */
.pill-telemetry {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.3);
  color: #6ee7b7;
}

.pill-telemetry:hover,
.pill-telemetry.active {
  background: rgba(16, 185, 129, 0.25);
  border-color: #34d399;
  color: #a7f3d0;
}

.telemetry-dashboard {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.telemetry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 10px;
}

.telemetry-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.telemetry-live-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 10px #10b981;
  animation: pulse-green 1.5s infinite;
}

@keyframes pulse-green {
  0% { transform: scale(0.9); opacity: 0.7; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.7; }
}

.telemetry-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #f1f5f9;
}

.telemetry-timestamp {
  font-size: 0.72rem;
  color: #64748b;
}

.telemetry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}

.telemetry-card {
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.telemetry-card:hover {
  border-color: rgba(56, 189, 248, 0.3);
  transform: translateY(-2px);
}

.telemetry-card.full-width {
  grid-column: 1 / -1;
}

.card-icon {
  font-size: 1.8rem;
  line-height: 1;
  flex-shrink: 0;
}

.card-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.card-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  margin-bottom: 4px;
}

.card-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #f8fafc;
  line-height: 1.2;
}

.card-value small {
  font-size: 0.75rem;
  font-weight: 500;
  color: #94a3b8;
}

.card-sub {
  font-size: 0.7rem;
  color: #64748b;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-success {
  border-color: rgba(34, 197, 94, 0.35);
  background: rgba(34, 197, 94, 0.05);
}

.card-warning {
  border-color: rgba(245, 158, 11, 0.4);
  background: rgba(245, 158, 11, 0.06);
}

.card-danger {
  border-color: rgba(239, 68, 68, 0.45);
  background: rgba(239, 68, 68, 0.08);
}

.load-metrics-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 0.8rem;
  color: #cbd5e1;
  margin-top: 6px;
}

.load-metrics-inline span strong {
  color: #38bdf8;
}
</style>
