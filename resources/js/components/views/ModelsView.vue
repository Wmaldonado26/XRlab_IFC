<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  fetchBackendModels,
  fetchBackendProjects,
  uploadDirectFrag,
  convertIfcViaBackend,
  type BackendModelItem,
  type BackendProject,
} from '../../services/backend-client';
import IfcUploadProgress, { type IfcUploadState } from '../IfcUploadProgress.vue';

const emit = defineEmits<{
  (e: 'open-project', project: BackendProject): void;
  (e: 'show-toast', message: string): void;
}>();

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
          selectedProjectId.value
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
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Modelos BIM</h1>
        <p>Archivos IFC y FRAG registrados en la plataforma.</p>
      </div>
      <button class="primary-btn" @click="isUploadModalOpen = true">
        ↑ Cargar modelo
      </button>
    </div>

    <div v-if="isLoading" class="panel" style="padding: 40px; text-align: center; color: var(--muted)">
      Cargando modelos BIM...
    </div>

    <div v-else-if="models.length === 0" class="panel" style="padding: 50px; text-align: center">
      <div style="font-size: 32px; margin-bottom: 12px">◇</div>
      <h3 style="margin: 0 0 8px; color: var(--text)">No hay modelos registrados</h3>
      <p style="color: var(--muted); font-size: 13px; margin: 0 0 20px">
        Comienza cargando un modelo IFC o FRAG en cualquiera de tus proyectos activos.
      </p>
      <button class="primary-btn" @click="isUploadModalOpen = true">+ Cargar primer modelo</button>
    </div>

    <div v-else class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>Modelo</th>
            <th>Proyecto</th>
            <th>Formato</th>
            <th>Tamaño</th>
            <th>Estado</th>
            <th>Última actualización</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in models" :key="m.id">
            <td>
              <b>{{ m.name }}</b>
              <br>
              <small style="color: #8996aa">ID: {{ m.id.substring(0, 12) }}</small>
            </td>
            <td>{{ m.projectName || 'Proyecto ' + m.projectId.substring(0, 8) }}</td>
            <td>
              <span class="badge" style="background: #eef3f8; color: var(--blue); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 10px">
                {{ getFormat(m.name) }}
              </span>
            </td>
            <td>{{ m.sizeFormatted || '—' }}</td>
            <td>
              <span v-if="m.status === 'ready'" class="status ok">Disponible</span>
              <span v-else-if="m.status === 'processing'" class="status warn">Procesando</span>
              <span v-else class="status err">Error</span>
            </td>
            <td>{{ formatDate(m.updatedAt || m.createdAt) }}</td>
            <td style="text-align: right">
              <button class="secondary-btn" style="padding: 6px 12px; font-size: 11px" @click="openModelInViewer(m)">
                Abrir en Visor
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL CARGAR MODELO BIM -->
    <div v-if="isUploadModalOpen" class="modal-backdrop open" @click.self="isUploadModalOpen = false">
      <div class="modal">
        <div class="modal-head">
          <h3>Cargar modelo BIM</h3>
          <button class="close" @click="isUploadModalOpen = false">×</button>
        </div>
        <div class="modal-body">
          <div
            class="upload-zone"
            @click="fileInputRef?.click()"
            style="cursor: pointer"
          >
            <div class="big">◇</div>
            <strong v-if="selectedFiles.length === 0">Selecciona uno o varios archivos IFC o FRAG</strong>
            <strong v-else-if="selectedFiles.length === 1" style="color: var(--blue)">{{ selectedFiles[0].name }} ({{ (selectedFiles[0].size / (1024 * 1024)).toFixed(2) }} MB)</strong>
            <strong v-else style="color: var(--blue)">{{ selectedFiles.length }} archivos seleccionados ({{ selectedTotalSizeMB }} MB)</strong>
            <span>Los archivos se procesan de forma controlada en el backend.</span>
            <input
              ref="fileInputRef"
              type="file"
              accept=".ifc,.frag"
              multiple
              style="display: none"
              @change="onFileSelected"
            >
          </div>

          <div style="margin-top: 18px">
            <label style="font-size: 11px; font-weight: 800; display: block; margin-bottom: 6px">
              Proyecto destino
            </label>
            <select v-model="selectedProjectId" style="width: 100%">
              <option v-for="p in projects" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>
          </div>

          <!-- Barra de progreso real si está subiendo -->
          <div v-if="isUploading" style="margin-top: 20px">
            <IfcUploadProgress
              :state="uploadState"
              :file-name="currentUploadingFileName"
              :progress-percent="uploadProgress"
              :stage-text="uploadStage"
              :error-message="uploadError"
            />
          </div>
        </div>
        <div class="modal-foot">
          <button class="secondary-btn" :disabled="isUploading" @click="isUploadModalOpen = false">
            Cancelar
          </button>
          <button class="primary-btn" :disabled="isUploading || selectedFiles.length === 0" @click="handleStartUpload">
            Iniciar carga
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
