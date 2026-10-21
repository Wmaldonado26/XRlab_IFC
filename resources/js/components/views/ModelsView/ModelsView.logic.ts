import { ref, computed, onMounted } from 'vue';

import {
  fetchBackendModels,
  fetchBackendProjects,
  uploadDirectFrag,
  convertIfcViaBackend,
  type BackendModelItem,
  type BackendProject,
} from '../../../services/backend-client';

import IfcUploadProgress from '../../IfcUploadProgress/IfcUploadProgress.vue';
import type { IfcUploadState } from '../../IfcUploadProgress/IfcUploadProgress.logic';

export function useModelsView<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(emit: (...args: any[]) => any) {
  const models = ref<BackendModelItem[]>([]);

  const projects = ref<BackendProject[]>([]);

  const isLoading = ref(true);

  const searchQuery = ref('');

  const isUploadModalOpen = ref(false);

  const selectedProjectId = ref('');

  const selectedFiles = ref<File[]>([]);

  const selectedFile = computed(() => selectedFiles.value[0] || null);

  const selectedTotalSizeMB = computed(() => {
    const bytes = selectedFiles.value.reduce((acc, f) => acc + f.size, 0);
    return (bytes / (1024 * 1024)).toFixed(2);
  });

  const fileInputRef = ref<HTMLInputElement | null>(null);

  // Upload progress tracking
  const isUploading = ref(false);

  const uploadPhase = ref<'uploading' | 'processing' | 'converting' | 'completed' | 'error'>('uploading');

  const uploadProgress = ref(0);

  const uploadStage = ref('');

  const uploadSpeed = ref('');

  const uploadRemaining = ref('');

  const uploadError = ref('');

  const currentUploadingFileName = ref('');

  const uploadState = computed<IfcUploadState>(() => {
    if (uploadError.value) return 'ERROR';
    if (uploadPhase.value === 'completed') return 'COMPLETED';
    if (uploadPhase.value === 'processing' || uploadPhase.value === 'converting') return 'PROCESSING';
    if (isUploading.value) return 'UPLOADING';
    return 'IDLE';
  });

  async function loadData() {
    isLoading.value = true;
    try {
      const [fetchedModels, fetchedProjects] = await Promise.all([
        fetchBackendModels(),
        fetchBackendProjects(),
      ]);
      models.value = fetchedModels;
      projects.value = fetchedProjects;
      if (projects.value.length > 0 && !selectedProjectId.value) {
        selectedProjectId.value = projects.value[0].id;
      }
    } catch (err: any) {
      console.error('Error cargando modelos:', err);
    } finally {
      isLoading.value = false;
    }
  }

  function getFormat(name: string): string {
    if (name.toLowerCase().endsWith('.frag')) return 'FRAG';
    if (name.toLowerCase().endsWith('.ifc')) return 'IFC';
    return 'BIM';
  }

  function formatDate(ts: number): string {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function openModelInViewer(model: BackendModelItem) {
    const proj = projects.value.find((p) => p.id === model.projectId);
    if (proj) {
      emit('open-project', proj);
    } else {
      emit('show-toast', `Abriendo proyecto ${model.projectName || model.projectId}...`);
      // Fallback if not found locally, load and emit
      emit('open-project', {
        id: model.projectId,
        name: model.projectName || 'Proyecto BIM',
        fileName: model.name,
        description: null,
        createdAt: model.createdAt,
        modelsCount: 1,
        models: [model],
        parts: [model.name],
        fileSize: model.sizeBytes,
        totalPartsSizeMB: model.sizeFormatted,
      });
    }
  }

  function onFileSelected(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      selectedFiles.value = Array.from(target.files);
    }
  }

  async function handleStartUpload() {
    if (selectedFiles.value.length === 0) {
      emit('show-toast', 'Por favor selecciona al menos un archivo (.ifc o .frag)');
      return;
    }
    if (!selectedProjectId.value) {
      emit('show-toast', 'Por favor selecciona el proyecto destino');
      return;
    }
  
    isUploading.value = true;
    uploadError.value = '';
  
    try {
      for (let i = 0; i < selectedFiles.value.length; i++) {
        const file = selectedFiles.value[i];
        currentUploadingFileName.value = file.name;
        const prefix = selectedFiles.value.length > 1 ? `[${i + 1}/${selectedFiles.value.length}] ` : '';
        const isFrag = file.name.toLowerCase().endsWith('.frag');
        uploadProgress.value = 0;
        uploadStage.value = `${prefix}Iniciando subida de ${file.name}...`;
  
        if (isFrag) {
          await uploadDirectFrag(selectedProjectId.value, file, (p: any) => {
            uploadProgress.value = typeof p === 'number' ? p : p.percent;
            uploadStage.value = `${prefix}${p.stage || 'Subiendo archivo...'}`;
            uploadPhase.value = p.phase === 'completed' ? 'completed' : 'uploading';
          });
        } else {
          await convertIfcViaBackend(
            file,
            (p) => {
              uploadProgress.value = p.percent;
              uploadStage.value = `${prefix}${p.stage || 'Procesando IFC...'}`;
              if (p.phase === 'processing') uploadPhase.value = 'processing';
              else if (p.phase === 'completed') uploadPhase.value = 'completed';
              else uploadPhase.value = 'uploading';
            },
            selectedProjectId.value,
            undefined,
            { downloadResult: false }
          );
        }
      }
  
      emit('show-toast', `${selectedFiles.value.length} modelo(s) subido(s) exitosamente`);
      isUploadModalOpen.value = false;
      selectedFiles.value = [];
      isUploading.value = false;
      await loadData();
    } catch (err: any) {
      console.error('Error al subir modelo(s):', err);
      uploadError.value = err.message || 'Error desconocido';
      uploadPhase.value = 'error';
      emit('show-toast', `Fallo al procesar: ${err.message || 'Error desconocido'}`);
    } finally {
      isUploading.value = false;
    }
  }

  onMounted(() => {
    loadData();
  });

  return {
    ref,
    computed,
    onMounted,
    fetchBackendModels,
    fetchBackendProjects,
    uploadDirectFrag,
    convertIfcViaBackend,
    IfcUploadProgress,
    models,
    projects,
    isLoading,
    searchQuery,
    isUploadModalOpen,
    selectedProjectId,
    selectedFiles,
    selectedFile,
    selectedTotalSizeMB,
    fileInputRef,
    isUploading,
    uploadPhase,
    uploadProgress,
    uploadStage,
    uploadSpeed,
    uploadRemaining,
    uploadError,
    currentUploadingFileName,
    uploadState,
    loadData,
    getFormat,
    formatDate,
    openModelInViewer,
    onFileSelected,
    handleStartUpload,
  };
}
