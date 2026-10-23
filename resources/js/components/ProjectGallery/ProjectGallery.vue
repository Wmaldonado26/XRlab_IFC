<script setup lang="ts">
import { useProjectGallery } from './ProjectGallery.logic';
const emit = defineEmits(["open-project", "request-login"]);
const { ref, computed, onMounted, watch, fetchBackendProjects, fetchBackendModels, createBackendProject, updateBackendProject, deleteBackendProject, uploadDirectFrag, convertIfcViaBackend, appendProjectFragments, currentUser, isAdmin, logout, adminFetchUsersPage, appLogger, AdminPanelModal, IfcUploadProgress, currentNav, navLabels, projectsList, backendModelsList, usersList, usersPagination, systemLogs, isLoading, isSubmitting, searchQuery, filterStatus, sortBy, feedbackMessage, feedbackType, toastMessage, toastVisible, showToast, setFeedback, settings, saveSettings, totalModelsCount, convertedCount, recentProjects, recentActivity, allProjectModels, filteredProjects, resetFilters, formatDate, handleOpenProject, handleViewModelInViewer, handleUploadIfcShortcut, handleLogout, loadProjects, loadUsers, goToUsersPage, refreshLogs, showLogDetail, getActivityGlyph, showCreateModal, createForm, createModelFile, createFileInputRef, createModelState, createModelError, createModelProgress, createModelAbortController, createdProjectForModel, onCreateFileSelected, cancelCreateModelUpload, retryCreateModelUpload, openCreateModal, submitCreateProject, showEditModal, editingProject, editForm, openEditModal, submitUpdateProject, showDeleteModal, projectToDelete, promptDeleteProject, submitDeleteProject, showAddModelModal, activeProjectForModel, activeModelTab, ifcFile, ifcInputRef, ifcState, isConvertingIfc, ifcProgress, ifcAbortController, ifcConversionSuccess, ifcError, fragFile, fragInputRef, fragState, fragError, fragUploadSuccess, fragProgress, fragAbortController, openAddModelModal, onIfcFileSelected, cancelIfcConversion, retryIfcConversion, startIfcConversion, onFragFileSelected, cancelFragUpload, startFragUpload, openActiveProjectInViewer, isAdminModalOpen, openAdminModal, onAdminModalClose } = useProjectGallery(emit);
</script>

<template>
  <div class="app-container">
    <!-- =================================================================== -->
    <!-- BARRA LATERAL (SIDEBAR) — REFERENCIA VISUAL APROBADA                -->
    <!-- =================================================================== -->
    <aside class="side">
      <!-- Logotipo de la plataforma -->
      <div class="logo">
        <div class="mark">X</div>
        <span>XRlab <small>IFC PLATFORM</small></span>
      </div>

      <!-- Navegación Principal -->
      <div class="navtitle">PRINCIPAL</div>
      <nav class="nav">
        <button
          type="button"
          :class="{ active: currentNav === 'dashboard' }"
          @click="currentNav = 'dashboard'"
        >
          ⌂ <span>Dashboard</span>
        </button>
        <button
          type="button"
          :class="{ active: currentNav === 'projects' }"
          @click="currentNav = 'projects'"
        >
          ▦ <span>Proyectos</span>
        </button>
        <button
          type="button"
          :class="{ active: currentNav === 'models' }"
          @click="currentNav = 'models'"
        >
          ◈ <span>Modelos IFC</span>
        </button>
      </nav>

      <!-- Navegación de Administración (Solo Administrador) -->
      <template v-if="isAdmin">
        <div class="navtitle">ADMINISTRACIÓN</div>
        <nav class="nav">
          <button
            type="button"
            :class="{ active: currentNav === 'users' }"
            @click="currentNav = 'users'"
          >
            ♙ <span>Usuarios</span>
          </button>
          <button
            type="button"
            :class="{ active: currentNav === 'logs' }"
            @click="currentNav = 'logs'"
          >
            ≡ <span>Registros</span>
          </button>
          <button
            type="button"
            :class="{ active: currentNav === 'settings' }"
            @click="currentNav = 'settings'"
          >
            ⚙ <span>Configuración</span>
          </button>
        </nav>
      </template>
      <!-- Tarjeta de Usuario en la base de la barra lateral -->
      <div class="user">
        <template v-if="currentUser">
          <b>{{ currentUser.name || 'Usuario' }}</b><br>
          <span class="meta">{{ currentUser.role === 'admin' ? 'Administrador' : 'Operador' }}</span>
        </template>
        <template v-else>
          <button type="button" class="btn secondary user-login-btn" @click="$emit('request-login')">
            🔐 Iniciar sesión
          </button>
        </template>
      </div>
    </aside>

    <!-- =================================================================== -->
    <!-- ÁREA PRINCIPAL (.main) — CABECERA Y VISTAS                         -->
    <!-- =================================================================== -->
    <main class="main">
      <!-- Cabecera Superior con Breadcrumb y Acciones -->
      <header>
        <div class="crumb">XRlab / <b id="crumb">{{ navLabels[currentNav] }}</b></div>
        <div class="header-right">
          <span class="header-status-dot" :title="'Backend en línea'">●</span>
          <template v-if="currentUser">
            <button type="button" class="btn secondary" @click="handleLogout">Salir</button>
          </template>
          <template v-else>
            <button type="button" class="btn primary" @click="$emit('request-login')">Iniciar sesión</button>
          </template>
        </div>
      </header>

      <!-- Feedback Banner si existe mensaje de éxito/error -->
      <div v-if="feedbackMessage" class="feedback-banner" :class="feedbackType">
        <span class="feedback-icon">{{ feedbackType === 'error' ? '⚠️' : '✓' }}</span>
        <span class="feedback-text">{{ feedbackMessage }}</span>
        <button type="button" class="dismiss-feedback-btn" @click="feedbackMessage = ''">✕</button>
      </div>

      <!-- Contenedor de Páginas (.page) -->
      <div class="page">
        <!-- =============================================================== -->
        <!-- VISTA 1: DASHBOARD                                              -->
        <!-- =============================================================== -->
        <section v-show="currentNav === 'dashboard'" class="view active">
          <div class="head">
            <div>
              <h1>Dashboard</h1>
              <p class="sub">Resumen general de tu plataforma IFC.</p>
            </div>
            <button v-if="isAdmin" type="button" class="btn primary" @click="openCreateModal">
              + Nuevo proyecto
            </button>
          </div>

          <!-- Cuadrícula de Tarjetas de Estadísticas (4 para Admin, 3 para Usuario) -->
          <div class="cards" :class="{ 'user-cards': !isAdmin }">
            <div class="card stat">
              <div class="staticon">▦</div>
              <span>{{ isAdmin ? 'PROYECTOS' : 'MIS PROYECTOS' }}</span>
              <strong>{{ projectsList.length }}</strong>
            </div>
            <div class="card stat">
              <div class="staticon">◈</div>
              <span>{{ isAdmin ? 'MODELOS IFC' : 'MODELOS ASIGNADOS' }}</span>
              <strong>{{ totalModelsCount }}</strong>
            </div>
            <div class="card stat">
              <div class="staticon">✓</div>
              <span>{{ isAdmin ? 'CONVERTIDOS' : 'LISTOS PARA VISOR' }}</span>
              <strong>{{ convertedCount }}</strong>
            </div>
            <div v-if="isAdmin" class="card stat">
              <div class="staticon">♙</div>
              <span>USUARIOS</span>
              <strong>{{ usersPagination.total || (currentUser ? 1 : 0) }}</strong>
            </div>
          </div>

          <!-- Cuadrícula 2 Columnas: Proyectos Recientes y Actividad -->
          <div class="grid">
            <div class="card">
              <div class="head" style="margin-bottom: 18px;">
                <h3 style="margin: 0; font-size: 16px;">{{ isAdmin ? 'Proyectos recientes' : 'Mis proyectos recientes' }}</h3>
                <button type="button" class="btn secondary" @click="currentNav = 'projects'">
                  Ver todos
                </button>
              </div>

              <div v-if="isLoading" class="panel-loading">
                <div class="spinner-sm"></div>
                <span>Cargando proyectos...</span>
              </div>
              <div v-else-if="projectsList.length === 0" class="panel-empty">
                <p class="meta">{{ isAdmin ? 'No hay proyectos registrados aún.' : 'No tienes proyectos asignados actualmente.' }}</p>
                <button v-if="isAdmin" type="button" class="btn primary" style="margin-top: 10px;" @click="openCreateModal">
                  + Crear proyecto
                </button>
              </div>
              <div v-else class="projects">
                <div
                  v-for="project in recentProjects"
                  :key="project.id"
                  class="card project card-clickable"
                  @click="handleOpenProject(project)"
                >
                  <div class="cover"><div class="cube"></div></div>
                  <h3>{{ project.name }}</h3>
                  <div class="meta">
                    {{ project.modelsCount || 0 }} {{ project.modelsCount === 1 ? 'modelo' : 'modelos' }} · {{ formatDate(project.createdAt) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Columna Derecha: Actividad para Admin / Modelos Listos para Usuario -->
            <div class="card">
              <template v-if="isAdmin">
                <h3 style="margin: 0 0 16px; font-size: 16px;">Actividad reciente</h3>
                <div v-if="systemLogs.length === 0" class="panel-empty">
                  <p class="meta">No hay actividad reciente registrada.</p>
                </div>
                <div v-else class="activity-list">
                  <p v-for="log in recentActivity" :key="log.id" class="meta activity-row">
                    <span class="activity-glyph" :class="log.level">{{ getActivityGlyph(log) }}</span>
                    <span class="activity-text">{{ log.message }}</span>
                    <span class="activity-time">{{ log.timestamp }}</span>
                  </p>
                </div>
              </template>
              <template v-else>
                <h3 style="margin: 0 0 16px; font-size: 16px;">Modelos disponibles</h3>
                <div v-if="allProjectModels.length === 0" class="panel-empty">
                  <p class="meta">No hay modelos disponibles para visualización.</p>
                </div>
                <div v-else class="activity-list">
                  <div
                    v-for="model in allProjectModels.slice(0, 5)"
                    :key="model.uniqueKey"
                    class="activity-row model-quick-row"
                    style="cursor: pointer;"
                    @click="handleViewModelInViewer(model)"
                  >
                    <span class="activity-glyph">📦</span>
                    <div class="model-quick-info" style="flex: 1; overflow: hidden;">
                      <b style="font-size: 13px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ model.name }}</b>
                      <span class="meta">{{ model.projectName }} · {{ model.sizeFormatted }}</span>
                    </div>
                    <button type="button" class="btn secondary" style="padding: 4px 10px; font-size: 11px;">Ver</button>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </section>

        <!-- =============================================================== -->
        <!-- VISTA 2: PROYECTOS                                              -->
        <!-- =============================================================== -->
        <section v-show="currentNav === 'projects'" class="view active">
          <div class="head">
            <div>
              <h1>{{ isAdmin ? 'Proyectos' : 'Mis Proyectos' }}</h1>
              <p class="sub">{{ isAdmin ? 'Administra tus proyectos y modelos.' : 'Proyectos y modelos BIM asignados para visualización 3D.' }}</p>
            </div>
            <div class="head-actions">
              <button v-if="isAdmin" type="button" class="btn primary" @click="openCreateModal">
                + Nuevo proyecto
              </button>
            </div>
          </div>

          <!-- Barra de Búsqueda y Filtros -->
          <div class="toolbar-box">
            <div class="search-input-wrap">
              <span class="search-icon">🔍</span>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Buscar por nombre o descripción de proyecto..."
                class="filter-input"
              />
              <button v-if="searchQuery" type="button" class="clear-btn" @click="searchQuery = ''">✕</button>
            </div>

            <div class="filter-selects">
              <select v-model="filterStatus" class="select-control">
                <option value="all">Todos los proyectos</option>
                <option value="with_models">Con modelos listos</option>
                <option value="empty">Sin modelos aún</option>
              </select>

              <select v-model="sortBy" class="select-control">
                <option value="recent">Más recientes primero</option>
                <option value="name_asc">Nombre (A → Z)</option>
                <option value="name_desc">Nombre (Z → A)</option>
                <option value="size_desc">Mayor tamaño</option>
                <option value="models_desc">Más modelos</option>
              </select>

              <button type="button" class="btn secondary refresh-btn" title="Recargar catálogo" :disabled="isLoading" @click="loadProjects">
                <span :class="{ 'spin-anim': isLoading }">🔄</span>
              </button>
            </div>
          </div>

          <!-- Estado de Carga -->
          <div v-if="isLoading" class="gallery-loading">
            <div class="spinner-large"></div>
            <p class="sub">Consultando catálogo persistente en SQLite...</p>
          </div>

          <!-- Estado Vacío -->
          <div v-else-if="filteredProjects.length === 0" class="gallery-empty card">
            <template v-if="searchQuery || filterStatus !== 'all'">
              <div class="empty-icon-large">🔍</div>
              <h3>Sin resultados</h3>
              <p class="sub">No se encontraron proyectos para "{{ searchQuery }}".</p>
              <button type="button" class="btn secondary" @click="resetFilters">Restablecer filtros</button>
            </template>
            <template v-else-if="!isAdmin && currentUser">
              <div class="empty-icon-large">🔒</div>
              <h3>Sin proyectos asignados</h3>
              <p class="sub">Tu cuenta no tiene proyectos asignados actualmente en el sistema.</p>
            </template>
            <template v-else>
              <div class="empty-icon-large">📂</div>
              <h3>No hay proyectos registrados</h3>
              <p class="sub">Comienza creando tu primer proyecto BIM o subiendo un archivo IFC.</p>
              <button v-if="isAdmin" type="button" class="btn primary" style="margin-top: 15px;" @click="openCreateModal">
                + Crear Primer Proyecto
              </button>
            </template>
          </div>

          <!-- Cuadrícula de Proyectos -->
          <div v-else class="projects">
            <div
              v-for="project in filteredProjects"
              :key="project.id"
              class="card project"
            >
              <div class="cover"><div class="cube"></div></div>
              
              <div class="project-card-header">
                <span class="badge" :class="project.modelsCount > 0 ? 'ok' : 'proc'">
                  {{ project.modelsCount > 0 ? 'Activo' : 'Sin modelos' }}
                </span>
                <span v-if="project.totalPartsSizeMB && project.totalPartsSizeMB !== '0.0'" class="badge size-badge">
                  {{ project.totalPartsSizeMB }} MB
                </span>
              </div>

              <h3>{{ project.name }}</h3>
              <p class="project-desc">{{ project.description || 'Sin descripción registrada' }}</p>

              <div class="meta" style="margin-bottom: 14px;">
                {{ project.modelsCount || 0 }} {{ project.modelsCount === 1 ? 'modelo' : 'modelos' }} · {{ formatDate(project.createdAt) }}
              </div>

              <div class="project-card-actions">
                <button
                  type="button"
                  class="btn secondary project-open-btn"
                  @click="handleOpenProject(project)"
                >
                  ⚡ Abrir visor
                </button>

                <div v-if="isAdmin" class="admin-project-btns">
                  <button
                    type="button"
                    class="action-mini-btn"
                    title="Añadir modelo al proyecto"
                    @click="openAddModelModal(project)"
                  >
                    ➕
                  </button>
                  <button
                    type="button"
                    class="action-mini-btn"
                    title="Editar proyecto"
                    @click="openEditModal(project)"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    class="action-mini-btn delete-mini"
                    title="Eliminar proyecto"
                    @click="promptDeleteProject(project)"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- =============================================================== -->
        <!-- VISTA 3: MODELOS IFC                                            -->
        <!-- =============================================================== -->
        <section v-show="currentNav === 'models'" class="view active">
          <div class="head">
            <div>
              <h1>{{ isAdmin ? 'Modelos IFC' : 'Modelos Asignados' }}</h1>
              <p class="sub">{{ isAdmin ? 'Carga y administra tus modelos.' : 'Modelos BIM disponibles para visualización en el visor 3D.' }}</p>
            </div>
            <button v-if="isAdmin" type="button" class="btn primary" @click="handleUploadIfcShortcut">
              + Cargar IFC
            </button>
          </div>

          <!-- Tabla de Modelos IFC -->
          <div class="table">
            <div class="row th">
              <div>MODELO</div>
              <div>PROYECTO</div>
              <div>TAMAÑO</div>
              <div>ESTADO</div>
              <div></div>
            </div>

            <div v-if="allProjectModels.length === 0" class="empty-table-row">
              <span class="meta">No hay modelos registrados actualmente en el sistema.</span>
            </div>

            <div
              v-for="model in allProjectModels"
              :key="model.uniqueKey"
              class="row"
            >
              <div>
                <b>{{ model.name }}</b><br>
                <span class="meta">{{ model.category || 'Modelo 3D BIM / FRAG' }}</span>
              </div>
              <div>{{ model.projectName }}</div>
              <div>{{ model.sizeFormatted }}</div>
              <div>
                <span class="badge" :class="model.isReady ? 'ok' : 'proc'">
                  {{ model.isReady ? 'Convertido' : 'Procesando' }}
                </span>
              </div>
              <div>
                <button
                  type="button"
                  class="btn secondary btn-row-view"
                  @click="handleViewModelInViewer(model)"
                >
                  Ver
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- =============================================================== -->
        <!-- VISTA 4: USUARIOS                                               -->
        <!-- =============================================================== -->
        <section v-show="currentNav === 'users'" class="view active">
          <div class="head">
            <div>
              <h1>Usuarios</h1>
              <p class="sub">Gestiona el acceso a los proyectos.</p>
            </div>
            <button v-if="isAdmin" type="button" class="btn primary" @click="openAdminModal('create')">
              + Nuevo usuario
            </button>
          </div>

          <!-- Tabla de Usuarios -->
          <div class="table">
            <div class="row th user-row-cols">
              <div>USUARIO</div>
              <div>ROL</div>
              <div>PROYECTOS</div>
              <div>ESTADO</div>
              <div></div>
            </div>

            <div v-if="usersList.length === 0" class="empty-table-row">
              <span class="meta">Cargando o sin usuarios registrados.</span>
            </div>

            <div
              v-for="user in usersList"
              :key="user.id"
              class="row user-row-cols"
            >
              <div>
                <b>{{ user.name }}</b><br>
                <span class="meta">{{ user.email }}</span>
              </div>
              <div>
                <span class="role-chip" :class="user.role">
                  {{ user.role === 'admin' ? 'Administrador' : 'Usuario' }}
                </span>
              </div>
              <div>{{ user.assignedProjectsCount ?? (user.role === 'admin' ? 'Todos' : user.assignedProjectIds?.length || 0) }}</div>
              <div>
                <span class="badge" :class="user.isActive ? 'ok' : 'proc'">
                  {{ user.isActive ? 'Activo' : 'Inactivo' }}
                </span>
              </div>
              <div>
                <button
                  v-if="isAdmin"
                  type="button"
                  class="btn secondary btn-row-view"
                  @click="openAdminModal('users')"
                >
                  Editar
                </button>
              </div>
            </div>
            <div v-if="usersPagination.total > 0" style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 0">
              <span class="meta">Página {{ usersPagination.currentPage }} de {{ usersPagination.lastPage }} · {{ usersPagination.total }} usuarios</span>
              <div style="display: flex; gap: 8px">
                <button type="button" class="btn secondary" :disabled="usersPagination.currentPage <= 1" @click="goToUsersPage(usersPagination.currentPage - 1)">Anterior</button>
                <button type="button" class="btn secondary" :disabled="usersPagination.currentPage >= usersPagination.lastPage" @click="goToUsersPage(usersPagination.currentPage + 1)">Siguiente</button>
              </div>
            </div>
          </div>
        </section>

        <!-- =============================================================== -->
        <!-- VISTA 5: REGISTROS (LOGS)                                       -->
        <!-- =============================================================== -->
        <section v-show="currentNav === 'logs'" class="view active">
          <div class="head">
            <div>
              <h1>Registros</h1>
              <p class="sub">Actividad y eventos del sistema.</p>
            </div>
            <div class="head-actions">
              <button type="button" class="btn secondary" @click="refreshLogs">
                🔄 Actualizar
              </button>
            </div>
          </div>

          <!-- Tabla de Registros -->
          <div class="table">
            <div class="row th log-row-cols">
              <div>EVENTO</div>
              <div>ORIGEN</div>
              <div>HORA</div>
              <div>ESTADO</div>
              <div></div>
            </div>

            <div v-if="systemLogs.length === 0" class="empty-table-row">
              <span class="meta">No hay registros generados en la sesión actual.</span>
            </div>

            <div
              v-for="log in systemLogs"
              :key="log.id"
              class="row log-row-cols"
            >
              <div>
                <b>{{ log.message }}</b><br>
                <span class="meta">{{ log.source || 'Sistema' }}</span>
              </div>
              <div>{{ log.origin === 'backend' ? 'Backend 64-bit' : 'Frontend' }}</div>
              <div>{{ log.timestamp }}</div>
              <div>
                <span class="badge" :class="log.level === 'error' ? 'proc' : 'ok'">
                  {{ log.level.toUpperCase() }}
                </span>
              </div>
              <div>
                <button
                  type="button"
                  class="btn secondary btn-row-view"
                  @click="showLogDetail(log)"
                >
                  Ver
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- =============================================================== -->
        <!-- VISTA 6: CONFIGURACIÓN                                          -->
        <!-- =============================================================== -->
        <section v-show="currentNav === 'settings'" class="view active">
          <div class="head">
            <div>
              <h1>Configuración</h1>
              <p class="sub">Preferencias generales.</p>
            </div>
          </div>

          <div class="card" style="max-width: 700px;">
            <div class="field">
              <label>Nombre de plataforma</label>
              <input v-model="settings.platformName" type="text" />
            </div>

            <div class="field">
              <label>Conversión</label>
              <input v-model="settings.conversionEngine" type="text" readonly />
              <small class="meta" style="margin-top: 4px; display: block;">
                Microservicio local Node.js 64-bit y motor de fragmentación That Open Engine.
              </small>
            </div>

            <div class="field">
              <label>Almacenamiento Persistente</label>
              <input value="Base de datos SQLite local + Almacenamiento de fragmentos" readonly />
            </div>

            <div style="margin-top: 24px;">
              <button type="button" class="btn primary" @click="saveSettings">
                Guardar cambios
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>

    <!-- =================================================================== -->
    <!-- MODAL: NUEVO PROYECTO (CON SOPORTE IFC Y FRAG Y PROGRESO REAL)      -->
    <!-- =================================================================== -->
    <div
      v-if="showCreateModal"
      class="modalback show"
      @click.self="createModelState !== 'UPLOADING' && createModelState !== 'PROCESSING' && !isSubmitting ? (showCreateModal = false) : null"
    >
      <div class="modal">
        <div class="modalhead">
          <div>
            <h2>Nuevo proyecto</h2>
            <p class="sub">Crea un proyecto y carga su modelo IFC o FRAG.</p>
          </div>
          <button
            type="button"
            class="close"
            :disabled="createModelState === 'UPLOADING' || createModelState === 'PROCESSING' || isSubmitting"
            @click="showCreateModal = false"
          >
            ×
          </button>
        </div>

        <form @submit.prevent="submitCreateProject">
          <div class="field">
            <label>Nombre del proyecto *</label>
            <input
              v-model="createForm.name"
              type="text"
              placeholder="Ej. CTR Estructura"
              required
              :disabled="createModelState === 'UPLOADING' || createModelState === 'PROCESSING' || isSubmitting"
            />
          </div>

          <div class="field">
            <label>Descripción</label>
            <textarea
              v-model="createForm.description"
              rows="2"
              placeholder="Detalles del proyecto, buque o estructura..."
              class="modal-textarea"
              :disabled="createModelState === 'UPLOADING' || createModelState === 'PROCESSING' || isSubmitting"
            ></textarea>
          </div>

          <div class="field">
            <label>Archivo del modelo (IFC o FRAG)</label>
            <div
              v-if="createModelState === 'IDLE'"
              class="drop"
              @click="createFileInputRef?.click()"
            >
              <input
                ref="createFileInputRef"
                type="file"
                accept=".ifc,.frag"
                style="display: none"
                @change="onCreateFileSelected"
              />
              <div style="font-size: 26px; margin-bottom: 5px;">⇧</div>
              <b>Selecciona un archivo IFC o FRAG</b><br>
              <span class="meta">Archivos .ifc (con procesamiento) o .frag (carga directa)</span>
            </div>

            <!-- Interfaz de Progreso Real XRlab (Tanto para IFC como para FRAG) -->
            <IfcUploadProgress
              v-else
              :state="createModelState"
              :file-name="createModelFile?.name"
              :file-size="createModelFile?.size"
              :progress-percent="createModelProgress.percent"
              :loaded-bytes="createModelProgress.loadedBytes"
              :total-bytes="createModelProgress.totalBytes"
              :speed-bytes-per-sec="createModelProgress.speedBytesPerSec"
              :remaining-sec="createModelProgress.remainingSec"
              :stage-text="createModelProgress.stage"
              :elapsed-time="createModelProgress.elapsed"
              :error-message="createModelError"
              @cancel="cancelCreateModelUpload"
              @retry="retryCreateModelUpload"
              @change-file="createFileInputRef?.click()"
            />
          </div>

          <div class="modal-footer-actions">
            <button
              v-if="createModelState === 'COMPLETED'"
              type="button"
              class="btn secondary"
              @click="showCreateModal = false"
            >
              Cerrar
            </button>
            <button
              v-else
              type="button"
              class="btn secondary"
              :disabled="createModelState === 'UPLOADING' || createModelState === 'PROCESSING' || isSubmitting"
              @click="showCreateModal = false"
            >
              Cancelar
            </button>

            <button
              v-if="createModelState === 'COMPLETED' && createdProjectForModel"
              type="button"
              class="btn primary"
              @click="handleOpenProject(createdProjectForModel); showCreateModal = false"
            >
              ⚡ Abrir visor
            </button>
            <button
              v-else
              type="submit"
              class="btn primary"
              :disabled="!createForm.name.trim() || isSubmitting || createModelState === 'UPLOADING' || createModelState === 'PROCESSING'"
            >
              <span v-if="isSubmitting || createModelState === 'UPLOADING' || createModelState === 'PROCESSING'" class="spinner-sm"></span>
              <span v-if="createModelState === 'UPLOADING' || createModelState === 'PROCESSING'">Subiendo...</span>
              <span v-else>{{ createModelFile ? 'Crear proyecto y cargar archivo' : 'Crear proyecto' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL: AÑADIR MODELO AL PROYECTO (IFC O FRAG)                      -->
    <!-- =================================================================== -->
    <div
      v-if="showAddModelModal && activeProjectForModel"
      class="modalback show"
      @click.self="!isConvertingIfc && fragState !== 'UPLOADING' && ifcState !== 'UPLOADING' && ifcState !== 'PROCESSING' ? (showAddModelModal = false) : null"
    >
      <div class="modal" style="max-width: 650px;">
        <div class="modalhead">
          <div>
            <h2>Cargar modelo IFC / FRAG</h2>
            <p class="sub">Proyecto: <strong>{{ activeProjectForModel.name }}</strong></p>
          </div>
          <button
            type="button"
            class="close"
            :disabled="isConvertingIfc || fragState === 'UPLOADING' || ifcState === 'UPLOADING' || ifcState === 'PROCESSING'"
            @click="showAddModelModal = false"
          >
            ×
          </button>
        </div>

        <div class="tabs-header">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeModelTab === 'ifc' }"
            @click="activeModelTab = 'ifc'"
          >
            ⚙ Convertir IFC
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeModelTab === 'frag' }"
            @click="activeModelTab = 'frag'"
          >
            📦 Subir FRAG
          </button>
        </div>

        <!-- Opción A: Convertir IFC -->
        <div v-if="activeModelTab === 'ifc'" class="tab-pane">
          <div
            v-if="ifcState === 'IDLE'"
            class="drop"
            @click="ifcInputRef?.click()"
          >
            <input
              ref="ifcInputRef"
              type="file"
              accept=".ifc"
              style="display: none"
              @change="onIfcFileSelected"
            />
            <div style="font-size: 26px; margin-bottom: 5px;">◈</div>
            <b>Selecciona el modelo .ifc</b><br>
            <span class="meta">El servidor procesará el IFC y generará el FRAG</span>
          </div>

          <IfcUploadProgress
            v-else
            :state="ifcState"
            :file-name="ifcFile?.name"
            :file-size="ifcFile?.size"
            :progress-percent="ifcProgress.percent"
            :loaded-bytes="ifcProgress.loadedBytes"
            :total-bytes="ifcProgress.totalBytes"
            :speed-bytes-per-sec="ifcProgress.speedBytesPerSec"
            :remaining-sec="ifcProgress.remainingSec"
            :stage-text="ifcProgress.stage"
            :elapsed-time="ifcProgress.elapsed"
            :error-message="ifcError"
            @cancel="cancelIfcConversion"
            @retry="retryIfcConversion"
            @change-file="ifcInputRef?.click()"
          />

          <div class="modal-footer-actions" style="margin-top: 20px;">
            <button
              type="button"
              class="btn secondary"
              :disabled="ifcState === 'UPLOADING' || ifcState === 'PROCESSING'"
              @click="showAddModelModal = false"
            >
              {{ ifcConversionSuccess ? 'Cerrar' : 'Cancelar' }}
            </button>
            <button
              v-if="ifcConversionSuccess"
              type="button"
              class="btn primary"
              @click="openActiveProjectInViewer"
            >
              ⚡ Abrir visor
            </button>
            <button
              v-else
              type="button"
              class="btn primary"
              :disabled="!ifcFile || ifcState === 'UPLOADING' || ifcState === 'PROCESSING'"
              @click="startIfcConversion"
            >
              <span v-if="ifcState === 'UPLOADING' || ifcState === 'PROCESSING'" class="spinner-sm"></span>
              <span v-else>Iniciar Carga</span>
            </button>
          </div>
        </div>

        <!-- Opción B: Subir FRAG Directo con Progreso Real -->
        <div v-if="activeModelTab === 'frag'" class="tab-pane">
          <div
            v-if="fragState === 'IDLE'"
            class="drop"
            @click="fragInputRef?.click()"
          >
            <input
              ref="fragInputRef"
              type="file"
              accept=".frag"
              style="display: none"
              @change="onFragFileSelected"
            />
            <div style="font-size: 26px; margin-bottom: 5px;">📦</div>
            <b>Selecciona un archivo .frag</b><br>
            <span class="meta">Carga directa de modelo binario optimizado sin conversión</span>
          </div>

          <IfcUploadProgress
            v-else
            :state="fragState"
            :file-name="fragFile?.name"
            :file-size="fragFile?.size"
            :progress-percent="fragProgress.percent"
            :loaded-bytes="fragProgress.loadedBytes"
            :total-bytes="fragProgress.totalBytes"
            :speed-bytes-per-sec="fragProgress.speedBytesPerSec"
            :remaining-sec="fragProgress.remainingSec"
            :stage-text="fragProgress.stage"
            :elapsed-time="fragProgress.elapsed"
            :error-message="fragError"
            @cancel="cancelFragUpload"
            @retry="startFragUpload"
            @change-file="fragInputRef?.click()"
          />

          <div class="modal-footer-actions" style="margin-top: 20px;">
            <button
              type="button"
              class="btn secondary"
              :disabled="fragState === 'UPLOADING'"
              @click="showAddModelModal = false"
            >
              {{ fragUploadSuccess ? 'Cerrar' : 'Cancelar' }}
            </button>
            <button
              v-if="fragUploadSuccess"
              type="button"
              class="btn primary"
              @click="openActiveProjectInViewer"
            >
              ⚡ Abrir visor
            </button>
            <button
              v-else
              type="button"
              class="btn primary"
              :disabled="!fragFile || fragState === 'UPLOADING'"
              @click="startFragUpload"
            >
              <span v-if="fragState === 'UPLOADING'" class="spinner-sm"></span>
              <span v-if="fragState === 'UPLOADING'">Subiendo...</span>
              <span v-else>Subir FRAG</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL: EDITAR PROYECTO                                              -->
    <!-- =================================================================== -->
    <div v-if="showEditModal && editingProject" class="modalback show" @click.self="showEditModal = false">
      <div class="modal">
        <div class="modalhead">
          <div>
            <h2>Editar proyecto</h2>
            <p class="sub">Actualiza los detalles del proyecto.</p>
          </div>
          <button type="button" class="close" @click="showEditModal = false">×</button>
        </div>
        <form @submit.prevent="submitUpdateProject">
          <div class="field">
            <label>Nombre del proyecto *</label>
            <input v-model="editForm.name" type="text" required />
          </div>
          <div class="field">
            <label>Descripción</label>
            <textarea v-model="editForm.description" rows="3" class="modal-textarea"></textarea>
          </div>
          <div class="modal-footer-actions">
            <button type="button" class="btn secondary" @click="showEditModal = false">Cancelar</button>
            <button type="submit" class="btn primary" :disabled="isSubmitting">Guardar cambios</button>
          </div>
        </form>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL: ELIMINAR PROYECTO                                            -->
    <!-- =================================================================== -->
    <div v-if="showDeleteModal && projectToDelete" class="modalback show" @click.self="showDeleteModal = false">
      <div class="modal">
        <div class="modalhead">
          <div>
            <h2>¿Eliminar proyecto?</h2>
            <p class="sub">Esta acción no se puede deshacer.</p>
          </div>
          <button type="button" class="close" @click="showDeleteModal = false">×</button>
        </div>
        <p style="margin: 15px 0; color: #172033; font-size: 14px;">
          ¿Estás seguro de que deseas eliminar permanentemente el proyecto <strong>{{ projectToDelete.name }}</strong>?
        </p>
        <div class="modal-footer-actions">
          <button type="button" class="btn secondary" @click="showDeleteModal = false">Cancelar</button>
          <button type="button" class="btn primary btn-danger" :disabled="isSubmitting" @click="submitDeleteProject">
            Eliminar proyecto
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Auxiliar de Administración Completa de Usuarios -->
    <AdminPanelModal
      v-if="isAdmin"
      v-model="isAdminModalOpen"
      @update:model-value="onAdminModalClose"
    />

    <!-- Toast Flotante -->
    <div id="toast" class="toast" :class="{ show: toastVisible }">
      {{ toastMessage }}
    </div>
  </div>
</template>

<style scoped src="./ProjectGallery.css"></style>


