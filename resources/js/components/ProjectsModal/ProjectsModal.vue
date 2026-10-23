<script setup lang="ts">
import { useProjectsModal } from './ProjectsModal.logic';
const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits(["load-backend", "load-cached", "load-model", "loadBackend", "loadCached", "loadModel", "update:modelValue"]);
const { ref, computed, onMounted, watch, listCachedProjects, deleteCachedProject, clearAllCachedProjects, fetchBackendProjects, createBackendProject, updateBackendProject, deleteBackendProject, fetchBackendModels, deleteBackendModel, uploadDirectFrag, isAdmin, activeTab, feedbackMessage, feedbackType, setFeedback, projectsList, projectSearch, isLoadingProjects, expandedProjects, modelsList, modelSearch, selectedProjectFilter, selectedStatusFilter, isLoadingModels, cachedList, showCreateProjectModal, newProjectName, newProjectDesc, newProjectFragFiles, onNewProjectFragSelected, showEditProjectModal, editProjectId, editProjectName, editProjectDesc, showDeleteProjectModal, projectToDelete, showDeleteModelModal, modelToDelete, showModelDetailsModal, selectedModelDetail, refreshProjects, refreshModels, refreshCache, refreshAll, searchDebounceTimer, onProjectSearchChange, onModelFilterChange, filteredModels, toggleProjectDrawer, openCreateProjectModal, submitCreateProject, openEditProjectModal, submitEditProject, promptDeleteProject, confirmDeleteProject, promptDeleteModel, confirmDeleteModel, openModelDetailsModal, onLoadProject, onLoadSingleModel, onLoadCached, onDeleteCached, onClearCache, formatDate } = useProjectsModal(props, emit);
</script>

<template>
  <div v-if="modelValue" class="modal-backdrop" @click.self="$emit('update:modelValue', false)">
    <div class="modal-card">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-left">
          <span class="header-icon">🗂️</span>
          <div>
            <h3 class="modal-title">{{ isAdmin ? 'Catálogo de Proyectos & Modelos FRAG' : 'Mis Proyectos Asignados' }}</h3>
            <p class="modal-subtitle">{{ isAdmin ? 'Almacenamiento persistente SQLite y caché local sin re-conversión' : 'Selecciona un proyecto para abrir sus modelos en el visor 3D' }}</p>
          </div>
        </div>
        <button type="button" class="close-btn" title="Cerrar (Esc)" @click="$emit('update:modelValue', false)">✕</button>
      </div>

      <!-- Navigation Tabs -->
      <div class="tab-bar">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'projects' }"
          @click="activeTab = 'projects'"
        >
          📁 {{ isAdmin ? 'Proyectos SQLite' : 'Mis Proyectos' }} ({{ projectsList.length }})
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'models' }"
          @click="activeTab = 'models'"
        >
          📦 Modelos FRAG ({{ modelsList.length }})
        </button>
        <button
          v-if="isAdmin"
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'cache' }"
          @click="activeTab = 'cache'"
        >
          💾 Caché del Navegador ({{ cachedList.length }})
        </button>
      </div>

      <!-- Notification Toast -->
      <div v-if="feedbackMessage" class="feedback-banner" :class="feedbackType">
        <span>{{ feedbackMessage }}</span>
        <button type="button" class="dismiss-btn" @click="feedbackMessage = ''">✕</button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        <!-- ========================================== -->
        <!-- TAB 1: PROYECTOS SQLITE                   -->
        <!-- ========================================== -->
        <div v-if="activeTab === 'projects'" class="tab-content">
          <div class="tab-toolbar">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input
                v-model="projectSearch"
                type="text"
                placeholder="Buscar proyectos por nombre o descripción..."
                class="search-input"
                @input="onProjectSearchChange"
              />
              <button
                v-if="projectSearch"
                type="button"
                class="clear-search-btn"
                @click="projectSearch = ''; onProjectSearchChange()"
              >
                ✕
              </button>
            </div>
            <div class="toolbar-actions">
              <button v-if="isAdmin" type="button" class="primary-btn-sm" @click="openCreateProjectModal">
                ➕ Nuevo Proyecto
              </button>
              <button type="button" class="refresh-btn-sm" title="Recargar lista" @click="refreshProjects">
                🔄
              </button>
            </div>
          </div>

          <div v-if="isLoadingProjects" class="loading-state">
            <div class="spinner"></div>
            <p>Cargando proyectos desde SQLite...</p>
          </div>

          <div v-else-if="projectsList.length === 0" class="empty-state">
            <span class="empty-icon">📂</span>
            <p v-if="projectSearch">No se encontraron proyectos que coincidan con "{{ projectSearch }}".</p>
            <p v-else-if="!isAdmin">No tienes proyectos asignados actualmente en el sistema.</p>
            <p v-else>No hay proyectos registrados en SQLite.</p>
            <span class="empty-hint">{{ isAdmin ? 'Crea un nuevo proyecto o convierte un archivo IFC para comenzar.' : 'Solicita a un administrador acceso a tus proyectos asignados.' }}</span>
            <button v-if="isAdmin && !projectSearch" type="button" class="primary-btn-sm" style="margin-top: 14px;" @click="openCreateProjectModal">
              ➕ Crear Primer Proyecto
            </button>
          </div>

          <div v-else class="project-grid">
            <div v-for="proj in projectsList" :key="proj.id" class="project-card">
              <div class="project-card-header">
                <div class="project-info">
                  <span class="project-icon">🚢</span>
                  <div class="project-text">
                    <h4 class="project-name" :title="proj.name">{{ proj.name }}</h4>
                    <p v-if="proj.description" class="project-description">{{ proj.description }}</p>
                    <div class="project-meta-badges">
                      <span class="badge badge-models">
                        {{ proj.modelsCount }} {{ proj.modelsCount === 1 ? 'modelo' : 'modelos' }}
                      </span>
                      <span class="badge badge-size">
                        {{ proj.totalPartsSizeMB }} MB
                      </span>
                      <span class="badge badge-date">
                        {{ formatDate(proj.createdAt) }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="project-actions">
                  <button
                    v-if="proj.modelsCount > 0"
                    type="button"
                    class="action-btn load-btn"
                    title="Cargar todas las partes del proyecto en el visor 3D"
                    @click="onLoadProject(proj)"
                  >
                    ⚡ Cargar
                  </button>
                  <button
                    v-if="isAdmin"
                    type="button"
                    class="action-btn edit-btn"
                    title="Renombrar o editar descripción"
                    @click="openEditProjectModal(proj)"
                  >
                    ✏️
                  </button>
                  <button
                    v-if="isAdmin"
                    type="button"
                    class="action-btn delete-btn"
                    title="Eliminar proyecto y sus modelos"
                    @click="promptDeleteProject(proj)"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <!-- Collapsible models sub-list -->
              <div v-if="proj.models && proj.models.length > 0" class="project-models-drawer">
                <button
                  type="button"
                  class="drawer-toggle"
                  @click="toggleProjectDrawer(proj.id)"
                >
                  <span>{{ expandedProjects[proj.id] ? '▲ Ocultar' : '▼ Ver' }} fragmentos asociados ({{ proj.models.length }})</span>
                </button>

                <div v-if="expandedProjects[proj.id]" class="models-sublist">
                  <div v-for="m in proj.models" :key="m.id" class="sub-model-item">
                    <div class="sub-model-info">
                      <span class="sub-icon">📦</span>
                      <span class="sub-name" :title="m.name">{{ m.name }}</span>
                      <span class="sub-size">{{ m.sizeFormatted }}</span>
                      <span
                        class="status-pill"
                        :class="m.fileExists ? 'status-ok' : 'status-missing'"
                        :title="m.fileExists ? 'Archivo verificado en disco' : 'Archivo no encontrado en disco'"
                      >
                        {{ m.fileExists ? 'En disco' : 'Falta archivo' }}
                      </span>
                    </div>
                    <div class="sub-actions">
                      <button
                        type="button"
                        class="btn-sub-action btn-open"
                        :disabled="!m.fileExists"
                        :title="m.fileExists ? 'Abrir este modelo en el visor' : 'No disponible en disco'"
                        @click="onLoadSingleModel(m)"
                      >
                        Abrir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================== -->
        <!-- TAB 2: MODELOS FRAG                      -->
        <!-- ========================================== -->
        <div v-if="activeTab === 'models'" class="tab-content">
          <div class="tab-toolbar">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input
                v-model="modelSearch"
                type="text"
                placeholder="Buscar modelo por nombre o proyecto..."
                class="search-input"
                @input="onModelFilterChange"
              />
              <button
                v-if="modelSearch"
                type="button"
                class="clear-search-btn"
                @click="modelSearch = ''; onModelFilterChange()"
              >
                ✕
              </button>
            </div>

            <div class="filter-controls">
              <select v-model="selectedProjectFilter" class="filter-select" @change="onModelFilterChange">
                <option value="all">Todos los proyectos</option>
                <option v-for="p in projectsList" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>

              <select v-model="selectedStatusFilter" class="filter-select" @change="onModelFilterChange">
                <option value="all">Todos los estados</option>
                <option value="ready">Listos</option>
                <option value="missing_file">Falta en disco</option>
              </select>

              <button type="button" class="refresh-btn-sm" title="Recargar modelos" @click="refreshModels">
                🔄
              </button>
            </div>
          </div>

          <div v-if="isLoadingModels" class="loading-state">
            <div class="spinner"></div>
            <p>Cargando modelos desde SQLite...</p>
          </div>

          <div v-else-if="filteredModels.length === 0" class="empty-state">
            <span class="empty-icon">📦</span>
            <p v-if="modelSearch || selectedProjectFilter !== 'all' || selectedStatusFilter !== 'all'">
              No se encontraron modelos con los filtros seleccionados.
            </p>
            <p v-else>No hay modelos FRAG almacenados.</p>
            <span class="empty-hint">Convierte un modelo IFC para generar y persistir archivos .frag.</span>
          </div>

          <div v-else class="models-grid">
            <div v-for="model in filteredModels" :key="model.id" class="model-item">
              <div class="model-item-main">
                <span class="model-icon">🧱</span>
                <div class="model-details">
                  <div class="model-title-row">
                    <h4 class="model-name" :title="model.name">{{ model.name }}</h4>
                    <span
                      class="status-pill"
                      :class="model.fileExists ? 'status-ok' : 'status-missing'"
                      :title="model.fileExists ? 'Archivo físico verificado en disco' : 'Archivo no encontrado en storage/models/'"
                    >
                      {{ model.fileExists ? '● En disco' : '⚠ Falta archivo' }}
                    </span>
                  </div>
                  <div class="model-meta-row">
                    <span class="project-tag" :title="model.projectName">
                      📁 {{ model.projectName || 'Sin proyecto' }}
                    </span>
                    <span>•</span>
                    <span>{{ model.sizeFormatted }}</span>
                    <span>•</span>
                    <span>{{ formatDate(model.createdAt) }}</span>
                  </div>
                </div>
              </div>

              <div class="model-actions">
                <button
                  type="button"
                  class="action-btn load-btn"
                  :disabled="!model.fileExists"
                  :title="model.fileExists ? 'Abrir este modelo en el visor 3D' : 'Archivo no encontrado en disco'"
                  @click="onLoadSingleModel(model)"
                >
                  ⚡ Abrir
                </button>
                <button
                  type="button"
                  class="action-btn details-btn"
                  title="Ver detalles del modelo"
                  @click="openModelDetailsModal(model)"
                >
                  ℹ️
                </button>
                <button
                  v-if="isAdmin"
                  type="button"
                  class="action-btn delete-btn"
                  title="Eliminar este modelo"
                  @click="promptDeleteModel(model)"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================== -->
        <!-- TAB 3: CACHÉ INDEXEDDB                     -->
        <!-- ========================================== -->
        <div v-if="activeTab === 'cache'" class="tab-content">
          <div class="tab-toolbar">
            <span class="info-tag">Almacenamiento Zero-Latency en IndexedDB (Memoria local del navegador)</span>
            <button
              v-if="cachedList.length > 0"
              type="button"
              class="danger-btn-sm"
              @click="onClearCache"
            >
              🧹 Limpiar Toda la Caché
            </button>
          </div>

          <div v-if="cachedList.length === 0" class="empty-state">
            <span class="empty-icon">📭</span>
            <p>No hay modelos guardados en la caché local del navegador.</p>
            <span class="empty-hint">Al abrir proyectos del backend, se guardarán aquí para acceso ultra-rápido sin red.</span>
          </div>

          <div v-else class="project-grid">
            <div v-for="item in cachedList" :key="item.id" class="project-card">
              <div class="project-card-header">
                <div class="project-info">
                  <span class="project-icon">⚡</span>
                  <div class="project-text">
                    <h4 class="project-name" :title="item.name">{{ item.name }}</h4>
                    <div class="project-meta-badges">
                      <span class="badge badge-size">{{ (item.totalBytes / (1024 * 1024)).toFixed(1) }} MB</span>
                      <span class="badge badge-date">{{ formatDate(item.timestamp) }}</span>
                    </div>
                  </div>
                </div>
                <div class="project-actions">
                  <button
                    type="button"
                    class="action-btn load-btn"
                    title="Cargar instantáneamente desde IndexedDB"
                    @click="onLoadCached(item.id)"
                  >
                    ⚡ Cargar
                  </button>
                  <button
                    type="button"
                    class="action-btn delete-btn"
                    title="Eliminar de caché"
                    @click="onDeleteCached(item.id)"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- DIALOG: CREAR NUEVO PROYECTO               -->
    <!-- ========================================== -->
    <div v-if="showCreateProjectModal" class="sub-modal-backdrop" @click.self="showCreateProjectModal = false">
      <div class="sub-modal-card">
        <h4 class="sub-modal-title">➕ Crear Nuevo Proyecto</h4>
        <div class="form-group">
          <label class="form-label">Nombre del proyecto *</label>
          <input
            v-model="newProjectName"
            type="text"
            class="form-input"
            placeholder="Ej. Edificio Oficinas Central"
            maxlength="120"
            @keyup.enter="submitCreateProject"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Descripción (opcional)</label>
          <textarea
            v-model="newProjectDesc"
            class="form-textarea"
            placeholder="Detalles sobre el proyecto, ubicación o versión..."
            rows="2"
            maxlength="300"
          ></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Modelos .FRAG asociados (opcional)</label>
          <input
            type="file"
            accept=".frag"
            multiple
            class="form-input"
            @change="onNewProjectFragSelected"
          />
          <div v-if="newProjectFragFiles.length > 0" class="frag-files-count" style="font-size: 0.75rem; color: #38bdf8; margin-top: 4px;">
            {{ newProjectFragFiles.length }} archivo(s) .frag seleccionado(s)
          </div>
        </div>
        <div class="sub-modal-actions">
          <button type="button" class="btn-cancel" @click="showCreateProjectModal = false">Cancelar</button>
          <button
            type="button"
            class="btn-confirm"
            :disabled="!newProjectName.trim()"
            @click="submitCreateProject"
          >
            Guardar Proyecto
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- DIALOG: EDITAR / RENOMBRAR PROYECTO       -->
    <!-- ========================================== -->
    <div v-if="showEditProjectModal" class="sub-modal-backdrop" @click.self="showEditProjectModal = false">
      <div class="sub-modal-card">
        <h4 class="sub-modal-title">✏️ Renombrar / Editar Proyecto</h4>
        <div class="form-group">
          <label class="form-label">Nombre del proyecto *</label>
          <input
            v-model="editProjectName"
            type="text"
            class="form-input"
            maxlength="120"
            @keyup.enter="submitEditProject"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Descripción</label>
          <textarea
            v-model="editProjectDesc"
            class="form-textarea"
            rows="3"
            maxlength="300"
          ></textarea>
        </div>
        <div class="sub-modal-actions">
          <button type="button" class="btn-cancel" @click="showEditProjectModal = false">Cancelar</button>
          <button
            type="button"
            class="btn-confirm"
            :disabled="!editProjectName.trim()"
            @click="submitEditProject"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- DIALOG: CONFIRMAR ELIMINACIÓN DE PROYECTO -->
    <!-- ========================================== -->
    <div v-if="showDeleteProjectModal && projectToDelete" class="sub-modal-backdrop" @click.self="showDeleteProjectModal = false">
      <div class="sub-modal-card">
        <h4 class="sub-modal-title text-danger">⚠️ Eliminar Proyecto</h4>
        <p class="delete-warning-text">
          ¿Estás seguro de que deseas eliminar permanentemente el proyecto:
          <strong class="highlight-text">{{ projectToDelete.name }}</strong>?
        </p>
        <div class="alert-box-danger">
          <span>Esta acción es irreversible y eliminará:</span>
          <ul>
            <li>El registro del proyecto en SQLite.</li>
            <li><strong>{{ projectToDelete.modelsCount }}</strong> archivo(s) .frag asociados de <code>storage/models/</code>.</li>
          </ul>
        </div>
        <div class="sub-modal-actions">
          <button type="button" class="btn-cancel" @click="showDeleteProjectModal = false">Cancelar</button>
          <button type="button" class="btn-danger-confirm" @click="confirmDeleteProject">
            Sí, Eliminar Proyecto
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- DIALOG: CONFIRMAR ELIMINACIÓN DE MODELO   -->
    <!-- ========================================== -->
    <div v-if="showDeleteModelModal && modelToDelete" class="sub-modal-backdrop" @click.self="showDeleteModelModal = false">
      <div class="sub-modal-card">
        <h4 class="sub-modal-title text-danger">⚠️ Eliminar Modelo FRAG</h4>
        <p class="delete-warning-text">
          ¿Estás seguro de que deseas eliminar permanentemente el archivo fragmento:
          <strong class="highlight-text">{{ modelToDelete.name }}</strong>?
        </p>
        <div class="alert-box-danger">
          <span>El archivo binario .frag en disco será eliminado permanentemente de <code>storage/models/</code> y su registro se removerá de SQLite.</span>
        </div>
        <div class="sub-modal-actions">
          <button type="button" class="btn-cancel" @click="showDeleteModelModal = false">Cancelar</button>
          <button type="button" class="btn-danger-confirm" @click="confirmDeleteModel">
            Sí, Eliminar Modelo
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- DIALOG: DETALLES DEL MODELO                -->
    <!-- ========================================== -->
    <div v-if="showModelDetailsModal && selectedModelDetail" class="sub-modal-backdrop" @click.self="showModelDetailsModal = false">
      <div class="sub-modal-card details-card">
        <h4 class="sub-modal-title">ℹ️ Detalles del Modelo FRAG</h4>
        <div class="details-list">
          <div class="detail-row">
            <span class="detail-label">Nombre de archivo:</span>
            <span class="detail-value select-all">{{ selectedModelDetail.name }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Proyecto:</span>
            <span class="detail-value">{{ selectedModelDetail.projectName || 'Sin proyecto' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">ID del modelo:</span>
            <span class="detail-value code-font">{{ selectedModelDetail.id }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Ruta de almacenamiento:</span>
            <span class="detail-value code-font">{{ selectedModelDetail.storagePath }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Tamaño en disco:</span>
            <span class="detail-value">{{ selectedModelDetail.sizeFormatted }} ({{ selectedModelDetail.sizeBytes.toLocaleString() }} bytes)</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Estado en SQLite:</span>
            <span class="detail-value">{{ selectedModelDetail.status }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Disponibilidad en disco:</span>
            <span class="detail-value" :class="selectedModelDetail.fileExists ? 'text-success' : 'text-danger'">
              {{ selectedModelDetail.fileExists ? '✓ Archivo verificado en disco' : '✗ Archivo faltante' }}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Fecha de creación:</span>
            <span class="detail-value">{{ formatDate(selectedModelDetail.createdAt) }}</span>
          </div>
        </div>
        <div class="sub-modal-actions">
          <button type="button" class="btn-cancel" @click="showModelDetailsModal = false">Cerrar</button>
          <button
            v-if="selectedModelDetail.fileExists"
            type="button"
            class="btn-confirm"
            @click="onLoadSingleModel(selectedModelDetail); showModelDetailsModal = false"
          >
            ⚡ Abrir en Visor
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped src="./ProjectsModal.css"></style>




