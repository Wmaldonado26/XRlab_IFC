<template>
  <div class="page">
    <!-- Page Header -->
    <div class="page-head">
      <div>
        <h1>Proyectos</h1>
        <p>Gestiona los proyectos y sus modelos BIM asociados.</p>
      </div>
      <button
        v-if="isAdmin"
        type="button"
        class="primary-btn"
        @click="openCreateModal"
      >
        + Nuevo proyecto
      </button>
    </div>

    <!-- Filters Toolbar -->
    <div class="filters">
      <input
        v-model="searchQuery"
        class="search"
        placeholder="⌕  Buscar proyecto..."
        @input="onSearchInput"
      />
      <select v-model="statusFilter" style="max-width: 180px;">
        <option value="all">Todos los estados</option>
        <option value="active">Con modelos activos</option>
        <option value="empty">Sin modelos</option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" style="padding: 40px; text-align: center; color: var(--muted);">
      Cargando proyectos desde el servidor...
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredProjects.length === 0" style="padding: 40px; text-align: center; color: var(--muted); background: #ffffff; border-radius: var(--radius); border: 1px solid var(--line);">
      <div style="font-size: 32px; margin-bottom: 8px;">⚓</div>
      <b style="color: var(--navy); font-size: 15px;">No se encontraron proyectos</b>
      <p style="margin-top: 4px; font-size: 13px;">{{ searchQuery ? 'Prueba con otros términos de búsqueda.' : 'Crea tu primer proyecto para comenzar a visualizar modelos BIM.' }}</p>
    </div>

    <!-- Projects Grid Cards -->
    <div v-else class="cards">
      <article
        v-for="(proj, index) in filteredProjects"
        :key="proj.id"
        class="project-card"
      >
        <div class="project-cover" :style="{ background: getCoverGradient(index) }">
          <span class="badge">
            {{ (proj.modelsCount > 0 || (proj.parts && proj.parts.length > 0)) ? 'PROYECTO ACTIVO' : 'SIN MODELOS' }}
          </span>
        </div>

        <div class="project-body">
          <h3 :title="proj.name">{{ proj.name }}</h3>
          <p :title="proj.description || ''">
            {{ proj.description ? truncate(proj.description, 90) : 'Modelo digital para seguimiento de construcción naval y revisión en campo.' }}
          </p>

          <div class="project-meta">
            <span>{{ proj.modelsCount || (proj.parts ? proj.parts.length : 0) }} modelos</span>
            <span>{{ proj.totalPartsSizeMB ? `${proj.totalPartsSizeMB} MB` : 'Listo' }}</span>
          </div>

          <div class="project-actions">
            <button
              type="button"
              class="secondary-btn"
              :disabled="!(proj.modelsCount > 0 || (proj.parts && proj.parts.length > 0))"
              :title="!(proj.modelsCount > 0 || (proj.parts && proj.parts.length > 0)) ? 'Carga primero un modelo para abrir el visor' : 'Abrir visor 3D'"
              @click="$emit('open-project', proj)"
            >
              Abrir visor
            </button>
            <button
              v-if="isAdmin"
              type="button"
              class="primary-btn"
              @click="openManageModal(proj)"
            >
              Gestionar
            </button>
          </div>
        </div>
      </article>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL: CREAR PROYECTO (Exacto al prototipo con Carga Real Integrada)-->
    <!-- =================================================================== -->
    <div
      class="modal-backdrop"
      :class="{ open: showCreateModal }"
      @click.self="createModelState !== 'UPLOADING' && !isSubmitting ? (showCreateModal = false) : null"
    >
      <div class="modal">
        <div class="modal-head">
          <h3>Crear nuevo proyecto</h3>
          <button
            type="button"
            class="close"
            :disabled="createModelState === 'UPLOADING' || isSubmitting"
            @click="showCreateModal = false"
          >
            ×
          </button>
        </div>

        <form @submit.prevent="submitCreateProject">
          <div class="modal-body">
            <div class="form-group">
              <label>Nombre del proyecto *</label>
              <input
                v-model="createForm.name"
                placeholder="Ej. Patrullera OPV"
                required
                :disabled="createModelState === 'UPLOADING' || isSubmitting"
              />
            </div>

            <div class="form-group">
              <label>Descripción</label>
              <textarea
                v-model="createForm.description"
                rows="3"
                placeholder="Detalles del buque, estructura o coordinación..."
                :disabled="createModelState === 'UPLOADING' || isSubmitting"
              ></textarea>
            </div>

            <div class="form-group">
              <label>Archivo del modelo inicial (IFC o FRAG)</label>
              <div
                v-if="createModelState === 'IDLE'"
                class="upload-zone"
                @click="fileInputRef?.click()"
              >
                <div class="big">↑</div>
                <strong>Cargar modelo inicial</strong>
                <span>Archivos .ifc (con conversión) o .frag (carga directa optimizada)</span>
                <input
                  ref="fileInputRef"
                  type="file"
                  accept=".ifc,.frag"
                  style="display: none;"
                  @change="onFileSelected"
                />
              </div>

              <!-- Real Upload Progress Bar Integration -->
              <IfcUploadProgress
                v-else
                :state="createModelState"
                :file-name="createFile?.name"
                :file-size="createFile?.size"
                :progress-percent="createProgress.percent"
                :loaded-bytes="createProgress.loadedBytes"
                :total-bytes="createProgress.totalBytes"
                :speed-bytes-per-sec="createProgress.speedBytesPerSec"
                :remaining-sec="createProgress.remainingSec"
                :stage-text="createProgress.stage"
                :error-message="createError"
                @cancel="cancelUpload"
                @retry="submitCreateProject"
                @change-file="fileInputRef?.click()"
              />
            </div>
          </div>

          <div class="modal-foot">
            <button
              type="button"
              class="secondary-btn"
              :disabled="createModelState === 'UPLOADING' || isSubmitting"
              @click="showCreateModal = false"
            >
              Cancelar
            </button>

            <button
              v-if="createModelState === 'COMPLETED' && createdProject"
              type="button"
              class="primary-btn"
              @click="$emit('open-project', createdProject); showCreateModal = false;"
            >
              ⚡ Abrir visor
            </button>

            <button
              v-else
              type="submit"
              class="primary-btn"
              :disabled="!createForm.name.trim() || isSubmitting || createModelState === 'UPLOADING'"
            >
              <span v-if="isSubmitting || createModelState === 'UPLOADING'">Procesando...</span>
              <span v-else>{{ createFile ? 'Crear proyecto y cargar archivo' : 'Crear proyecto' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL: GESTIONAR PROYECTO (Edición y Eliminación Segura)            -->
    <!-- =================================================================== -->
    <div
      class="modal-backdrop"
      :class="{ open: showManageModal && Boolean(manageProjectTarget) }"
      @click.self="!isSubmitting ? (showManageModal = false) : null"
    >
      <div class="modal">
        <div class="modal-head">
          <h3>Gestionar proyecto</h3>
          <button type="button" class="close" @click="showManageModal = false">×</button>
        </div>

        <div v-if="manageProjectTarget" class="modal-body">
          <div class="form-group">
            <label>Nombre del proyecto</label>
            <input v-model="editForm.name" required />
          </div>

          <div class="form-group">
            <label>Descripción</label>
            <textarea v-model="editForm.description" rows="3"></textarea>
          </div>

          <div style="margin-top: 20px; padding: 14px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 11px;">
            <b style="color: var(--danger); font-size: 13px;">Zona de peligro</b>
            <p style="font-size: 12px; color: #7f1d1d; margin: 5px 0 10px;">
              Eliminar el proyecto borrará permanentemente sus modelos asociados en almacenamiento y base de datos.
            </p>
            <button
              type="button"
              class="secondary-btn"
              style="color: var(--danger); border-color: #fca5a5;"
              :disabled="isSubmitting"
              @click="handleDeleteProject"
            >
              🗑️ Eliminar proyecto
            </button>
          </div>
        </div>

        <div class="modal-foot">
          <button type="button" class="secondary-btn" @click="showManageModal = false">Cerrar</button>
          <button type="button" class="primary-btn" :disabled="isSubmitting || !editForm.name.trim()" @click="submitUpdateProject">
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { isAdmin } from '../../services/auth-service';
import {
  fetchBackendProjects,
  createBackendProject,
  updateBackendProject,
  deleteBackendProject,
  uploadDirectFrag,
  convertIfcViaBackend,
  type BackendProject,
} from '../../services/backend-client';
import IfcUploadProgress, { type IfcUploadState } from '../IfcUploadProgress.vue';

const emit = defineEmits<{
  (e: 'open-project', project: BackendProject): void;
  (e: 'toast', msg: string): void;
}>();

const projects = ref<BackendProject[]>([]);
const isLoading = ref(true);
const searchQuery = ref('');
const statusFilter = ref<'all' | 'active' | 'empty'>('all');

// Create project form state
const showCreateModal = ref(false);
const createForm = ref({ name: '', description: '' });
const isSubmitting = ref(false);
const createFile = ref<File | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const createModelState = ref<IfcUploadState>('IDLE');
const createError = ref('');
const createdProject = ref<BackendProject | null>(null);
let createAbortController: AbortController | null = null;
const createProgress = ref({
  percent: 0,
  stage: '',
  loadedBytes: 0,
  totalBytes: 0,
  speedBytesPerSec: 0,
  remainingSec: 0,
});

// Manage project form state
const showManageModal = ref(false);
const manageProjectTarget = ref<BackendProject | null>(null);
const editForm = ref({ name: '', description: '' });

const filteredProjects = computed(() => {
  let list = projects.value;

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }

  if (statusFilter.value === 'active') {
    list = list.filter(p => p.modelsCount > 0 || (p.parts && p.parts.length > 0));
  } else if (statusFilter.value === 'empty') {
    list = list.filter(p => !p.modelsCount && (!p.parts || p.parts.length === 0));
  }

  return list;
});

function getCoverGradient(index: number): string {
  const gradients = [
    'linear-gradient(135deg, #0c315b, #14719b)',
    'linear-gradient(135deg, #183e60, #238ca4)',
    'linear-gradient(135deg, #071f3a, #0e5b77)',
    'linear-gradient(135deg, #1b3858, #3b88a8)',
    'linear-gradient(135deg, #273c57, #596c79)',
  ];
  return gradients[index % gradients.length];
}

function truncate(text: string, max: number): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

async function loadProjects() {
  isLoading.value = true;
  try {
    projects.value = await fetchBackendProjects();
  } catch (err) {
    console.warn('[Projects] Error cargando proyectos:', err);
  } finally {
    isLoading.value = false;
  }
}

let searchDebounce: any = null;
function onSearchInput() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    // Client-side instant filter is handled by computed filteredProjects
  }, 100);
}

function openCreateModal() {
  createForm.value = { name: '', description: '' };
  createFile.value = null;
  createdProject.value = null;
  createModelState.value = 'IDLE';
  createError.value = '';
  showCreateModal.value = true;
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    const file = input.files[0];
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.ifc') && !ext.endsWith('.frag')) {
      alert('Solo se admiten archivos .ifc o .frag');
      return;
    }
    createFile.value = file;
    createModelState.value = 'SELECTED';
    createError.value = '';
    createProgress.value = {
      percent: 0,
      stage: 'Archivo listo para cargar',
      loadedBytes: 0,
      totalBytes: file.size,
      speedBytesPerSec: 0,
      remainingSec: 0,
    };
    if (!createForm.value.name.trim()) {
      createForm.value.name = file.name.replace(/\.(ifc|frag)$/i, '');
    }
  }
}

function cancelUpload() {
  if (createAbortController) {
    createAbortController.abort();
    createAbortController = null;
  }
  createModelState.value = 'CANCELLED';
  createError.value = 'Carga cancelada.';
  isSubmitting.value = false;
}

async function submitCreateProject() {
  if (!createForm.value.name.trim() || isSubmitting.value) return;

  isSubmitting.value = true;
  createError.value = '';

  try {
    // 1. Create or reuse project
    let target = createdProject.value;
    if (!target) {
      target = await createBackendProject(
        createForm.value.name.trim(),
        createForm.value.description.trim() || undefined
      );
      createdProject.value = target;
    }

    // 2. Upload model file if selected
    if (createFile.value) {
      const file = createFile.value;
      const isFrag = file.name.toLowerCase().endsWith('.frag');
      createModelState.value = 'UPLOADING';
      createAbortController = new AbortController();

      if (isFrag) {
        // Direct FRAG upload (No conversion needed)
        const modelItem = await uploadDirectFrag(
          target.id,
          file,
          (prog) => {
            if (prog.phase === 'uploading') createModelState.value = 'UPLOADING';
            else if (prog.phase === 'uploaded') createModelState.value = 'UPLOADED';
            else if (prog.phase === 'completed') createModelState.value = 'COMPLETED';
            createProgress.value = { ...prog };
          },
          createAbortController.signal
        );

        createModelState.value = 'COMPLETED';
        emit('toast', `Modelo FRAG "${modelItem.name}" registrado en proyecto "${target.name}".`);
      } else {
        // IFC Conversion flow
        const result = await convertIfcViaBackend(
          file,
          (prog) => {
            if (prog.phase === 'uploading') createModelState.value = 'UPLOADING';
            else if (prog.phase === 'uploaded') createModelState.value = 'UPLOADED';
            else if (prog.phase === 'processing') createModelState.value = 'PROCESSING';
            else if (prog.phase === 'completed') createModelState.value = 'COMPLETED';
            createProgress.value = { ...prog };
          },
          target.id,
          createAbortController.signal
        );

        createModelState.value = 'COMPLETED';
        emit('toast', `Modelo IFC procesado (${result.parts.length} partes).`);
      }

      await loadProjects();
      return;
    }

    emit('toast', `Proyecto "${target.name}" creado correctamente.`);
    showCreateModal.value = false;
    await loadProjects();
  } catch (err: any) {
    if (err.name === 'AbortError' || err.message?.includes('cancelada')) {
      createModelState.value = 'CANCELLED';
      createError.value = 'Carga cancelada.';
    } else {
      createModelState.value = 'ERROR';
      createError.value = err.message || 'Error durante la creación o transferencia.';
    }
  } finally {
    isSubmitting.value = false;
    createAbortController = null;
  }
}

function openManageModal(proj: BackendProject) {
  manageProjectTarget.value = proj;
  editForm.value = {
    name: proj.name,
    description: proj.description || '',
  };
  showManageModal.value = true;
}

async function submitUpdateProject() {
  if (!manageProjectTarget.value || !editForm.value.name.trim()) return;

  isSubmitting.value = true;
  try {
    await updateBackendProject(manageProjectTarget.value.id, {
      name: editForm.value.name.trim(),
      description: editForm.value.description.trim() || undefined,
    });
    emit('toast', `Proyecto "${editForm.value.name}" actualizado.`);
    showManageModal.value = false;
    await loadProjects();
  } catch (err: any) {
    alert(`Error actualizando: ${err.message}`);
  } finally {
    isSubmitting.value = false;
  }
}

async function handleDeleteProject() {
  if (!manageProjectTarget.value) return;
  const projName = manageProjectTarget.value.name;

  if (!confirm(`¿Estás seguro de eliminar permanentemente el proyecto "${projName}" y todos sus modelos asociados?`)) {
    return;
  }

  isSubmitting.value = true;
  try {
    await deleteBackendProject(manageProjectTarget.value.id);
    emit('toast', `Proyecto "${projName}" eliminado.`);
    showManageModal.value = false;
    await loadProjects();
  } catch (err: any) {
    alert(`Error eliminando proyecto: ${err.message}`);
  } finally {
    isSubmitting.value = false;
  }
}

defineExpose({
  openCreateModal,
  loadProjects,
});

onMounted(() => {
  loadProjects();
});
</script>
