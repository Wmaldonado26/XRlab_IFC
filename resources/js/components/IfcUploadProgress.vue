<template>
  <div v-if="state !== 'IDLE'" class="ifc-progress-card" :class="cardStateClass">
    <!-- Encabezado con información del archivo -->
    <div class="progress-file-header">
      <div class="file-icon-wrap">
        <span class="file-glyph">{{ fileGlyph }}</span>
      </div>
      <div class="file-info-block">
        <div class="file-title-row">
          <span class="file-name" :title="fileName">{{ fileName || 'Archivo IFC' }}</span>
          <span v-if="formattedTotalSize" class="file-size-badge">{{ formattedTotalSize }}</span>
        </div>
        <div class="file-status-row">
          <span class="status-indicator" :class="statusIndicatorClass"></span>
          <span class="status-text">{{ statusText }}</span>
        </div>
      </div>

      <!-- Acciones rápidas (Cancelar / Reintentar / Cambiar) -->
      <div class="header-action-wrap">
        <button
          v-if="canCancelNow"
          type="button"
          class="btn-progress-action btn-cancel-action"
          title="Cancelar transferencia"
          @click="$emit('cancel')"
        >
          ✕ Cancelar
        </button>

        <button
          v-if="state === 'ERROR'"
          type="button"
          class="btn-progress-action btn-retry-action"
          title="Reintentar carga"
          @click="$emit('retry')"
        >
          🔄 Reintentar
        </button>

        <button
          v-if="(state === 'SELECTED' || state === 'CANCELLED' || state === 'ERROR') && allowChange"
          type="button"
          class="btn-progress-action btn-change-action"
          title="Seleccionar otro archivo"
          @click="$emit('change-file')"
        >
          Cambiar
        </button>
      </div>
    </div>

    <!-- Barra de progreso real (solo visible cuando hay actividad de carga o proceso) -->
    <div v-if="showBar" class="progress-bar-section">
      <div class="bar-track">
        <div
          class="bar-fill"
          :class="{ indeterminate: isIndeterminate }"
          :style="barFillStyle"
        ></div>
      </div>
      <div class="bar-metrics-row">
        <!-- Porcentaje real -->
        <span class="percent-label">
          {{ displayPercent }}%
        </span>

        <!-- Progreso numérico de bytes transferidos -->
        <span v-if="state === 'UPLOADING' && transferDetails" class="transfer-details">
          {{ transferDetails }}
        </span>

        <!-- Velocidad de transferencia -->
        <span v-if="state === 'UPLOADING' && formattedSpeed" class="speed-label">
          ⚡ {{ formattedSpeed }}
        </span>

        <!-- Tiempo restante estimado -->
        <span v-if="state === 'UPLOADING' && formattedRemainingTime" class="eta-label">
          ⏱️ {{ formattedRemainingTime }}
        </span>

        <!-- Tiempo transcurrido durante procesamiento backend -->
        <span v-if="state === 'PROCESSING' && elapsedTime" class="elapsed-label">
          ⏱️ {{ elapsedTime }}
        </span>
      </div>
    </div>

    <!-- Etapa de procesamiento / Mensaje de estado extendido -->
    <div v-if="stageMessage" class="stage-info-banner">
      <span class="stage-bullet">ℹ️</span>
      <span class="stage-text">{{ stageMessage }}</span>
    </div>

    <!-- Mensaje de error amigable (sin stack traces técnicos) -->
    <div v-if="state === 'ERROR' && errorMessage" class="error-info-banner">
      <span class="error-bullet">⚠️</span>
      <span class="error-text">{{ safeErrorMessage }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  formatFileSize,
  formatSpeed,
  formatRemainingTime,
} from '../services/backend-client';

export type IfcUploadState =
  | 'IDLE'
  | 'SELECTED'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'ERROR'
  | 'CANCELLED';

const props = withDefaults(
  defineProps<{
    state: IfcUploadState;
    fileName?: string;
    fileSize?: number;
    progressPercent?: number;
    loadedBytes?: number;
    totalBytes?: number;
    speedBytesPerSec?: number;
    remainingSec?: number;
    stageText?: string;
    elapsedTime?: string;
    errorMessage?: string;
    allowChange?: boolean;
  }>(),
  {
    state: 'IDLE',
    fileName: '',
    fileSize: 0,
    progressPercent: 0,
    loadedBytes: 0,
    totalBytes: 0,
    speedBytesPerSec: 0,
    remainingSec: 0,
    stageText: '',
    elapsedTime: '',
    errorMessage: '',
    allowChange: true,
  }
);

defineEmits<{
  (e: 'cancel'): void;
  (e: 'retry'): void;
  (e: 'change-file'): void;
}>();

// Formato de tamaño total
const formattedTotalSize = computed(() => {
  const bytes = props.fileSize || props.totalBytes;
  return bytes > 0 ? formatFileSize(bytes) : '';
});

// Detalles de transferencia (e.g. "2.72 GB / 3.58 GB")
const transferDetails = computed(() => {
  if (props.loadedBytes > 0 && props.totalBytes > 0) {
    return `${formatFileSize(props.loadedBytes)} / ${formatFileSize(props.totalBytes)}`;
  }
  return '';
});

// Formato de velocidad (solo si es confiable)
const formattedSpeed = computed(() => {
  if (props.speedBytesPerSec && props.speedBytesPerSec > 1024) {
    return formatSpeed(props.speedBytesPerSec);
  }
  return '';
});

// Formato de tiempo restante (solo si es confiable)
const formattedRemainingTime = computed(() => {
  if (props.remainingSec && props.remainingSec > 0 && isFinite(props.remainingSec)) {
    return formatRemainingTime(props.remainingSec);
  }
  return '';
});

// Porcentaje mostrado
const displayPercent = computed(() => {
  if (props.state === 'SELECTED' || props.state === 'IDLE') return 0;
  if (props.state === 'UPLOADED') return 100;
  if (props.state === 'COMPLETED') return 100;
  return Math.max(0, Math.min(100, Math.round(props.progressPercent || 0)));
});

// Determinar si la barra debe mostrarse
const showBar = computed(() => {
  return ['UPLOADING', 'UPLOADED', 'PROCESSING', 'COMPLETED'].includes(props.state);
});

// Estado indeterminado durante transición de procesamiento si percent es 0
const isIndeterminate = computed(() => {
  return props.state === 'PROCESSING' && (props.progressPercent === 0 || props.progressPercent === undefined);
});

// Estilo de la barra de llenado
const barFillStyle = computed(() => {
  if (isIndeterminate.value) {
    return { width: '30%' };
  }
  const pct = Math.max(displayPercent.value, props.state === 'UPLOADING' ? 1 : 0);
  return { width: `${pct}%` };
});

// Glifo de icono según estado
const fileGlyph = computed(() => {
  switch (props.state) {
    case 'COMPLETED':
      return '✓';
    case 'ERROR':
      return '⚠️';
    case 'CANCELLED':
      return '✕';
    case 'PROCESSING':
      return '⚙️';
    case 'UPLOADING':
    case 'UPLOADED':
      return '📤';
    default:
      return '📄';
  }
});

// Texto descriptivo del estado actual
const statusText = computed(() => {
  switch (props.state) {
    case 'SELECTED':
      return 'Archivo seleccionado. Listo para iniciar la carga.';
    case 'UPLOADING':
      return 'Subiendo archivo...';
    case 'UPLOADED':
      return 'Archivo recibido ✓';
    case 'PROCESSING':
      return props.stageText || 'Procesando modelo IFC...';
    case 'COMPLETED':
      return 'Proceso terminado correctamente. Modelo listo ✓';
    case 'ERROR':
      return 'No se pudo cargar el archivo.';
    case 'CANCELLED':
      return 'Carga cancelada.';
    default:
      return '';
  }
});

// Clases CSS según estado
const cardStateClass = computed(() => {
  return `state-${props.state.toLowerCase()}`;
});

const statusIndicatorClass = computed(() => {
  switch (props.state) {
    case 'SELECTED':
      return 'indicator-selected';
    case 'UPLOADING':
      return 'indicator-uploading';
    case 'UPLOADED':
      return 'indicator-uploaded';
    case 'PROCESSING':
      return 'indicator-processing';
    case 'COMPLETED':
      return 'indicator-completed';
    case 'ERROR':
      return 'indicator-error';
    case 'CANCELLED':
      return 'indicator-cancelled';
    default:
      return '';
  }
});

// Se permite cancelar si está subiendo o procesando
const canCancelNow = computed(() => {
  return props.state === 'UPLOADING' || props.state === 'PROCESSING';
});

// Mensaje de etapa durante procesamiento posterior
const stageMessage = computed(() => {
  if (props.state === 'PROCESSING' && props.stageText) {
    return props.stageText;
  }
  if (props.state === 'UPLOADED') {
    return 'Archivo guardado en el servidor. Iniciando conversión a fragmentos (.frag)...';
  }
  return '';
});

// Limpieza de mensajes de error técnicos
const safeErrorMessage = computed(() => {
  if (!props.errorMessage) return 'Ocurrió un error durante la carga del archivo.';
  let msg = props.errorMessage;
  // Filtrar posibles trazas o clases de error
  msg = msg.replace(/^[A-Za-z]+Error:\s*/, '');
  msg = msg.replace(/\bat\s+.*/s, '');
  if (msg.length > 180) {
    msg = msg.substring(0, 180) + '...';
  }
  return msg;
});
</script>

<style scoped>
.ifc-progress-card {
  background: #0f172a;
  border: 1px solid rgba(35, 75, 161, 0.45);
  border-radius: 10px;
  padding: 14px 16px;
  margin: 12px 0 16px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.2s ease;
}

.ifc-progress-card.state-error {
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(30, 20, 20, 0.85);
}

.ifc-progress-card.state-completed {
  border-color: rgba(16, 185, 129, 0.4);
}

.ifc-progress-card.state-cancelled {
  border-color: rgba(100, 116, 139, 0.3);
}

/* Header */
.progress-file-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-icon-wrap {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #1e293b;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.file-glyph {
  font-size: 1.15rem;
}

.file-info-block {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name {
  color: #f8fafc;
  font-size: 0.88rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 320px;
}

.file-size-badge {
  background: #1e293b;
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.file-status-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-indicator {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.indicator-selected {
  background: #64748b;
}

.indicator-uploading {
  background: #234BA1;
  box-shadow: 0 0 6px rgba(35, 75, 161, 0.8);
  animation: pulse-dot 1.4s infinite;
}

.indicator-uploaded {
  background: #38bdf8;
}

.indicator-processing {
  background: #f59e0b;
  animation: pulse-dot 1.2s infinite;
}

.indicator-completed {
  background: #10b981;
}

.indicator-error {
  background: #ef4444;
}

.indicator-cancelled {
  background: #64748b;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.status-text {
  font-size: 0.78rem;
  color: #cbd5e1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Acciones en header */
.header-action-wrap {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.btn-progress-action {
  font-size: 0.74rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.btn-cancel-action {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.btn-cancel-action:hover {
  background: rgba(239, 68, 68, 0.22);
}

.btn-retry-action {
  background: rgba(35, 75, 161, 0.25);
  border-color: #234BA1;
  color: #93c5fd;
}

.btn-retry-action:hover {
  background: #234BA1;
  color: #ffffff;
}

.btn-change-action {
  background: #1e293b;
  border-color: rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
}

.btn-change-action:hover {
  background: #334155;
  color: #ffffff;
}

/* Barra de progreso */
.progress-bar-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bar-track {
  width: 100%;
  height: 8px;
  background: #1e293b;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

/* Color principal estricto: #234BA1 - SIN gradientes */
.bar-fill {
  height: 100%;
  background: #234BA1;
  border-radius: 4px;
  transition: width 0.2s linear;
}

.bar-fill.indeterminate {
  animation: bar-slide 1.6s infinite ease-in-out;
}

@keyframes bar-slide {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(120%); }
  100% { transform: translateX(300%); }
}

.bar-metrics-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.74rem;
  color: #94a3b8;
  flex-wrap: wrap;
}

.percent-label {
  font-weight: 700;
  color: #f8fafc;
  font-family: monospace;
  font-size: 0.8rem;
}

.transfer-details {
  font-family: monospace;
  color: #cbd5e1;
}

.speed-label {
  color: #93c5fd;
  font-family: monospace;
}

.eta-label, .elapsed-label {
  color: #94a3b8;
}

/* Banners informativos de etapa y error */
.stage-info-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(35, 75, 161, 0.12);
  border: 1px solid rgba(35, 75, 161, 0.3);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.75rem;
  color: #bfdbfe;
}

.stage-bullet {
  font-size: 0.85rem;
}

.stage-text {
  flex: 1;
  line-height: 1.35;
}

.error-info-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.75rem;
  color: #fca5a5;
}

.error-bullet {
  font-size: 0.85rem;
}

.error-text {
  flex: 1;
  line-height: 1.35;
}
</style>
