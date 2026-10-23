<script setup lang="ts">
import type { IfcUploadState } from './IfcUploadProgress.logic';
import { useIfcUploadProgress } from './IfcUploadProgress.logic';
const props = withDefaults(defineProps<{
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
}>(), {
  fileName: '', fileSize: 0, progressPercent: 0, loadedBytes: 0, totalBytes: 0,
  speedBytesPerSec: 0, remainingSec: 0, stageText: '', elapsedTime: '', errorMessage: '', allowChange: true,
});
defineEmits(["cancel", "change-file", "retry"]);
const { computed, formatFileSize, formatSpeed, formatRemainingTime, isFrag, fileExtBadge, showBar, isIndeterminate, displayPercent, barFillStyle, formattedTotalSize, statusText, canCancelNow, transferDetails, formattedSpeed, formattedRemainingTime, stageMessage, cardStateClass, safeErrorMessage } = useIfcUploadProgress(props);
</script>

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
<style scoped src="./IfcUploadProgress.css"></style>




