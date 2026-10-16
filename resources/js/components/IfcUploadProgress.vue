<template>
  <div v-if="state !== 'IDLE'" class="ifc-progress-wrapper" :class="cardStateClass">
    <div class="drop-progress">
      <div class="drop-icon">{{ isFrag ? '📦' : '◈' }}</div>
      <b class="file-title" :title="fileName">{{ fileName || (isFrag ? 'Archivo FRAG' : 'Archivo IFC') }}</b>
      <span v-if="formattedTotalSize" class="meta block-meta">
        {{ formattedTotalSize }} <span v-if="fileExtBadge">· {{ fileExtBadge }}</span>
      </span>

      <!-- Barra de progreso con estilo idéntico al prototipo -->
      <div v-if="showBar" class="progress">
        <div
          class="bar"
          :class="{ indeterminate: isIndeterminate }"
          :style="barFillStyle"
        ></div>
      </div>

      <!-- Métricas Fila 1: Estado + Porcentaje REAL -->
      <div v-if="showBar" class="pi">
        <span class="status-msg">{{ statusText }}</span>
        <b class="percent-val">{{ displayPercent }}%</b>
      </div>

      <!-- Métricas Fila 2: Bytes transferidos REALES + Velocidad / ETA -->
      <div v-if="showBar && (transferDetails || formattedSpeed || elapsedTime)" class="pi">
        <span>{{ transferDetails || elapsedTime || 'Procesando transferencia...' }}</span>
        <span>{{ formattedSpeed ? `${formattedSpeed}${formattedRemainingTime ? ' · ' + formattedRemainingTime : ''}` : '' }}</span>
      </div>

      <!-- Etapa / Banner informativo de procesamiento posterior -->
      <div v-if="stageMessage" class="stage-note">
        <span>ℹ️ {{ stageMessage }}</span>
      </div>

      <!-- Error banner -->
      <div v-if="state === 'ERROR' && errorMessage" class="error-note">
        <span>⚠️ {{ safeErrorMessage }}</span>
      </div>

      <!-- Acciones de control (Cancelar / Reintentar / Cambiar) -->
      <div class="actions-row">
        <button
          v-if="canCancelNow"
          type="button"
          class="btn-action btn-cancel"
          title="Cancelar transferencia"
          @click="$emit('cancel')"
        >
          ✕ Cancelar carga
        </button>

        <button
          v-if="state === 'ERROR'"
          type="button"
          class="btn-action btn-retry"
          title="Reintentar carga"
          @click="$emit('retry')"
        >
          🔄 Reintentar
        </button>

        <button
          v-if="(state === 'SELECTED' || state === 'CANCELLED' || state === 'ERROR') && allowChange"
          type="button"
          class="btn-action btn-change"
          title="Seleccionar otro archivo"
          @click="$emit('change-file')"
        >
          Cambiar archivo
        </button>
      </div>
    </div>

    <p class="sub-explain">
      {{ isFrag
        ? 'Carga directa de modelo binario optimizado sin necesidad de conversión.'
        : 'Después de la carga: el microservicio procesará el IFC en streaming 64-bit y generará el FRAG para visualización 3D.'
      }}
    </p>
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

const isFrag = computed(() => {
  return (props.fileName || '').toLowerCase().endsWith('.frag');
});

const fileExtBadge = computed(() => {
  const name = (props.fileName || '').toLowerCase();
  if (name.endsWith('.frag')) return 'Formato .FRAG';
  if (name.endsWith('.ifc')) return 'Formato .IFC';
  return '';
});

const showBar = computed(() => {
  return (
    props.state === 'UPLOADING' ||
    props.state === 'UPLOADED' ||
    props.state === 'PROCESSING' ||
    props.state === 'COMPLETED'
  );
});

const isIndeterminate = computed(() => {
  return (
    props.state === 'UPLOADED' ||
    (props.state === 'PROCESSING' && (!props.progressPercent || props.progressPercent <= 0))
  );
});

const displayPercent = computed(() => {
  if (props.state === 'COMPLETED') return 100;
  if (props.state === 'UPLOADED') return 100;
  const p = Math.round(props.progressPercent || 0);
  return Math.min(Math.max(p, 0), 100);
});

const barFillStyle = computed(() => {
  if (isIndeterminate.value) {
    return { width: '100%' };
  }
  const pct = displayPercent.value;
  return { width: `${Math.max(pct, 2)}%` };
});

const formattedTotalSize = computed(() => {
  const bytes = props.fileSize || props.totalBytes;
  return bytes > 0 ? formatFileSize(bytes) : '';
});

const statusText = computed(() => {
  switch (props.state) {
    case 'SELECTED':
      return 'Preparando carga...';
    case 'UPLOADING':
      return isFrag.value ? 'Subiendo FRAG...' : 'Subiendo IFC...';
    case 'UPLOADED':
      return isFrag.value ? 'Archivo recibido. Guardando modelo...' : 'IFC recibido. Preparando conversión...';
    case 'PROCESSING':
      return props.stageText || (isFrag.value ? 'Guardando y registrando modelo en proyecto...' : 'Procesando IFC / Convirtiendo...');
    case 'COMPLETED':
      return isFrag.value ? '✓ Modelo registrado correctamente' : '✓ IFC procesado y modelo listo';
    case 'ERROR':
      return 'Error de carga';
    case 'CANCELLED':
      return 'Carga cancelada';
    default:
      return '';
  }
});

const canCancelNow = computed(() => {
  return props.state === 'UPLOADING' || props.state === 'PROCESSING';
});

const transferDetails = computed(() => {
  if (props.loadedBytes > 0 && props.totalBytes > 0) {
    return `${formatFileSize(props.loadedBytes)} / ${formatFileSize(props.totalBytes)}`;
  }
  return '';
});

const formattedSpeed = computed(() => {
  return props.speedBytesPerSec > 0 ? formatSpeed(props.speedBytesPerSec) : '';
});

const formattedRemainingTime = computed(() => {
  return props.remainingSec > 0 ? formatRemainingTime(props.remainingSec) : '';
});

const stageMessage = computed(() => {
  if (props.state === 'PROCESSING' && props.stageText) {
    return props.stageText;
  }
  return '';
});

const cardStateClass = computed(() => {
  switch (props.state) {
    case 'UPLOADING':
      return 'state-uploading';
    case 'PROCESSING':
      return 'state-processing';
    case 'COMPLETED':
      return 'state-completed';
    case 'ERROR':
      return 'state-error';
    case 'CANCELLED':
      return 'state-cancelled';
    default:
      return 'state-idle';
  }
});

const safeErrorMessage = computed(() => {
  if (!props.errorMessage) return 'Ocurrió un error durante la carga del archivo.';
  let msg = props.errorMessage;
  msg = msg.replace(/^[A-Za-z]+Error:\s*/, '');
  msg = msg.replace(/\bat\s+.*/s, '');
  if (msg.length > 180) {
    msg = msg.substring(0, 180) + '...';
  }
  return msg;
});
</script>

<style scoped>
.ifc-progress-wrapper {
  margin: 12px 0 16px 0;
}

/* DROPZONE IDÉNTICA AL PROTOTIPO */
.drop-progress {
  border: 1.5px dashed #b6c2d9;
  background: #f8faff;
  padding: 24px 20px;
  text-align: center;
  border-radius: 13px;
  transition: all 0.2s ease;
}

.state-completed .drop-progress {
  border-color: #10b981;
  background: #f0fdf4;
}

.state-processing .drop-progress {
  border-color: #f59e0b;
  background: #fffbeb;
}

.state-error .drop-progress {
  border-color: #ef4444;
  background: #fef2f2;
}

.drop-icon {
  font-size: 28px;
  color: var(--b, #234BA1);
  margin-bottom: 6px;
}

.state-completed .drop-icon {
  color: #10b981;
}

.file-title {
  display: block;
  font-size: 14.5px;
  font-weight: 700;
  color: #172033;
  word-break: break-all;
}

.block-meta {
  display: block;
  margin-top: 3px;
}

.meta {
  font-size: 12px;
  color: #778399;
}

/* BARRA DE PROGRESO IDÉNTICA AL PROTOTIPO */
.progress {
  height: 9px;
  background: #e8edf5;
  border-radius: 10px;
  margin-top: 18px;
  overflow: hidden;
  position: relative;
}

.bar {
  height: 100%;
  background: var(--b, #234BA1);
  border-radius: 10px;
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.bar.indeterminate {
  width: 40% !important;
  animation: indeterminateSlide 1.4s infinite ease-in-out;
}

@keyframes indeterminateSlide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}

.state-completed .bar {
  background: #10b981;
}

.state-processing .bar {
  background: #d97706;
}

.state-error .bar {
  background: #ef4444;
}

/* FILAS DE MÉTRICAS (.pi) IDÉNTICAS AL PROTOTIPO */
.pi {
  display: flex;
  justify-content: space-between;
  color: #778399;
  font-size: 11px;
  margin-top: 7px;
}

.percent-val {
  color: var(--b, #234BA1);
  font-size: 11.5px;
}

.status-msg {
  color: #172033;
  font-weight: 500;
}

.stage-note {
  margin-top: 10px;
  font-size: 11px;
  color: #475569;
  background: rgba(35, 75, 161, 0.06);
  padding: 6px 10px;
  border-radius: 6px;
  text-align: left;
}

.error-note {
  margin-top: 10px;
  font-size: 11px;
  color: #b91c1c;
  background: #fee2e2;
  padding: 6px 10px;
  border-radius: 6px;
  text-align: left;
}

.actions-row {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}

.btn-action {
  border: 1px solid #d7dce6;
  background: #ffffff;
  border-radius: 7px;
  padding: 5px 11px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  color: #475569;
  transition: all 0.12s;
}

.btn-action:hover {
  background: #f1f5f9;
  color: #172033;
}

.btn-cancel:hover {
  color: #dc2626;
  border-color: #f87171;
}

.sub-explain {
  color: #778399;
  font-size: 12px;
  margin: 10px 0 0;
  line-height: 1.45;
}
</style>
