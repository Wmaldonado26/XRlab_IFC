<script setup lang="ts">
import { useAdminPanelModal } from './AdminPanelModal.logic';
const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits(["update:model-value", "update:modelValue"]);
const { ref, onMounted, watch, adminCreateUser, adminUpdateUser, adminDeleteUser, adminUpdateUserProjects, currentUser, fetchBackendProjects, activeTab, usersList, pagination, availableProjects, isLoadingUsers, isSubmitting, searchQuery, feedbackMessage, feedbackType, setFeedback, clearFeedback, createForm, resetCreateForm, showEditModal, editingUser, editForm, showAssignmentModal, selectedUserForAssignment, tempAssignedProjectIds, loadUsers, goToUsersPage, loadProjects, onSearchInput, formatDate, handleCreateUser, openEditUserModal, handleUpdateUser, toggleUserActive, confirmDeleteUser, openProjectsAssignment, saveProjectAssignments } = useAdminPanelModal(props, emit);
</script>

<template>
  <div v-if="modelValue" class="modal-backdrop" @click.self="$emit('update:modelValue', false)">
    <div class="admin-card">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-left">
          <span class="header-icon">🛡️</span>
          <div>
            <h3 class="modal-title">Panel de Administración de Usuarios</h3>
            <p class="modal-subtitle">Gestión de identidades, roles y asignación de permisos por proyecto</p>
          </div>
        </div>
        <button
          type="button"
          class="close-btn"
          title="Cerrar (Esc)"
          @click="$emit('update:modelValue', false)"
        >
          ✕
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="tab-bar">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'users' }"
          @click="activeTab = 'users'; clearFeedback()"
        >
          👥 Usuarios ({{ pagination.total }})
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'create' }"
          @click="activeTab = 'create'; resetCreateForm(); clearFeedback()"
        >
          ➕ Crear Usuario
        </button>
      </div>

      <!-- Toast Feedback Banner -->
      <div v-if="feedbackMessage" class="feedback-banner" :class="feedbackType">
        <span>{{ feedbackMessage }}</span>
        <button type="button" class="dismiss-btn" @click="feedbackMessage = ''">✕</button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        <!-- ========================================== -->
        <!-- TAB 1: LISTADO DE USUARIOS                 -->
        <!-- ========================================== -->
        <div v-if="activeTab === 'users'" class="tab-content">
          <div class="tab-toolbar">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Buscar por nombre o correo..."
                class="search-input"
                @input="onSearchInput"
              />
              <button
                v-if="searchQuery"
                type="button"
                class="clear-search-btn"
                @click="searchQuery = ''; loadUsers(1)"
              >
                ✕
              </button>
            </div>
            <div class="toolbar-actions">
              <button type="button" class="refresh-btn-sm" title="Recargar usuarios" @click="loadUsers()">
                🔄
              </button>
            </div>
          </div>

          <div v-if="isLoadingUsers" class="loading-state">
            <div class="spinner"></div>
            <p>Cargando usuarios desde SQLite...</p>
          </div>

          <div v-else-if="usersList.length === 0" class="empty-state">
            <span class="empty-icon">👤</span>
            <p v-if="searchQuery">No se encontraron usuarios coincidentes con "{{ searchQuery }}".</p>
            <p v-else>No hay usuarios registrados en el sistema.</p>
          </div>

          <div v-else class="users-table-wrapper">
            <table class="users-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Proyectos Asignados</th>
                  <th>Fecha Alta</th>
                  <th class="actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in usersList" :key="user.id" :class="{ 'row-self': user.id === currentUser?.id }">
                  <td>
                    <div class="user-cell">
                      <div class="user-avatar" :class="user.role">
                        {{ user.name.charAt(0).toUpperCase() }}
                      </div>
                      <div class="user-details">
                        <span class="user-name">
                          {{ user.name }}
                          <span v-if="user.id === currentUser?.id" class="self-tag">(Tú)</span>
                        </span>
                        <span class="user-email">{{ user.email }}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="role-badge" :class="user.role">
                      {{ user.role === 'admin' ? '⭐ Administrador' : '👤 Usuario Normal' }}
                    </span>
                  </td>
                  <td>
                    <span class="status-badge" :class="user.isActive ? 'active' : 'inactive'">
                      {{ user.isActive ? '● Activo' : '○ Inactivo' }}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      class="projects-badge-btn"
                      title="Gestionar proyectos asignados"
                      @click="openProjectsAssignment(user)"
                    >
                      <span class="projects-count">{{ user.assignedProjectsCount }}</span>
                      <span>proyectos</span>
                      <span class="edit-icon">✏️</span>
                    </button>
                  </td>
                  <td class="date-cell">
                    {{ formatDate(user.createdAt) }}
                  </td>
                  <td class="actions-col">
                    <div class="action-buttons">
                      <button
                        type="button"
                        class="action-btn edit"
                        title="Editar datos de usuario"
                        @click="openEditUserModal(user)"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        class="action-btn toggle"
                        :title="user.isActive ? 'Desactivar cuenta' : 'Activar cuenta'"
                        :disabled="user.id === currentUser?.id"
                        @click="toggleUserActive(user)"
                      >
                        {{ user.isActive ? '⏸️' : '▶️' }}
                      </button>
                      <button
                        type="button"
                        class="action-btn delete"
                        title="Eliminar usuario"
                        :disabled="user.id === currentUser?.id"
                        @click="confirmDeleteUser(user)"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="pagination.total > 0" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 4px">
            <small style="color: var(--muted)">
              Página {{ pagination.currentPage }} de {{ pagination.lastPage }} · {{ pagination.total }} usuarios
            </small>
            <div style="display: flex; gap: 8px">
              <button type="button" class="refresh-btn-sm" :disabled="pagination.currentPage <= 1 || isLoadingUsers" @click="goToUsersPage(pagination.currentPage - 1)">
                Anterior
              </button>
              <button type="button" class="refresh-btn-sm" :disabled="pagination.currentPage >= pagination.lastPage || isLoadingUsers" @click="goToUsersPage(pagination.currentPage + 1)">
                Siguiente
              </button>
            </div>
          </div>
        </div>

        <!-- ========================================== -->
        <!-- TAB 2: CREAR USUARIO                       -->
        <!-- ========================================== -->
        <div v-if="activeTab === 'create'" class="tab-content">
          <form class="admin-form" @submit.prevent="handleCreateUser">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="create-name">Nombre Completo *</label>
                <input
                  id="create-name"
                  v-model="createForm.name"
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label class="form-label" for="create-email">Correo Electrónico *</label>
                <input
                  id="create-email"
                  v-model="createForm.email"
                  type="email"
                  required
                  placeholder="juan.perez@empresa.com"
                  class="form-input"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="create-password">Contraseña Inicial *</label>
                <input
                  id="create-password"
                  v-model="createForm.password"
                  type="password"
                  autocomplete="new-password"
                  required
                  minlength="12"
                  placeholder="Mínimo 12 caracteres"
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label class="form-label" for="create-role">Rol en el Sistema *</label>
                <select id="create-role" v-model="createForm.role" class="form-select">
                  <option value="user">Usuario Normal (Solo proyectos asignados)</option>
                  <option value="admin">Administrador (Control total)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-checkbox-label">
                <input v-model="createForm.isActive" type="checkbox" />
                <span>Cuenta activa inmediatamente</span>
              </label>
            </div>

            <!-- Proyectos asignables -->
            <div class="form-group project-select-section">
              <label class="form-label">Asignar Proyectos Iniciales</label>
              <div v-if="availableProjects.length === 0" class="empty-hint-sm">
                No hay proyectos registrados en SQLite aún.
              </div>
              <div v-else class="project-checkbox-list">
                <label
                  v-for="project in availableProjects"
                  :key="project.id"
                  class="project-checkbox-item"
                >
                  <input
                    v-model="createForm.assignedProjectIds"
                    type="checkbox"
                    :value="project.id"
                  />
                  <div class="project-check-meta">
                    <span class="project-check-name">{{ project.name }}</span>
                    <span class="project-check-sub">{{ project.modelsCount }} modelo(s) | {{ project.totalPartsSizeMB }} MB</span>
                  </div>
                </label>
              </div>
            </div>

            <div class="form-actions">
              <button
                type="button"
                class="secondary-btn"
                @click="activeTab = 'users'"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="primary-btn"
                :disabled="isSubmitting"
              >
                <span v-if="isSubmitting" class="spinner-sm"></span>
                <span v-else>💾 Guardar Nuevo Usuario</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ========================================== -->
      <!-- MODAL AUX: ASIGNAR PROYECTOS               -->
      <!-- ========================================== -->
      <div v-if="showAssignmentModal && selectedUserForAssignment" class="sub-modal-backdrop" @click.self="showAssignmentModal = false">
        <div class="sub-modal-card">
          <div class="sub-modal-header">
            <h4>Asignar Proyectos a {{ selectedUserForAssignment.name }}</h4>
            <button type="button" class="close-btn-sm" @click="showAssignmentModal = false">✕</button>
          </div>
          <p class="sub-modal-desc">
            Los usuarios con rol <strong>Usuario Normal</strong> únicamente podrán visualizar y abrir los proyectos marcados a continuación:
          </p>

          <div class="assignment-project-list">
            <div v-if="availableProjects.length === 0" class="empty-state-sm">
              No hay proyectos creados en el sistema.
            </div>
            <label
              v-for="project in availableProjects"
              :key="project.id"
              class="assignment-item"
            >
              <input
                v-model="tempAssignedProjectIds"
                type="checkbox"
                :value="project.id"
              />
              <div class="assignment-info">
                <span class="assignment-name">{{ project.name }}</span>
                <span class="assignment-desc">{{ project.description || 'Sin descripción' }}</span>
              </div>
              <span class="models-badge">{{ project.modelsCount }} modelos</span>
            </label>
          </div>

          <div class="sub-modal-actions">
            <button type="button" class="secondary-btn-sm" @click="showAssignmentModal = false">
              Cancelar
            </button>
            <button
              type="button"
              class="primary-btn-sm"
              :disabled="isSubmitting"
              @click="saveProjectAssignments"
            >
              <span v-if="isSubmitting" class="spinner-sm"></span>
              <span v-else>Guardar Asignaciones</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ========================================== -->
      <!-- MODAL AUX: EDITAR USUARIO                  -->
      <!-- ========================================== -->
      <div v-if="showEditModal && editingUser" class="sub-modal-backdrop" @click.self="showEditModal = false">
        <div class="sub-modal-card">
          <div class="sub-modal-header">
            <h4>Editar Usuario: {{ editingUser.name }}</h4>
            <button type="button" class="close-btn-sm" @click="showEditModal = false">✕</button>
          </div>

          <form @submit.prevent="handleUpdateUser">
            <div class="form-group">
              <label class="form-label" for="edit-name">Nombre</label>
              <input
                id="edit-name"
                v-model="editForm.name"
                type="text"
                required
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-email">Correo Electrónico</label>
              <input
                id="edit-email"
                v-model="editForm.email"
                type="email"
                required
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-password">Nueva Contraseña (Opcional)</label>
              <input
                id="edit-password"
                v-model="editForm.password"
                type="password"
                autocomplete="new-password"
                minlength="12"
                placeholder="Dejar en blanco para conservar la actual"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-role">Rol</label>
              <select id="edit-role" v-model="editForm.role" class="form-select">
                <option value="user">Usuario Normal</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-checkbox-label">
                <input v-model="editForm.isActive" type="checkbox" />
                <span>Cuenta activa</span>
              </label>
            </div>

            <div class="sub-modal-actions">
              <button type="button" class="secondary-btn-sm" @click="showEditModal = false">
                Cancelar
              </button>
              <button type="submit" class="primary-btn-sm" :disabled="isSubmitting">
                <span v-if="isSubmitting" class="spinner-sm"></span>
                <span v-else>Guardar Cambios</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped src="./AdminPanelModal.css"></style>




