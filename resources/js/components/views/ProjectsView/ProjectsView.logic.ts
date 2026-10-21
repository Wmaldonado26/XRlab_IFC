import { ref, computed, onMounted } from 'vue';

import { isAdmin } from '../../../services/auth-service';

import {
  fetchBackendProjects,
  createBackendProject,
  updateBackendProject,
  deleteBackendProject,
  uploadProjectCover,
  deleteProjectCover,
  uploadDirectFrag,
  convertIfcViaBackend,
  type BackendProject,
} from '../../../services/backend-client';

import IfcUploadProgress from '../../IfcUploadProgress/IfcUploadProgress.vue';
import type { IfcUploadState } from '../../IfcUploadProgress/IfcUploadProgress.logic';

export function useProjectsView<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(emit: (...args: any[]) => any) {
  const projects = ref<BackendProject[]>([]);

  const isLoading = ref(true);

  const searchQuery = ref('');

  const statusFilter = ref<'all' | 'active' | 'empty'>('all');

  // Create project form state
  const showCreateModal = ref(false);

  const createForm = ref({ name: '', description: '' });

  const isSubmitting = ref(false);

  const createFiles = ref<File[]>([]);

  // Keep successful uploads so retrying after a later failure won't duplicate them.
  const uploadedCreateFiles = ref<string[]>([]);

  function getCreateFileKey(file: File): string {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }

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

  // Cover image state
  const createCoverFile = ref<File | null>(null);

  const createCoverPreview = ref<string | null>(null);

  const createCoverInputRef = ref<HTMLInputElement | null>(null);

  const directCoverInputRef = ref<HTMLInputElement | null>(null);

  const targetCoverProject = ref<BackendProject | null>(null);

  const uploadingCoverProjectId = ref<string | null>(null);

  const manageCoverInputRef = ref<HTMLInputElement | null>(null);

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
    createFiles.value = [];
    uploadedCreateFiles.value = [];
    createCoverFile.value = null;
    if (createCoverPreview.value) {
      URL.revokeObjectURL(createCoverPreview.value);
      createCoverPreview.value = null;
    }
    createdProject.value = null;
    createModelState.value = 'IDLE';
    createError.value = '';
    showCreateModal.value = true;
  }

  function onCreateCoverSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      createCoverFile.value = file;
      if (createCoverPreview.value) {
        URL.revokeObjectURL(createCoverPreview.value);
      }
      createCoverPreview.value = URL.createObjectURL(file);
    }
  }

  function removeCreateCover() {
    createCoverFile.value = null;
    if (createCoverPreview.value) {
      URL.revokeObjectURL(createCoverPreview.value);
      createCoverPreview.value = null;
    }
    if (createCoverInputRef.value) {
      createCoverInputRef.value.value = '';
    }
  }

  function onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (files.length === 0) return;

    const invalidFile = files.find((file) => !/\.(ifc|frag)$/i.test(file.name));
    const hasIfc = files.some((file) => /\.ifc$/i.test(file.name));
    if (invalidFile || (hasIfc && files.length > 1)) {
      alert(invalidFile
        ? 'Solo se admiten archivos .ifc o .frag.'
        : 'Puedes seleccionar varios FRAG o un solo IFC.');
      input.value = '';
      return;
    }

    createFiles.value = files;
    createFile.value = files[0];
    createModelState.value = 'SELECTED';
    createError.value = '';
    createProgress.value = {
      percent: 0,
      stage: files.length > 1 ? `${files.length} archivos listos para cargar` : 'Archivo listo para cargar',
      loadedBytes: 0,
      totalBytes: files.reduce((total, file) => total + file.size, 0),
      speedBytesPerSec: 0,
      remainingSec: 0,
    };
    if (!createForm.value.name.trim()) {
      createForm.value.name = files[0].name.replace(/\.(ifc|frag)$/i, '');
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
          createForm.value.description.trim() || undefined,
          createCoverFile.value
        );
        createdProject.value = target;
      }
  
      // 2. Upload selected model files sequentially to the same project.
      if (createFiles.value.length > 0) {
        const pendingFiles = createFiles.value.filter((file) => !uploadedCreateFiles.value.includes(getCreateFileKey(file)));
        if (pendingFiles.length === 0) {
          createModelState.value = 'COMPLETED';
          await loadProjects();
          return;
        }

        for (const file of pendingFiles) {
          createFile.value = file;
          const isFrag = file.name.toLowerCase().endsWith('.frag');
          createModelState.value = 'UPLOADING';
          createAbortController = new AbortController();
  
          if (isFrag) {
            // Direct FRAG upload (No conversion needed)
            const modelItem = await uploadDirectFrag(
              target.id,
              file,
              (prog: any) => {
                if (prog.phase === 'uploading') createModelState.value = 'UPLOADING';
                else if (prog.phase === 'uploaded') createModelState.value = 'UPLOADED';
                else if (prog.phase === 'completed') createModelState.value = 'COMPLETED';
                createProgress.value = {
                  percent: typeof prog.percent === 'number' ? prog.percent : 0,
                  stage: prog.stage || '',
                  loadedBytes: prog.loadedBytes || 0,
                  totalBytes: prog.totalBytes || 0,
                  speedBytesPerSec: prog.speedBytesPerSec || 0,
                  remainingSec: prog.remainingSec || 0,
                };
              },
              createAbortController.signal
            );

            createModelState.value = 'COMPLETED';
            uploadedCreateFiles.value.push(getCreateFileKey(file));
            emit('toast', `Modelo FRAG "${modelItem.name}" registrado en proyecto "${target.name}".`);
          } else {
            // IFC Conversion flow
            const result = await convertIfcViaBackend(
              file,
              (prog: any) => {
                if (prog.phase === 'uploading') createModelState.value = 'UPLOADING';
                else if (prog.phase === 'uploaded') createModelState.value = 'UPLOADED';
                else if (prog.phase === 'processing') createModelState.value = 'PROCESSING';
                else if (prog.phase === 'completed') createModelState.value = 'COMPLETED';
                createProgress.value = {
                  percent: typeof prog.percent === 'number' ? prog.percent : 0,
                  stage: prog.stage || '',
                  loadedBytes: prog.loadedBytes || 0,
                  totalBytes: prog.totalBytes || 0,
                  speedBytesPerSec: prog.speedBytesPerSec || 0,
                  remainingSec: prog.remainingSec || 0,
                };
              },
              target.id,
              createAbortController.signal,
              { downloadResult: false }
            );

            createModelState.value = 'COMPLETED';
            uploadedCreateFiles.value.push(getCreateFileKey(file));
            emit('toast', `Modelo IFC procesado (${result.parts.length} partes).`);
          }
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
    manageProjectTarget.value = { ...proj };
    editForm.value = {
      name: proj.name,
      description: proj.description || '',
    };
    showManageModal.value = true;
  }

  function triggerCoverUpload(proj: BackendProject) {
    targetCoverProject.value = proj;
    directCoverInputRef.value?.click();
  }

  async function onDirectCoverSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !targetCoverProject.value) return;
    const file = input.files[0];
    const proj = targetCoverProject.value;
    uploadingCoverProjectId.value = proj.id;
    try {
      const updated = await uploadProjectCover(proj.id, file);
      emit('toast', `Imagen de portada actualizada para "${proj.name}".`);
      await loadProjects();
    } catch (err: any) {
      alert(`Error subiendo imagen: ${err.message}`);
    } finally {
      uploadingCoverProjectId.value = null;
      targetCoverProject.value = null;
      input.value = '';
    }
  }

  async function handleDeleteCover(proj: BackendProject) {
    if (!confirm(`¿Deseas quitar la imagen de portada del proyecto "${proj.name}"?`)) return;
    uploadingCoverProjectId.value = proj.id;
    try {
      await deleteProjectCover(proj.id);
      emit('toast', `Imagen de portada eliminada de "${proj.name}".`);
      await loadProjects();
    } catch (err: any) {
      alert(`Error eliminando portada: ${err.message}`);
    } finally {
      uploadingCoverProjectId.value = null;
    }
  }

  async function onManageCoverSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !manageProjectTarget.value) return;
    const file = input.files[0];
    isSubmitting.value = true;
    try {
      const updated = await uploadProjectCover(manageProjectTarget.value.id, file);
      manageProjectTarget.value = updated;
      emit('toast', `Imagen de portada actualizada para "${updated.name}".`);
      await loadProjects();
    } catch (err: any) {
      alert(`Error actualizando portada: ${err.message}`);
    } finally {
      isSubmitting.value = false;
      input.value = '';
    }
  }

  async function onManageCoverDelete() {
    if (!manageProjectTarget.value) return;
    if (!confirm('¿Deseas quitar la imagen de portada del proyecto?')) return;
    isSubmitting.value = true;
    try {
      const updated = await deleteProjectCover(manageProjectTarget.value.id);
      manageProjectTarget.value = updated;
      emit('toast', 'Imagen de portada eliminada.');
      await loadProjects();
    } catch (err: any) {
      alert(`Error eliminando portada: ${err.message}`);
    } finally {
      isSubmitting.value = false;
    }
  }

  function onImageError(proj: BackendProject) {
    proj.imageUrl = null;
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

  onMounted(() => {
    loadProjects();
  });

  return {
    ref,
    computed,
    onMounted,
    isAdmin,
    fetchBackendProjects,
    createBackendProject,
    updateBackendProject,
    deleteBackendProject,
    uploadProjectCover,
    deleteProjectCover,
    uploadDirectFrag,
    convertIfcViaBackend,
    IfcUploadProgress,
    projects,
    isLoading,
    searchQuery,
    statusFilter,
    showCreateModal,
    createForm,
    isSubmitting,
    createFile,
    createFiles,
    uploadedCreateFiles,
    getCreateFileKey,
    fileInputRef,
    createModelState,
    createError,
    createdProject,
    createAbortController,
    createProgress,
    createCoverFile,
    createCoverPreview,
    createCoverInputRef,
    directCoverInputRef,
    targetCoverProject,
    uploadingCoverProjectId,
    manageCoverInputRef,
    showManageModal,
    manageProjectTarget,
    editForm,
    filteredProjects,
    getCoverGradient,
    truncate,
    loadProjects,
    searchDebounce,
    onSearchInput,
    openCreateModal,
    onCreateCoverSelected,
    removeCreateCover,
    onFileSelected,
    cancelUpload,
    submitCreateProject,
    openManageModal,
    triggerCoverUpload,
    onDirectCoverSelected,
    handleDeleteCover,
    onManageCoverSelected,
    onManageCoverDelete,
    onImageError,
    submitUpdateProject,
    handleDeleteProject,
  };
}
