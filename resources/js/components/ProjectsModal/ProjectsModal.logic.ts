import { ref, computed, onMounted, watch } from 'vue';

import {
  listCachedProjects,
  deleteCachedProject,
  clearAllCachedProjects,
} from '../../services/frag-cache';

import {
  fetchBackendProjects,
  createBackendProject,
  updateBackendProject,
  deleteBackendProject,
  fetchBackendModels,
  deleteBackendModel,
  uploadDirectFrag,
  type BackendProject,
  type BackendModelItem,
} from '../../services/backend-client';

import { currentUser, isAdmin } from '../../services/auth-service';

export function useProjectsModal<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(props: TProps, emit: (...args: any[]) => any) {
  // Tabs
  const activeTab = ref<'projects' | 'models' | 'cache'>('projects');

  // Feedback
  const feedbackMessage = ref('');

  const feedbackType = ref<'success' | 'error' | 'info'>('info');

  const setFeedback = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    feedbackMessage.value = msg;
    feedbackType.value = type;
    setTimeout(() => {
      if (feedbackMessage.value === msg) {
        feedbackMessage.value = '';
      }
    }, 4500);
  };

  // Projects State
  const projectsList = ref<BackendProject[]>([]);

  const projectSearch = ref('');

  const isLoadingProjects = ref(false);

  const expandedProjects = ref<Record<string, boolean>>({});

  // Models State
  const modelsList = ref<BackendModelItem[]>([]);

  const modelSearch = ref('');

  const selectedProjectFilter = ref('all');

  const selectedStatusFilter = ref('all');

  const isLoadingModels = ref(false);

  // Cache State
  const cachedList = ref<Array<{ id: string; name: string; totalBytes: number; timestamp: number }>>([]);

  // Sub-modals state
  const showCreateProjectModal = ref(false);

  const newProjectName = ref('');

  const newProjectDesc = ref('');

  const newProjectFragFiles = ref<File[]>([]);

  const onNewProjectFragSelected = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      newProjectFragFiles.value = Array.from(input.files).filter(f => f.name.toLowerCase().endsWith('.frag') && f.size > 0);
    }
  };

  const showEditProjectModal = ref(false);

  const editProjectId = ref('');

  const editProjectName = ref('');

  const editProjectDesc = ref('');

  const showDeleteProjectModal = ref(false);

  const projectToDelete = ref<BackendProject | null>(null);

  const showDeleteModelModal = ref(false);

  const modelToDelete = ref<BackendModelItem | null>(null);

  const showModelDetailsModal = ref(false);

  const selectedModelDetail = ref<BackendModelItem | null>(null);

  // Refresh functions
  const refreshProjects = async () => {
    isLoadingProjects.value = true;
    try {
      projectsList.value = await fetchBackendProjects(projectSearch.value);
    } catch (err: any) {
      setFeedback(`Error cargando proyectos: ${err.message}`, 'error');
    } finally {
      isLoadingProjects.value = false;
    }
  };

  const refreshModels = async () => {
    isLoadingModels.value = true;
    try {
      modelsList.value = await fetchBackendModels({
        query: modelSearch.value,
        projectId: selectedProjectFilter.value !== 'all' ? selectedProjectFilter.value : undefined,
        status: selectedStatusFilter.value !== 'all' ? selectedStatusFilter.value : undefined,
      });
    } catch (err: any) {
      setFeedback(`Error cargando modelos: ${err.message}`, 'error');
    } finally {
      isLoadingModels.value = false;
    }
  };

  const refreshCache = async () => {
    try {
      const userId = currentUser.value?.id;
      cachedList.value = userId ? await listCachedProjects(userId) : [];
    } catch (err: any) {
      console.warn('Error leyendo caché IndexedDB:', err);
    }
  };

  const refreshAll = async () => {
    await Promise.all([refreshProjects(), refreshModels(), refreshCache()]);
  };

  // Debounced Search Handlers
  let searchDebounceTimer: any = null;

  const onProjectSearchChange = () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      refreshProjects();
    }, 250);
  };

  const onModelFilterChange = () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      refreshModels();
    }, 250);
  };

  const filteredModels = computed(() => modelsList.value);

  // Accordion toggle for project models
  const toggleProjectDrawer = (projectId: string) => {
    expandedProjects.value[projectId] = !expandedProjects.value[projectId];
  };

  // Actions on Projects
  const openCreateProjectModal = () => {
    newProjectName.value = '';
    newProjectDesc.value = '';
    newProjectFragFiles.value = [];
    showCreateProjectModal.value = true;
  };

  const submitCreateProject = async () => {
    if (!newProjectName.value.trim()) return;
    try {
      const created = await createBackendProject(newProjectName.value, newProjectDesc.value);
      let uploadedCount = 0;
      if (newProjectFragFiles.value.length > 0) {
        for (const file of newProjectFragFiles.value) {
          await uploadDirectFrag(created.id, file);
          uploadedCount++;
        }
      }
      showCreateProjectModal.value = false;
      newProjectFragFiles.value = [];
      setFeedback(
        uploadedCount > 0
          ? `Proyecto creado exitosamente con ${uploadedCount} archivo(s) .frag.`
          : 'Proyecto creado exitosamente.',
        'success'
      );
      await refreshProjects();
      await refreshModels();
    } catch (err: any) {
      setFeedback(`Error creando proyecto: ${err.message}`, 'error');
    }
  };

  const openEditProjectModal = (proj: BackendProject) => {
    editProjectId.value = proj.id;
    editProjectName.value = proj.name;
    editProjectDesc.value = proj.description || '';
    showEditProjectModal.value = true;
  };

  const submitEditProject = async () => {
    if (!editProjectName.value.trim()) return;
    try {
      await updateBackendProject(editProjectId.value, {
        name: editProjectName.value,
        description: editProjectDesc.value,
      });
      showEditProjectModal.value = false;
      setFeedback('Proyecto actualizado correctamente.', 'success');
      await refreshProjects();
      await refreshModels();
    } catch (err: any) {
      setFeedback(`Error actualizando proyecto: ${err.message}`, 'error');
    }
  };

  const promptDeleteProject = (proj: BackendProject) => {
    projectToDelete.value = proj;
    showDeleteProjectModal.value = true;
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete.value) return;
    try {
      const res = await deleteBackendProject(projectToDelete.value.id);
      showDeleteProjectModal.value = false;
      setFeedback(`Proyecto eliminado con éxito (${res.deletedModelsCount} modelos borrados).`, 'success');
      projectToDelete.value = null;
      await refreshProjects();
      await refreshModels();
    } catch (err: any) {
      setFeedback(`Error al eliminar proyecto: ${err.message}`, 'error');
    }
  };

  // Actions on Models
  const promptDeleteModel = (model: BackendModelItem) => {
    modelToDelete.value = model;
    showDeleteModelModal.value = true;
  };

  const confirmDeleteModel = async () => {
    if (!modelToDelete.value) return;
    try {
      await deleteBackendModel(modelToDelete.value.id);
      showDeleteModelModal.value = false;
      setFeedback(`Modelo "${modelToDelete.value.name}" eliminado correctamente.`, 'success');
      modelToDelete.value = null;
      await refreshModels();
      await refreshProjects();
    } catch (err: any) {
      setFeedback(`Error al eliminar modelo: ${err.message}`, 'error');
    }
  };

  const openModelDetailsModal = (model: BackendModelItem) => {
    selectedModelDetail.value = model;
    showModelDetailsModal.value = true;
  };

  // Load Actions
  const onLoadProject = (proj: BackendProject) => {
    emit('loadBackend', proj);
    emit('update:modelValue', false);
  };

  const onLoadSingleModel = (model: BackendModelItem) => {
    emit('loadModel', model);
    emit('update:modelValue', false);
  };

  const onLoadCached = (id: string) => {
    emit('loadCached', id);
    emit('update:modelValue', false);
  };

  const onDeleteCached = async (id: string) => {
    const userId = currentUser.value?.id;
    if (!userId) return;
    await deleteCachedProject(userId, id);
    await refreshCache();
    setFeedback('Elemento eliminado de la caché local.', 'info');
  };

  const onClearCache = async () => {
    if (confirm('¿Deseas vaciar toda la caché local de modelos del navegador?')) {
      await clearAllCachedProjects();
      cachedList.value = [];
      setFeedback('Caché local vaciada completamente.', 'info');
    }
  };

  // Lifecycle
  watch(
    () => props.modelValue,
    (val) => {
      if (val) refreshAll();
    }
  );

  onMounted(() => {
    refreshAll();
  });

  const formatDate = (ms: number) => {
    try {
      return new Date(ms).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return {
    ref,
    computed,
    onMounted,
    watch,
    listCachedProjects,
    deleteCachedProject,
    clearAllCachedProjects,
    fetchBackendProjects,
    createBackendProject,
    updateBackendProject,
    deleteBackendProject,
    fetchBackendModels,
    deleteBackendModel,
    uploadDirectFrag,
    isAdmin,
    activeTab,
    feedbackMessage,
    feedbackType,
    setFeedback,
    projectsList,
    projectSearch,
    isLoadingProjects,
    expandedProjects,
    modelsList,
    modelSearch,
    selectedProjectFilter,
    selectedStatusFilter,
    isLoadingModels,
    cachedList,
    showCreateProjectModal,
    newProjectName,
    newProjectDesc,
    newProjectFragFiles,
    onNewProjectFragSelected,
    showEditProjectModal,
    editProjectId,
    editProjectName,
    editProjectDesc,
    showDeleteProjectModal,
    projectToDelete,
    showDeleteModelModal,
    modelToDelete,
    showModelDetailsModal,
    selectedModelDetail,
    refreshProjects,
    refreshModels,
    refreshCache,
    refreshAll,
    searchDebounceTimer,
    onProjectSearchChange,
    onModelFilterChange,
    filteredModels,
    toggleProjectDrawer,
    openCreateProjectModal,
    submitCreateProject,
    openEditProjectModal,
    submitEditProject,
    promptDeleteProject,
    confirmDeleteProject,
    promptDeleteModel,
    confirmDeleteModel,
    openModelDetailsModal,
    onLoadProject,
    onLoadSingleModel,
    onLoadCached,
    onDeleteCached,
    onClearCache,
    formatDate,
  };
}
