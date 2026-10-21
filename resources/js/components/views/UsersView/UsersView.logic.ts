import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

import {
  adminFetchUsersPage,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminUpdateUserProjects,
  currentUser,
  type AdminUserItem,
  type AdminUsersPagination,
} from '../../../services/auth-service';

import {
  fetchBackendProjects,
  type BackendProject,
} from '../../../services/backend-client';

export function useUsersView<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(emit: (...args: any[]) => any) {
  const users = ref<AdminUserItem[]>([]);

  const projects = ref<BackendProject[]>([]);

  const isLoading = ref(true);

  const pagination = ref<AdminUsersPagination>({
    currentPage: 1,
    lastPage: 1,
    perPage: 25,
    total: 0,
  });

  const searchQuery = ref('');

  const roleFilter = ref('all');

  const statusFilter = ref('all');

  // Modals
  const isCreateModalOpen = ref(false);

  const isEditModalOpen = ref(false);

  const isAssignModalOpen = ref(false);

  const selectedUser = ref<AdminUserItem | null>(null);

  // Forms
  const createForm = ref({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    isActive: true,
    assignedProjectIds: [] as string[],
  });

  const editForm = ref({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    isActive: true,
  });

  const tempAssignedProjectIds = ref<string[]>([]);

  const isSaving = ref(false);

  let searchDebounce: ReturnType<typeof setTimeout> | null = null;

  async function loadData(page = pagination.value.currentPage) {
    isLoading.value = true;
    try {
      const [fetchedUsers, fetchedProjects] = await Promise.all([
        adminFetchUsersPage({
          query: searchQuery.value,
          role: roleFilter.value as 'all' | 'admin' | 'user',
          status: statusFilter.value as 'all' | 'active' | 'inactive',
          page,
        }),
        fetchBackendProjects(),
      ]);
      if (page > fetchedUsers.pagination.lastPage && fetchedUsers.pagination.lastPage > 0) {
        await loadData(fetchedUsers.pagination.lastPage);
        return;
      }
      users.value = fetchedUsers.users;
      pagination.value = fetchedUsers.pagination;
      projects.value = fetchedProjects;
    } catch (err: any) {
      emit('show-toast', err.message || 'Error cargando usuarios');
    } finally {
      isLoading.value = false;
    }
  }

  const filteredUsers = computed(() => users.value);

  function goToPage(page: number) {
    if (page >= 1 && page <= pagination.value.lastPage && page !== pagination.value.currentPage) {
      void loadData(page);
    }
  }

  function getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  function formatDate(ts?: number): string {
    if (!ts) return 'Sin acceso';
    return new Date(ts).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function openCreateModal() {
    createForm.value = {
      name: '',
      email: '',
      password: '',
      role: 'user',
      isActive: true,
      assignedProjectIds: [],
    };
    isCreateModalOpen.value = true;
  }

  async function handleCreateUser() {
    if (!createForm.value.name || !createForm.value.email || !createForm.value.password) {
      emit('show-toast', 'Por favor llena todos los campos obligatorios');
      return;
    }
    isSaving.value = true;
    try {
      await adminCreateUser(createForm.value);
      emit('show-toast', 'Usuario creado correctamente');
      isCreateModalOpen.value = false;
      await loadData();
    } catch (err: any) {
      emit('show-toast', `Error: ${err.message}`);
    } finally {
      isSaving.value = false;
    }
  }

  function openEditModal(u: AdminUserItem) {
    selectedUser.value = u;
    editForm.value = {
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      isActive: u.isActive,
    };
    isEditModalOpen.value = true;
  }

  async function handleUpdateUser() {
    if (!selectedUser.value) return;
    isSaving.value = true;
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
      await adminUpdateUser(selectedUser.value.id, payload);
      emit('show-toast', 'Usuario actualizado');
      isEditModalOpen.value = false;
      await loadData();
    } catch (err: any) {
      emit('show-toast', `Error: ${err.message}`);
    } finally {
      isSaving.value = false;
    }
  }

  function openAssignModal(u: AdminUserItem) {
    selectedUser.value = u;
    tempAssignedProjectIds.value = [...(u.assignedProjectIds || [])];
    isAssignModalOpen.value = true;
  }

  async function handleSaveAssignments() {
    if (!selectedUser.value) return;
    isSaving.value = true;
    try {
      await adminUpdateUserProjects(selectedUser.value.id, tempAssignedProjectIds.value);
      emit('show-toast', 'Proyectos asignados actualizados');
      isAssignModalOpen.value = false;
      await loadData();
    } catch (err: any) {
      emit('show-toast', `Error: ${err.message}`);
    } finally {
      isSaving.value = false;
    }
  }

  async function handleDeleteUser(u: AdminUserItem) {
    if (confirm(`¿Estás seguro de eliminar el usuario "${u.name}"?`)) {
      try {
        await adminDeleteUser(u.id);
        emit('show-toast', 'Usuario eliminado');
        await loadData();
      } catch (err: any) {
        emit('show-toast', `Error: ${err.message}`);
      }
    }
  }

  watch([searchQuery, roleFilter, statusFilter], () => {
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => void loadData(1), 250);
  });

  onMounted(() => {
    void loadData(1);
  });

  onUnmounted(() => {
    if (searchDebounce) clearTimeout(searchDebounce);
  });

  return {
    ref,
    computed,
    onMounted,
    adminCreateUser,
    adminUpdateUser,
    adminDeleteUser,
    adminUpdateUserProjects,
    currentUser,
    fetchBackendProjects,
    users,
    pagination,
    projects,
    isLoading,
    searchQuery,
    roleFilter,
    statusFilter,
    isCreateModalOpen,
    isEditModalOpen,
    isAssignModalOpen,
    selectedUser,
    createForm,
    editForm,
    tempAssignedProjectIds,
    isSaving,
    loadData,
    filteredUsers,
    goToPage,
    getInitials,
    formatDate,
    openCreateModal,
    handleCreateUser,
    openEditModal,
    handleUpdateUser,
    openAssignModal,
    handleSaveAssignments,
    handleDeleteUser,
  };
}
