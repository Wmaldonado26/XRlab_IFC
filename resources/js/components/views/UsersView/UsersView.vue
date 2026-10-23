

<script setup lang="ts">
import { useUsersView } from './UsersView.logic';
const emit = defineEmits(["show-toast"]);
const { ref, computed, onMounted, adminCreateUser, adminUpdateUser, adminDeleteUser, adminUpdateUserProjects, currentUser, fetchBackendProjects, users, projects, isLoading, searchQuery, roleFilter, statusFilter, pagination, isCreateModalOpen, isEditModalOpen, isAssignModalOpen, selectedUser, createForm, editForm, tempAssignedProjectIds, isSaving, loadData, filteredUsers, goToPage, getInitials, formatDate, openCreateModal, handleCreateUser, openEditModal, handleUpdateUser, openAssignModal, handleSaveAssignments, handleDeleteUser } = useUsersView(emit);
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
      <div v-if="pagination.total > 0" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 16px">
        <small style="color: #8996aa">
          Página {{ pagination.currentPage }} de {{ pagination.lastPage }} · {{ pagination.total }} usuarios
        </small>
        <div style="display: flex; gap: 8px">
          <button class="secondary-btn" :disabled="pagination.currentPage <= 1 || isLoading" @click="goToPage(pagination.currentPage - 1)">
            Anterior
          </button>
          <button class="secondary-btn" :disabled="pagination.currentPage >= pagination.lastPage || isLoading" @click="goToPage(pagination.currentPage + 1)">
            Siguiente
          </button>
        </div>
      </div>
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
            <input v-model="createForm.password" type="password" autocomplete="new-password" minlength="12" placeholder="Mínimo 12 caracteres">
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
            <input v-model="editForm.password" type="password" autocomplete="new-password" minlength="12" placeholder="Dejar en blanco para conservar">
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
<style src="./UsersView.css"></style>
