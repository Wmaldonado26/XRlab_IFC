import { ref, computed, onMounted, watch } from 'vue';

import {
  fetchBackendProjects,
  fetchBackendModels,
  createBackendProject,
  updateBackendProject,
  deleteBackendProject,
  uploadDirectFrag,
  convertIfcViaBackend,
  type BackendProject,
  type BackendModelItem,
  type BackendConversionProgress,
} from '../../services/backend-client';

import { appendProjectFragments } from '../../services/frag-cache';

import {
  currentUser,
  isAdmin,
  logout,
  adminFetchUsersPage,
  type AdminUserItem,
  type AdminUsersPagination,
} from '../../services/auth-service';

import { appLogger, type AppLogEntry } from '../../services/logger';

import AdminPanelModal from '../AdminPanelModal/AdminPanelModal.vue';

import IfcUploadProgress from '../IfcUploadProgress/IfcUploadProgress.vue';
import type { IfcUploadState } from '../IfcUploadProgress/IfcUploadProgress.logic';

// =====================================================================
// NAVEGACIÓN ENTRE VISTAS DEL PROTOTIPO
// =====================================================================
type NavView = 'dashboard' | 'projects' | 'models' | 'users' | 'logs' | 'settings';

// Lista aplanada de todos los modelos de todos los proyectos para la vista "Modelos IFC"
interface FlattenedModel {
  uniqueKey: string;
  id: string;
  name: string;
  category?: string;
  projectName: string;
  projectId: string;
  sizeFormatted: string;
  isReady: boolean;
  project: BackendProject;
}

export function useProjectGallery<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(emit: (...args: any[]) => any) {
  const currentNav = ref<NavView>('dashboard');

  // Guardia de navegación por rol
  watch([currentNav, isAdmin], ([nav, admin]) => {
    if (!admin && (nav === 'users' || nav === 'logs' || nav === 'settings')) {
      currentNav.value = 'projects';
    }
  });

  const navLabels = computed<Record<NavView, string>>(() => ({
    dashboard: 'Dashboard',
    projects: isAdmin.value ? 'Proyectos' : 'Mis Proyectos',
    models: isAdmin.value ? 'Modelos IFC' : 'Modelos Asignados',
    users: 'Usuarios',
    logs: 'Registros',
    settings: 'Configuración',
  }));

  // =====================================================================
  // ESTADO DE PROYECTOS Y CATÁLOGO
  // =====================================================================
  const projectsList = ref<BackendProject[]>([]);

  const backendModelsList = ref<BackendModelItem[]>([]);

  const usersList = ref<AdminUserItem[]>([]);

  const usersPagination = ref<AdminUsersPagination>({
    currentPage: 1,
    lastPage: 1,
    perPage: 25,
    total: 0,
  });

  const systemLogs = ref<AppLogEntry[]>([]);

  const isLoading = ref(true);

  const isSubmitting = ref(false);

  // Filtros y Búsqueda
  const searchQuery = ref('');

  const filterStatus = ref<'all' | 'with_models' | 'empty'>('all');

  const sortBy = ref<'recent' | 'name_asc' | 'name_desc' | 'size_desc' | 'models_desc'>('recent');

  // Toast y Feedback
  const feedbackMessage = ref('');

  const feedbackType = ref<'success' | 'error'>('success');

  const toastMessage = ref('');

  const toastVisible = ref(false);

  function showToast(msg: string) {
    toastMessage.value = msg;
    toastVisible.value = true;
    setTimeout(() => {
      toastVisible.value = false;
    }, 2400);
  }

  function setFeedback(msg: string, type: 'success' | 'error' = 'success') {
    feedbackMessage.value = msg;
    feedbackType.value = type;
    showToast(msg);
  }

  async function loadUsers(page = usersPagination.value.currentPage) {
    if (!isAdmin.value) return;

    try {
      const result = await adminFetchUsersPage({ page });
      usersList.value = result.users;
      usersPagination.value = result.pagination;

      if (page > usersPagination.value.lastPage && usersPagination.value.lastPage > 0) {
        await loadUsers(usersPagination.value.lastPage);
      }
    } catch (err: any) {
      setFeedback(err.message || 'Error consultando usuarios.', 'error');
    }
  }

  function goToUsersPage(page: number) {
    if (page >= 1 && page <= usersPagination.value.lastPage && page !== usersPagination.value.currentPage) {
      void loadUsers(page);
    }
  }

  // Configuración de la plataforma
  const settings = ref({
    platformName: 'XRlab IFC',
    conversionEngine: 'IFC → FRAG (Node 64-bit & WebAssembly)',
  });

  function saveSettings() {
    showToast('Configuración guardada correctamente');
  }

  // Métricas computadas
  const totalModelsCount = computed(() => {
    return projectsList.value.reduce((acc, p) => acc + (p.modelsCount || 0), 0);
  });

  const convertedCount = computed(() => {
    return projectsList.value.filter((p) => (p.modelsCount || 0) > 0).length;
  });

  const recentProjects = computed(() => {
    return [...projectsList.value].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 4);
  });

  const recentActivity = computed(() => {
    return systemLogs.value.slice(-6).reverse();
  });

  const allProjectModels = computed<FlattenedModel[]>(() => {
    const result: FlattenedModel[] = [];
    for (const proj of projectsList.value) {
      if (proj.models && proj.models.length > 0) {
        for (const m of proj.models) {
          const mName = m?.name || (m as any)?.fileName || 'Modelo';
          result.push({
            uniqueKey: `${proj.id}-${m.id || Math.random()}`,
            id: m.id || String(Math.random()),
            name: mName,
            category: mName.toLowerCase().includes('estruct') ? 'Modelo estructural' : 'Arquitectura / MEP',
            projectName: proj.name,
            projectId: proj.id,
            sizeFormatted: m.sizeFormatted || `${(((m as any).size || 0) / (1024 * 1024)).toFixed(2)} MB`,
            isReady: true,
            project: proj,
          });
        }
      } else if (proj.modelsCount && proj.modelsCount > 0) {
        result.push({
          uniqueKey: `${proj.id}-frag`,
          id: proj.id,
          name: proj.fileName || `${proj.name}.frag`,
          category: 'Modelo BIM principal',
          projectName: proj.name,
          projectId: proj.id,
          sizeFormatted: `${proj.totalPartsSizeMB || '—'} MB`,
          isReady: true,
          project: proj,
        });
      }
    }
    return result;
  });

  // Proyectos filtrados
  const filteredProjects = computed(() => {
    let list = [...projectsList.value];
    const q = (searchQuery.value || '').trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const name = (p.name || p.fileName || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        return name.includes(q) || desc.includes(q);
      });
    }
  
    if (filterStatus.value === 'with_models') {
      list = list.filter((p) => (p.modelsCount || 0) > 0);
    } else if (filterStatus.value === 'empty') {
      list = list.filter((p) => (p.modelsCount || 0) === 0);
    }
  
    list.sort((a, b) => {
      switch (sortBy.value) {
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'name_desc':
          return (b.name || '').localeCompare(a.name || '');
        case 'size_desc':
          return (b.fileSize || 0) - (a.fileSize || 0);
        case 'models_desc':
          return (b.modelsCount || 0) - (a.modelsCount || 0);
        case 'recent':
        default:
          return (b.createdAt || 0) - (a.createdAt || 0);
      }
    });
  
    return list;
  });

  function resetFilters() {
    searchQuery.value = '';
    filterStatus.value = 'all';
    sortBy.value = 'recent';
  }

  function formatDate(ts: number): string {
    if (!ts) return 'Hoy';
    const diffDays = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    return new Date(ts).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function handleOpenProject(project: BackendProject) {
    emit('open-project', project);
  }

  function handleViewModelInViewer(model: FlattenedModel) {
    emit('open-project', model.project);
  }

  function handleUploadIfcShortcut() {
    openCreateModal();
  }

  async function handleLogout() {
    await logout();
    projectsList.value = [];
    emit('request-login');
  }

  // Carga general de datos
  async function loadProjects() {
    isLoading.value = true;
    try {
      const [projs, mods] = await Promise.all([
        fetchBackendProjects(),
        fetchBackendModels(),
      ]);
      projectsList.value = projs;
      backendModelsList.value = mods;
      if (isAdmin.value) {
        await loadUsers(1);
      }
      systemLogs.value = appLogger.getLogs();
    } catch (err: any) {
      setFeedback(err.message || 'Error consultando catálogo.', 'error');
    } finally {
      isLoading.value = false;
    }
  }

  function refreshLogs() {
    systemLogs.value = appLogger.getLogs();
    showToast('Registros actualizados');
  }

  function showLogDetail(log: AppLogEntry) {
    alert(`Registro [${log.level.toUpperCase()}]: ${log.message}\nOrigen: ${log.origin}\nHora: ${log.timestamp}`);
  }

  function getActivityGlyph(log: AppLogEntry): string {
    if (log.level === 'error') return '⚠️';
    if (log.message.includes('convertid') || log.message.includes('incorporad')) return '✓';
    if (log.message.includes('carg') || log.message.includes('subid')) return '↥';
    if (log.message.includes('usuario')) return '♙';
    return 'ℹ';
  }

  // =====================================================================
  // MODAL: CREAR PROYECTO (CON SOPORTE IFC Y FRAG Y PROGRESO REAL)
  // =====================================================================
  const showCreateModal = ref(false);

  const createForm = ref({ name: '', description: '' });

  const createModelFile = ref<File | null>(null);

  const createFileInputRef = ref<HTMLInputElement | null>(null);

  const createModelState = ref<IfcUploadState>('IDLE');

  const createModelError = ref('');

  const createModelProgress = ref<BackendConversionProgress>({
    percent: 0,
    stage: '',
    loadedBytes: 0,
    totalBytes: 0,
    speedBytesPerSec: 0,
    remainingSec: 0,
  });

  let createModelAbortController: AbortController | null = null;

  const createdProjectForModel = ref<BackendProject | null>(null);

  function onCreateFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const ext = file.name.toLowerCase();
      if (!ext.endsWith('.ifc') && !ext.endsWith('.frag')) {
        createModelError.value = 'Solo se admiten archivos con extensión .ifc o .frag';
        createModelState.value = 'ERROR';
        createModelFile.value = null;
        return;
      }
      createModelFile.value = file;
      createModelState.value = 'SELECTED';
      createModelError.value = '';
      createModelProgress.value = {
        percent: 0,
        stage: '',
        loadedBytes: 0,
        totalBytes: file.size,
        speedBytesPerSec: 0,
        remainingSec: 0,
      };
      if (!createForm.value.name.trim()) {
        createForm.value.name = file.name.replace(/\.(ifc|frag)$/i, '');
      }
      input.value = '';
    }
  }

  function cancelCreateModelUpload() {
    if (createModelAbortController) {
      createModelAbortController.abort();
      createModelAbortController = null;
    }
    createModelState.value = 'CANCELLED';
    createModelError.value = 'Carga cancelada.';
    isSubmitting.value = false;
  }

  function retryCreateModelUpload() {
    submitCreateProject();
  }

  function openCreateModal() {
    createForm.value = { name: '', description: '' };
    createdProjectForModel.value = null;
    if (createModelAbortController) {
      createModelAbortController.abort();
      createModelAbortController = null;
    }
    createModelFile.value = null;
    createModelState.value = 'IDLE';
    createModelError.value = '';
    showCreateModal.value = true;
  }

  async function submitCreateProject() {
    if (!createForm.value.name.trim() || isSubmitting.value) return;
  
    isSubmitting.value = true;
    try {
      let targetProject = createdProjectForModel.value;
      if (!targetProject) {
        targetProject = await createBackendProject(
          createForm.value.name.trim(),
          createForm.value.description.trim() || undefined
        );
        createdProjectForModel.value = targetProject;
      }
  
      if (createModelFile.value) {
        const file = createModelFile.value;
        const isFrag = file.name.toLowerCase().endsWith('.frag');
  
        createModelState.value = 'UPLOADING';
        createModelError.value = '';
        createModelAbortController = new AbortController();
  
        if (isFrag) {
          // Carga directa de FRAG: Sin conversión IFC
          const modelItem = await uploadDirectFrag(
            targetProject.id,
            file,
            (progress: any) => {
              if (progress.phase === 'uploading') createModelState.value = 'UPLOADING';
              else if (progress.phase === 'uploaded') createModelState.value = 'UPLOADED';
              else if (progress.phase === 'completed') createModelState.value = 'COMPLETED';
              createModelProgress.value = { ...progress };
            },
            createModelAbortController.signal
          );
  
          createModelState.value = 'COMPLETED';
          setFeedback(`Proyecto "${targetProject.name}" creado con modelo FRAG "${modelItem.name}".`);
        } else {
          // Carga y conversión de IFC: Fases 1 a 6
          const result = await convertIfcViaBackend(
            file,
            (progress) => {
              if (progress.phase === 'uploading') createModelState.value = 'UPLOADING';
              else if (progress.phase === 'uploaded') createModelState.value = 'UPLOADED';
              else if (progress.phase === 'processing') createModelState.value = 'PROCESSING';
              else if (progress.phase === 'completed') createModelState.value = 'COMPLETED';
              createModelProgress.value = { ...progress };
            },
            targetProject.id,
            createModelAbortController.signal,
            { downloadResult: false }
          );
  
          createModelState.value = 'COMPLETED';
          setFeedback(`Proyecto "${targetProject.name}" creado e incorporado (${result.parts.length} partes).`);
        }
  
        await loadProjects();
        return;
      }
  
      setFeedback(`Proyecto "${targetProject.name}" creado exitosamente.`);
      showCreateModal.value = false;
      await loadProjects();
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('cancelada')) {
        createModelState.value = 'CANCELLED';
        createModelError.value = 'Carga cancelada.';
      } else {
        if (createModelFile.value) {
          createModelState.value = 'ERROR';
          createModelError.value = err.message || 'Error en transferencia.';
        } else {
          setFeedback(err.message || 'Error al crear proyecto.', 'error');
        }
      }
    } finally {
      isSubmitting.value = false;
      createModelAbortController = null;
    }
  }

  // =====================================================================
  // MODAL: EDITAR Y ELIMINAR PROYECTO
  // =====================================================================
  const showEditModal = ref(false);

  const editingProject = ref<BackendProject | null>(null);

  const editForm = ref({ name: '', description: '' });

  function openEditModal(project: BackendProject) {
    editingProject.value = project;
    editForm.value = { name: project.name, description: project.description || '' };
    showEditModal.value = true;
  }

  async function submitUpdateProject() {
    if (!editingProject.value || !editForm.value.name.trim()) return;
    isSubmitting.value = true;
    try {
      await updateBackendProject(editingProject.value.id, {
        name: editForm.value.name.trim(),
        description: editForm.value.description.trim() || undefined,
      });
      setFeedback(`Proyecto "${editForm.value.name}" actualizado.`);
      showEditModal.value = false;
      await loadProjects();
    } catch (err: any) {
      setFeedback(err.message || 'Error actualizando proyecto.', 'error');
    } finally {
      isSubmitting.value = false;
    }
  }

  const showDeleteModal = ref(false);

  const projectToDelete = ref<BackendProject | null>(null);

  function promptDeleteProject(project: BackendProject) {
    projectToDelete.value = project;
    showDeleteModal.value = true;
  }

  async function submitDeleteProject() {
    if (!projectToDelete.value) return;
    isSubmitting.value = true;
    try {
      await deleteBackendProject(projectToDelete.value.id);
      setFeedback(`Proyecto "${projectToDelete.value.name}" eliminado.`);
      showDeleteModal.value = false;
      await loadProjects();
    } catch (err: any) {
      setFeedback(err.message || 'Error eliminando proyecto.', 'error');
    } finally {
      isSubmitting.value = false;
    }
  }

  // =====================================================================
  // MODAL: AÑADIR MODELO AL PROYECTO
  // =====================================================================
  const showAddModelModal = ref(false);

  const activeProjectForModel = ref<BackendProject | null>(null);

  const activeModelTab = ref<'ifc' | 'frag'>('ifc');

  const ifcFile = ref<File | null>(null);

  const ifcInputRef = ref<HTMLInputElement | null>(null);

  const ifcState = ref<IfcUploadState>('IDLE');

  const isConvertingIfc = ref(false);

  const ifcProgress = ref<BackendConversionProgress>({
    percent: 0,
    stage: '',
    elapsed: '',
    loadedBytes: 0,
    totalBytes: 0,
    speedBytesPerSec: 0,
    remainingSec: 0,
  });

  let ifcAbortController: AbortController | null = null;

  const ifcConversionSuccess = ref(false);

  const ifcError = ref('');

  const fragFile = ref<File | null>(null);

  const fragInputRef = ref<HTMLInputElement | null>(null);

  const fragState = ref<IfcUploadState>('IDLE');

  const fragError = ref('');

  const fragUploadSuccess = ref(false);

  const fragProgress = ref<BackendConversionProgress>({
    percent: 0,
    stage: '',
    loadedBytes: 0,
    totalBytes: 0,
    speedBytesPerSec: 0,
    remainingSec: 0,
  });

  let fragAbortController: AbortController | null = null;

  function openAddModelModal(project: BackendProject) {
    activeProjectForModel.value = project;
    activeModelTab.value = 'ifc';
    ifcFile.value = null;
    ifcState.value = 'IDLE';
    ifcError.value = '';
    ifcConversionSuccess.value = false;
    fragFile.value = null;
    fragState.value = 'IDLE';
    fragError.value = '';
    fragUploadSuccess.value = false;
    if (fragAbortController) {
      fragAbortController.abort();
      fragAbortController = null;
    }
    if (ifcAbortController) {
      ifcAbortController.abort();
      ifcAbortController = null;
    }
    showAddModelModal.value = true;
  }

  function onIfcFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (!file.name.toLowerCase().endsWith('.ifc')) {
        ifcError.value = 'El archivo debe tener extensión .ifc';
        ifcState.value = 'ERROR';
        return;
      }
      ifcFile.value = file;
      ifcState.value = 'SELECTED';
      ifcError.value = '';
      ifcProgress.value = {
        percent: 0,
        stage: '',
        elapsed: '',
        loadedBytes: 0,
        totalBytes: file.size,
        speedBytesPerSec: 0,
        remainingSec: 0,
      };
      input.value = '';
    }
  }

  function cancelIfcConversion() {
    if (ifcAbortController) {
      ifcAbortController.abort();
      ifcAbortController = null;
    }
    ifcState.value = 'CANCELLED';
    isConvertingIfc.value = false;
  }

  function retryIfcConversion() {
    startIfcConversion();
  }

  async function startIfcConversion() {
    if (!ifcFile.value || !activeProjectForModel.value || isConvertingIfc.value) return;
  
    isConvertingIfc.value = true;
    ifcState.value = 'UPLOADING';
    ifcError.value = '';
    ifcConversionSuccess.value = false;
    ifcAbortController = new AbortController();
  
    try {
      const result = await convertIfcViaBackend(
        ifcFile.value,
        (progress) => {
          if (progress.phase === 'uploading') ifcState.value = 'UPLOADING';
          else if (progress.phase === 'uploaded') ifcState.value = 'UPLOADED';
          else if (progress.phase === 'processing') ifcState.value = 'PROCESSING';
          else if (progress.phase === 'completed') ifcState.value = 'COMPLETED';
          ifcProgress.value = { ...progress };
        },
        activeProjectForModel.value.id,
        ifcAbortController.signal,
        { downloadResult: false }
      );
  
      ifcState.value = 'COMPLETED';
      ifcConversionSuccess.value = true;
      setFeedback(`Modelo procesado (${result.parts.length} partes incorporadas).`);
      await loadProjects();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        ifcState.value = 'CANCELLED';
      } else {
        ifcState.value = 'ERROR';
        ifcError.value = err.message || 'Error durante la conversión.';
      }
    } finally {
      isConvertingIfc.value = false;
      ifcAbortController = null;
    }
  }

  function onFragFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (!file.name.toLowerCase().endsWith('.frag')) {
        fragError.value = 'El archivo debe tener extensión .frag';
        fragState.value = 'ERROR';
        return;
      }
      fragFile.value = file;
      fragState.value = 'SELECTED';
      fragError.value = '';
      fragProgress.value = {
        percent: 0,
        stage: '',
        loadedBytes: 0,
        totalBytes: file.size,
        speedBytesPerSec: 0,
        remainingSec: 0,
      };
      input.value = '';
    }
  }

  function cancelFragUpload() {
    if (fragAbortController) {
      fragAbortController.abort();
      fragAbortController = null;
    }
    fragState.value = 'CANCELLED';
  }

  async function startFragUpload() {
    if (!fragFile.value || !activeProjectForModel.value || fragState.value === 'UPLOADING') return;
  
    fragState.value = 'UPLOADING';
    fragError.value = '';
    fragUploadSuccess.value = false;
    fragAbortController = new AbortController();
  
    try {
      const model = await uploadDirectFrag(
        activeProjectForModel.value.id,
        fragFile.value,
        (progress: any) => {
          if (progress.phase === 'uploading') fragState.value = 'UPLOADING';
          else if (progress.phase === 'uploaded') fragState.value = 'UPLOADED';
          else if (progress.phase === 'completed') fragState.value = 'COMPLETED';
          fragProgress.value = { ...progress };
        },
        fragAbortController.signal
      );
  
      fragState.value = 'COMPLETED';
      fragUploadSuccess.value = true;
      setFeedback(`Modelo FRAG "${model.name}" subido con éxito.`);
      await loadProjects();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        fragState.value = 'CANCELLED';
      } else {
        fragState.value = 'ERROR';
        fragError.value = err.message || 'Error al subir fragmento.';
      }
    } finally {
      fragAbortController = null;
    }
  }

  function openActiveProjectInViewer() {
    if (!activeProjectForModel.value) return;
    const current = projectsList.value.find((p) => p.id === activeProjectForModel.value!.id) || activeProjectForModel.value;
    showAddModelModal.value = false;
    handleOpenProject(current);
  }

  // Modal Admin
  const isAdminModalOpen = ref(false);

  function openAdminModal(tab: 'users' | 'create') {
    isAdminModalOpen.value = true;
  }

  function onAdminModalClose() {
    loadProjects();
  }

  onMounted(() => {
    loadProjects();
  });

  return {
    ref,
    computed,
    onMounted,
    watch,
    fetchBackendProjects,
    fetchBackendModels,
    createBackendProject,
    updateBackendProject,
    deleteBackendProject,
    uploadDirectFrag,
    convertIfcViaBackend,
    appendProjectFragments,
    currentUser,
    isAdmin,
    logout,
    adminFetchUsersPage,
    appLogger,
    AdminPanelModal,
    IfcUploadProgress,
    currentNav,
    navLabels,
    projectsList,
    backendModelsList,
    usersList,
    usersPagination,
    systemLogs,
    isLoading,
    isSubmitting,
    searchQuery,
    filterStatus,
    sortBy,
    feedbackMessage,
    feedbackType,
    toastMessage,
    toastVisible,
    showToast,
    setFeedback,
    settings,
    saveSettings,
    totalModelsCount,
    convertedCount,
    recentProjects,
    recentActivity,
    allProjectModels,
    filteredProjects,
    resetFilters,
    formatDate,
    handleOpenProject,
    handleViewModelInViewer,
    handleUploadIfcShortcut,
    handleLogout,
    loadProjects,
    loadUsers,
    goToUsersPage,
    refreshLogs,
    showLogDetail,
    getActivityGlyph,
    showCreateModal,
    createForm,
    createModelFile,
    createFileInputRef,
    createModelState,
    createModelError,
    createModelProgress,
    createModelAbortController,
    createdProjectForModel,
    onCreateFileSelected,
    cancelCreateModelUpload,
    retryCreateModelUpload,
    openCreateModal,
    submitCreateProject,
    showEditModal,
    editingProject,
    editForm,
    openEditModal,
    submitUpdateProject,
    showDeleteModal,
    projectToDelete,
    promptDeleteProject,
    submitDeleteProject,
    showAddModelModal,
    activeProjectForModel,
    activeModelTab,
    ifcFile,
    ifcInputRef,
    ifcState,
    isConvertingIfc,
    ifcProgress,
    ifcAbortController,
    ifcConversionSuccess,
    ifcError,
    fragFile,
    fragInputRef,
    fragState,
    fragError,
    fragUploadSuccess,
    fragProgress,
    fragAbortController,
    openAddModelModal,
    onIfcFileSelected,
    cancelIfcConversion,
    retryIfcConversion,
    startIfcConversion,
    onFragFileSelected,
    cancelFragUpload,
    startFragUpload,
    openActiveProjectInViewer,
    isAdminModalOpen,
    openAdminModal,
    onAdminModalClose,
  };
}
