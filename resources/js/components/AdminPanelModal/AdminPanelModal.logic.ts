import { ref, onMounted, watch } from 'vue';

import {
  adminFetchUsersPage,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminUpdateUserProjects,
  currentUser,
  type AdminUserItem,
  type AdminUsersPagination,
} from '../../services/auth-service';

import { fetchBackendProjects, type BackendProject } from '../../services/backend-client';

export function useAdminPanelModal<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(props: TProps, emit: (...args: any[]) => any) {
  const activeTab = ref<'users' | 'create'>('users');

  const usersList = ref<AdminUserItem[]>([]);

  const pagination = ref<AdminUsersPagination>({
    currentPage: 1,
    lastPage: 1,
    perPage: 25,
    total: 0,
  });

  const availableProjects = ref<BackendProject[]>([]);

  const isLoadingUsers = ref(false);

  const isSubmitting = ref(false);

  const searchQuery = ref('');

  // Feedback banner
  const feedbackMessage = ref('');

  const feedbackType = ref<'success' | 'error'>('success');

  function setFeedback(msg: string, type: 'success' | 'error' = 'success') {
    feedbackMessage.value = msg;
    feedbackType.value = type;
  }

  function clearFeedback() {
    feedbackMessage.value = '';
  }

  // Form state: Create User
  const createForm = ref({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    isActive: true,
    assignedProjectIds: [] as string[],
  });

  function resetCreateForm() {
    createForm.value = {
      name: '',
      email: '',
      password: '',
      role: 'user',
      isActive: true,
      assignedProjectIds: [],
    };
  }

  // Form state: Edit User
  const showEditModal = ref(false);

  const editingUser = ref<AdminUserItem | null>(null);

  const editForm = ref({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    isActive: true,
  });

  // Modal state: Assign Projects
  const showAssignmentModal = ref(false);

  const selectedUserForAssignment = ref<AdminUserItem | null>(null);

  const tempAssignedProjectIds = ref<string[]>([]);

  async function loadUsers(page = pagination.value.currentPage) {
    isLoadingUsers.value = true;
    try {
      const result = await adminFetchUsersPage({ query: searchQuery.value, page });
      usersList.value = result.users;
      pagination.value = result.pagination;

      if (page > pagination.value.lastPage && pagination.value.lastPage > 0) {
        await loadUsers(pagination.value.lastPage);
      }
    } catch (err: any) {
      setFeedback(err.message || 'Error cargando usuarios.', 'error');
    } finally {
      isLoadingUsers.value = false;
    }
  }

  async function loadProjects() {
    try {
      availableProjects.value = await fetchBackendProjects();
    } catch (err) {
      console.warn('Error loading available projects for admin:', err);
    }
  }

  let searchDebounce: any = null;

  function onSearchInput() {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      void loadUsers(1);
    }, 250);
  }

  function goToUsersPage(page: number) {
    if (page >= 1 && page <= pagination.value.lastPage && page !== pagination.value.currentPage) {
      void loadUsers(page);
    }
  }

  function formatDate(ts: number): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  async function handleCreateUser() {
    if (!createForm.value.name || !createForm.value.email || !createForm.value.password) {
      setFeedback('Por favor complete los campos requeridos.', 'error');
      return;
    }
  
    isSubmitting.value = true;
    try {
      const newUser = await adminCreateUser({
        name: createForm.value.name,
        email: createForm.value.email,
        password: createForm.value.password,
        role: createForm.value.role,
        isActive: createForm.value.isActive,
        assignedProjectIds: createForm.value.assignedProjectIds,
      });
  
      setFeedback(`Usuario "${newUser.name}" creado con éxito.`);
      resetCreateForm();
      activeTab.value = 'users';
      await loadUsers();
    } catch (err: any) {
      setFeedback(err.message || 'Error al crear el usuario.', 'error');
    } finally {
      isSubmitting.value = false;
    }
  }

  function openEditUserModal(user: AdminUserItem) {
    editingUser.value = user;
    editForm.value = {
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      isActive: user.isActive,
    };
    showEditModal.value = true;
  }

  async function handleUpdateUser() {
    if (!editingUser.value) return;
  
    isSubmitting.value = true;
    try {
      const payload: any = {
        name: editForm.value.name,
        email: editForm.value.email,
        role: editForm.value.role,
        isActive: editForm.value.isActive,
      };
      if (editForm.value.password) {
        payload.password = editForm.value.password;
      }
  
      await adminUpdateUser(editingUser.value.id, payload);
      setFeedback(`Usuario "${editForm.value.name}" actualizado.`);
      showEditModal.value = false;
      await loadUsers();
    } catch (err: any) {
      setFeedback(err.message || 'Error al actualizar usuario.', 'error');
    } finally {
      isSubmitting.value = false;
    }
  }

  async function toggleUserActive(user: AdminUserItem) {
    try {
      await adminUpdateUser(user.id, {
        isActive: !user.isActive,
      });
      setFeedback(`Cuenta ${user.isActive ? 'desactivada' : 'activada'} correctamente.`);
      await loadUsers();
    } catch (err: any) {
      setFeedback(err.message || 'Error al cambiar estado del usuario.', 'error');
    }
  }

  async function confirmDeleteUser(user: AdminUserItem) {
    if (user.id === currentUser.value?.id) {
      setFeedback('No puede eliminar su propia cuenta de usuario en sesión.', 'error');
      return;
    }
  
    const ok = confirm(`¿Está seguro de que desea eliminar permanentemente al usuario "${user.name}" (${user.email})?`);
    if (!ok) return;
  
    try {
      await adminDeleteUser(user.id);
      setFeedback(`Usuario "${user.name}" eliminado.`);
      await loadUsers();
    } catch (err: any) {
      setFeedback(err.message || 'Error al eliminar usuario.', 'error');
    }
  }

  function openProjectsAssignment(user: AdminUserItem) {
    selectedUserForAssignment.value = user;
    tempAssignedProjectIds.value = [...(user.assignedProjectIds || [])];
    showAssignmentModal.value = true;
  }

  async function saveProjectAssignments() {
    if (!selectedUserForAssignment.value) return;
  
    isSubmitting.value = true;
    try {
      const updated = await adminUpdateUserProjects(
        selectedUserForAssignment.value.id,
        tempAssignedProjectIds.value
      );
      selectedUserForAssignment.value.assignedProjectIds = updated;
      selectedUserForAssignment.value.assignedProjectsCount = updated.length;
      setFeedback(`Permisos de proyecto actualizados para "${selectedUserForAssignment.value.name}".`);
      showAssignmentModal.value = false;
      await loadUsers();
    } catch (err: any) {
      setFeedback(err.message || 'Error asignando proyectos.', 'error');
    } finally {
      isSubmitting.value = false;
    }
  }

  watch(
    () => props.modelValue,
    (val) => {
      if (val) {
        loadUsers();
        loadProjects();
      }
    }
  );

  onMounted(() => {
    if (props.modelValue) {
      loadUsers();
      loadProjects();
    }
  });

  return {
    ref,
    onMounted,
    watch,
    adminCreateUser,
    adminUpdateUser,
    adminDeleteUser,
    adminUpdateUserProjects,
    currentUser,
    fetchBackendProjects,
    activeTab,
    usersList,
    pagination,
    availableProjects,
    isLoadingUsers,
    isSubmitting,
    searchQuery,
    feedbackMessage,
    feedbackType,
    setFeedback,
    clearFeedback,
    createForm,
    resetCreateForm,
    showEditModal,
    editingUser,
    editForm,
    showAssignmentModal,
    selectedUserForAssignment,
    tempAssignedProjectIds,
    loadUsers,
    goToUsersPage,
    loadProjects,
    searchDebounce,
    onSearchInput,
    formatDate,
    handleCreateUser,
    openEditUserModal,
    handleUpdateUser,
    toggleUserActive,
    confirmDeleteUser,
    openProjectsAssignment,
    saveProjectAssignments,
  };
}
