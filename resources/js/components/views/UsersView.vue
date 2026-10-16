<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  adminFetchUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminUpdateUserProjects,
  currentUser,
  type AdminUserItem,
} from '../../services/auth-service';
import {
  fetchBackendProjects,
  type BackendProject,
} from '../../services/backend-client';

const emit = defineEmits<{
  (e: 'show-toast', message: string): void;
}>();

const users = ref<AdminUserItem[]>([]);
const projects = ref<BackendProject[]>([]);
const isLoading = ref(true);
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

async function loadData() {
  isLoading.value = true;
  try {
    const [fetchedUsers, fetchedProjects] = await Promise.all([
      adminFetchUsers(searchQuery.value),
      fetchBackendProjects(),
    ]);
    users.value = fetchedUsers;
    projects.value = fetchedProjects;
  } catch (err: any) {
    emit('show-toast', err.message || 'Error cargando usuarios');
  } finally {
    isLoading.value = false;
  }
}

const filteredUsers = computed(() => {
  return users.value.filter((u) => {
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      if (!matchName && !matchEmail) return false;
    }
    if (roleFilter.value !== 'all' && u.role !== roleFilter.value) {
      return false;
    }
    if (statusFilter.value === 'active' && !u.isActive) return false;
    if (statusFilter.value === 'inactive' && u.isActive) return false;
    return true;
  });
});

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

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Gestión de usuarios</h1>
        <p>Administra cuentas, roles y acceso a proyectos.</p>
      </div>
      <button class="primary-btn" @click="openCreateModal">
        + Nuevo usuario
      </button>
    </div>

    <div class="toolbar">
      <input
        v-model="searchQuery"
        class="search"
        placeholder="⌕  Buscar por nombre o correo"
      >
      <div style="display: flex; gap: 8px">
        <select v-model="roleFilter" style="max-width: 170px">
          <option value="all">Todos los roles</option>
          <option value="admin">Administrador</option>
          <option value="user">Ingeniero / Usuario</option>
        </select>
        <select v-model="statusFilter" style="max-width: 150px">
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>
    </div>

    <div v-if="isLoading" class="panel" style="padding: 40px; text-align: center; color: var(--muted)">
      Cargando usuarios...
    </div>

    <div v-else-if="filteredUsers.length === 0" class="panel" style="padding: 50px; text-align: center">
      <div style="font-size: 32px; margin-bottom: 12px">♙</div>
      <h3 style="margin: 0 0 8px">No se encontraron usuarios</h3>
      <p style="color: var(--muted); font-size: 13px">Prueba modificando los filtros de búsqueda.</p>
    </div>

    <div v-else class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Proyectos Asignados</th>
            <th>Estado</th>
            <th>Fecha Alta</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in filteredUsers" :key="u.id">
            <td>
              <div class="user-cell">
                <div class="avatar" :class="u.role === 'admin' ? 'gold' : 'blue'">
                  {{ getInitials(u.name) }}
                </div>
                <div>
                  <b>{{ u.name }}</b>
                  <br>
                  <small style="color: #8996aa">{{ u.email }}</small>
                </div>
              </div>
            </td>
            <td>
              <span class="role" :style="u.role === 'admin' ? 'background: #fff3d9; color: #a06a05' : ''">
                {{ u.role === 'admin' ? 'Administrador' : 'Ingeniero / Usuario' }}
              </span>
            </td>
            <td>
              <button
                class="secondary-btn"
                style="padding: 4px 10px; font-size: 11px"
                @click="openAssignModal(u)"
              >
                {{ (u.assignedProjectIds && u.assignedProjectIds.length) || 0 }} proyectos ⚙
              </button>
            </td>
            <td>
              <span v-if="u.isActive" class="status ok">Activo</span>
              <span v-else class="status err">Inactivo</span>
            </td>
            <td>{{ formatDate(u.createdAt) }}</td>
            <td class="actions-mini">
              <button title="Editar" @click="openEditModal(u)">✎</button>
              <button
                v-if="u.id !== currentUser?.id"
                title="Eliminar"
                style="color: var(--danger)"
                @click="handleDeleteUser(u)"
              >
                🗑
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL CREAR USUARIO -->
    <div v-if="isCreateModalOpen" class="modal-backdrop open" @click.self="isCreateModalOpen = false">
      <div class="modal">
        <div class="modal-head">
          <h3>Nuevo usuario</h3>
          <button class="close" @click="isCreateModalOpen = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nombre completo</label>
            <input v-model="createForm.name" placeholder="Nombre y apellidos">
          </div>
          <div class="form-group">
            <label>Correo corporativo</label>
            <input v-model="createForm.email" type="email" placeholder="usuario@cotecmar.com">
          </div>
          <div class="form-group">
            <label>Contraseña</label>
            <input v-model="createForm.password" type="password" placeholder="••••••••">
          </div>
          <div class="form-group">
            <label>Rol</label>
            <select v-model="createForm.role">
              <option value="user">Ingeniero / Visualizador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div class="form-group">
            <label>Proyectos asignados inicialmente</label>
            <div style="max-height: 140px; overflow-y: auto; border: 1px solid var(--line); border-radius: 9px; padding: 10px">
              <label
                v-for="p in projects"
                :key="p.id"
                style="display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 6px; cursor: pointer"
              >
                <input
                  type="checkbox"
                  :value="p.id"
                  v-model="createForm.assignedProjectIds"
                  style="width: auto"
                >
                {{ p.name }}
              </label>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="secondary-btn" :disabled="isSaving" @click="isCreateModalOpen = false">Cancelar</button>
          <button class="primary-btn" :disabled="isSaving" @click="handleCreateUser">
            {{ isSaving ? 'Guardando...' : 'Crear usuario' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL EDITAR USUARIO -->
    <div v-if="isEditModalOpen" class="modal-backdrop open" @click.self="isEditModalOpen = false">
      <div class="modal">
        <div class="modal-head">
          <h3>Editar usuario</h3>
          <button class="close" @click="isEditModalOpen = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nombre completo</label>
            <input v-model="editForm.name">
          </div>
          <div class="form-group">
            <label>Correo</label>
            <input v-model="editForm.email" type="email">
          </div>
          <div class="form-group">
            <label>Nueva contraseña (dejar en blanco para conservar)</label>
            <input v-model="editForm.password" type="password" placeholder="••••••••">
          </div>
          <div class="form-group">
            <label>Rol</label>
            <select v-model="editForm.role">
              <option value="user">Ingeniero / Visualizador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer">
              <input type="checkbox" v-model="editForm.isActive" style="width: auto">
              Cuenta activa
            </label>
          </div>
        </div>
        <div class="modal-foot">
          <button class="secondary-btn" :disabled="isSaving" @click="isEditModalOpen = false">Cancelar</button>
          <button class="primary-btn" :disabled="isSaving" @click="handleUpdateUser">
            {{ isSaving ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL ASIGNAR PROYECTOS -->
    <div v-if="isAssignModalOpen" class="modal-backdrop open" @click.self="isAssignModalOpen = false">
      <div class="modal">
        <div class="modal-head">
          <h3>Asignar proyectos a {{ selectedUser?.name }}</h3>
          <button class="close" @click="isAssignModalOpen = false">×</button>
        </div>
        <div class="modal-body">
          <p style="font-size: 12px; color: var(--muted); margin: 0 0 15px">
            Selecciona los proyectos a los que tendrá acceso de visualización este usuario:
          </p>
          <div style="max-height: 240px; overflow-y: auto; border: 1px solid var(--line); border-radius: 9px; padding: 12px">
            <label
              v-for="p in projects"
              :key="p.id"
              style="display: flex; align-items: center; gap: 10px; font-size: 13px; margin-bottom: 8px; cursor: pointer"
            >
              <input
                type="checkbox"
                :value="p.id"
                v-model="tempAssignedProjectIds"
                style="width: auto"
              >
              <b>{{ p.name }}</b>
              <span style="color: var(--muted); font-size: 11px">({{ p.modelsCount || 0 }} modelos)</span>
            </label>
          </div>
        </div>
        <div class="modal-foot">
          <button class="secondary-btn" :disabled="isSaving" @click="isAssignModalOpen = false">Cancelar</button>
          <button class="primary-btn" :disabled="isSaving" @click="handleSaveAssignments">
            {{ isSaving ? 'Guardando...' : 'Guardar asignación' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
