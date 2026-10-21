<script setup lang="ts">
import { useErrorLogModal } from './ErrorLogModal.logic';
const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits(["update:modelValue"]);
const { ref, computed, onMounted, onUnmounted, nextTick, watch, appLogger, viewerDiagnostics, allLogs, currentFilter, searchQuery, isCopied, terminalBodyRef, telemetrySnapshot, unsubscribe, diagUnsubscribe, pollTimer, syncLogs, refreshLogs, clearLogs, copyLogs, close, errorCount, warnCount, backendCount, frontendCount, filteredLogs } = useErrorLogModal(props, emit);
</script>

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

<style scoped src="./ErrorLogModal.css"></style>


