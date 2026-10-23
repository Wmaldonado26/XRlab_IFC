import { computed } from 'vue';

import {
  formatFileSize,
  formatSpeed,
  formatRemainingTime,
} from '../../services/backend-client';

export type IfcUploadState =
  | 'IDLE'
  | 'SELECTED'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'ERROR'
  | 'CANCELLED';

export function useIfcUploadProgress<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(props: TProps) {
  

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

  return {
    computed,
    formatFileSize,
    formatSpeed,
    formatRemainingTime,
    isFrag,
    fileExtBadge,
    showBar,
    isIndeterminate,
    displayPercent,
    barFillStyle,
    formattedTotalSize,
    statusText,
    canCancelNow,
    transferDetails,
    formattedSpeed,
    formattedRemainingTime,
    stageMessage,
    cardStateClass,
    safeErrorMessage,
  };
}
