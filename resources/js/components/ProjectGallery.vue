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
              <strong>{{ usersList.length || (currentUser ? 1 : 0) }}</strong>
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

<script setup lang="ts">
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
} from '../services/backend-client';
import { appendProjectFragments } from '../services/frag-cache';
import {
  currentUser,
  isAdmin,
  logout,
  adminFetchUsers,
  type AdminUserItem,
} from '../services/auth-service';
import { appLogger, type AppLogEntry } from '../services/logger';
import AdminPanelModal from './AdminPanelModal.vue';
import IfcUploadProgress, { type IfcUploadState } from './IfcUploadProgress.vue';

const emit = defineEmits<{
  (e: 'open-project', project: BackendProject): void;
  (e: 'request-login'): void;
}>();

// =====================================================================
// NAVEGACIÓN ENTRE VISTAS DEL PROTOTIPO
// =====================================================================
type NavView = 'dashboard' | 'projects' | 'models' | 'users' | 'logs' | 'settings';
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
      try {
        usersList.value = await adminFetchUsers();
      } catch {}
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
          createModelAbortController.signal
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
      ifcAbortController.signal
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
</script>

<style scoped>
/* ===================================================================== */
/* ESTILOS EXACTOS DEL PROTOTIPO APROBADO (VISTA PRUEBA)                 */
/* ===================================================================== */

.app-container {
  display: flex;
  min-height: 100vh;
  background: var(--bg-app);
  color: var(--text-main);
  font-family: inherit;
  overflow-x: hidden;
}

/* SIDEBAR FIJA 250px */
.side {
  position: fixed;
  width: 250px;
  inset: 0 auto 0 0;
  background: #ffffff;
  border-right: 1px solid var(--line);
  padding: 22px 15px;
  z-index: 50;
  display: flex;
  flex-direction: column;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 19px;
  padding: 4px 10px 28px;
  color: var(--text-main);
}

.mark {
  width: 35px;
  height: 35px;
  background: var(--b);
  color: #ffffff;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 800;
  box-shadow: 0 3px 8px rgba(35, 75, 161, 0.25);
}

.logo small {
  display: block;
  font-size: 9px;
  color: #8b95a7;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.navtitle {
  font-size: 10px;
  color: #9aa4b4;
  padding: 12px 12px 6px;
  font-weight: 800;
  letter-spacing: 0.6px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 0;
  background: #ffffff;
  text-align: left;
  padding: 11px 12px;
  border-radius: var(--radius-btn);
  color: #667085;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav button:hover,
.nav button.active {
  background: var(--b-light);
  color: var(--b);
  font-weight: 700;
}

.user {
  margin-top: auto;
  background: #f7f8fb;
  border: 1px solid var(--line);
  border-radius: 11px;
  padding: 12px;
  font-size: 12px;
}

.user-login-btn {
  width: 100%;
  font-size: 12px;
  padding: 7px;
}

/* ÁREA PRINCIPAL (.main) */
.main {
  margin-left: 250px;
  width: calc(100% - 250px);
  min-height: 100vh;
  background: var(--bg-app);
}

header {
  height: 70px;
  background: #ffffff;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  position: sticky;
  top: 0;
  z-index: 40;
}

.crumb {
  font-size: 13px;
  color: #8791a1;
}

.crumb b {
  color: var(--text-main);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-status-dot {
  color: #10b981;
  font-size: 11px;
}

/* CONTENEDOR DE PÁGINA */
.page {
  padding: 30px;
  max-width: 1450px;
  margin: auto;
}

.view {
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 25px;
}

.head h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: -0.02em;
}

.sub {
  color: var(--muted);
  font-size: 14px;
  margin: 7px 0;
}

/* BOTONES */
.btn {
  border: 0;
  border-radius: var(--radius-btn);
  padding: 10px 16px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.primary {
  background: var(--b);
  color: #ffffff;
}

.primary:hover:not(:disabled) {
  background: var(--b-hover);
  box-shadow: 0 4px 12px rgba(35, 75, 161, 0.2);
}

.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary {
  background: #ffffff;
  border: 1px solid var(--line);
  color: #526074;
}

.secondary:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #cbd5e1;
  color: var(--text-main);
}

.btn-danger {
  background: #dc2626 !important;
  color: white !important;
}

.btn-danger:hover {
  background: #b91c1c !important;
}

/* TARJETAS (.card) */
.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-bottom: 24px;
}

.cards.user-cards {
  grid-template-columns: repeat(3, 1fr);
}

.card {
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  padding: 19px;
  box-shadow: var(--card-shadow);
}

.stat {
  position: relative;
}

.stat strong {
  display: block;
  font-size: 29px;
  font-weight: 800;
  margin-top: 10px;
  color: var(--text-main);
}

.stat span {
  font-size: 11px;
  color: var(--muted);
  font-weight: 800;
  letter-spacing: 0.5px;
}

.staticon {
  float: right;
  background: var(--b-light);
  color: var(--b);
  padding: 11px;
  border-radius: 10px;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  font-size: 16px;
  font-weight: 800;
}

/* GRID 2 COLUMNAS (DASHBOARD) */
.grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 17px;
}

.projects {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 15px;
}

.card.project {
  display: flex;
  flex-direction: column;
}

.card-clickable {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.card-clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(32, 48, 80, 0.08);
}

/* PORTADA ISOMÉTRICA CON CUBO 3D */
.cover {
  height: 130px;
  background: linear-gradient(135deg, #dce6fa, #f7f9fc);
  border-radius: 10px;
  margin: -19px -19px 15px;
  position: relative;
  overflow: hidden;
}

.cube {
  position: absolute;
  inset: 25px 65px;
  border: 2px solid #87a2d3;
  transform: perspective(350px) rotateX(25deg) rotateY(-25deg);
  border-radius: 4px;
}

.project-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.project h3 {
  margin: 0 0 7px;
  font-size: 17px;
  font-weight: 800;
  color: var(--text-main);
}

.project-desc {
  font-size: 12.5px;
  color: #64748b;
  margin: 0 0 12px;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 36px;
}

.meta {
  font-size: 12px;
  color: var(--muted);
}

.project-card-actions {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.project-open-btn {
  flex: 1;
}

.admin-project-btns {
  display: flex;
  gap: 4px;
}

.action-mini-btn {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: white;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 12px;
  transition: all 0.12s;
}

.action-mini-btn:hover {
  background: #edf2ff;
  border-color: #87a2d3;
}

.action-mini-btn.delete-mini:hover {
  background: #fee2e2;
  border-color: #f87171;
}

/* BADGES */
.badge {
  font-size: 10px;
  font-weight: 800;
  padding: 4px 9px;
  border-radius: var(--radius-badge);
  display: inline-block;
  letter-spacing: 0.3px;
}

.ok {
  background: var(--badge-ok-bg);
  color: var(--badge-ok-text);
}

.proc {
  background: var(--badge-proc-bg);
  color: var(--badge-proc-text);
}

.size-badge {
  background: #f1f5f9;
  color: #475569;
}

.role-chip {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #475569;
}

.role-chip.admin {
  background: #e0e7ff;
  color: #3730a3;
}

/* TABLA (.table) */
.table {
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: var(--card-shadow);
}

.row {
  display: grid;
  grid-template-columns: 2fr 1.2fr 1fr 1fr 90px;
  gap: 12px;
  padding: 15px 17px;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
  align-items: center;
}

.row:last-child {
  border: 0;
}

.th {
  font-size: 10px;
  font-weight: 800;
  color: #98a1ae;
  background: #fafbfc;
  letter-spacing: 0.6px;
}

.user-row-cols {
  grid-template-columns: 2fr 1fr 1fr 1fr 90px;
}

.log-row-cols {
  grid-template-columns: 2.2fr 1.2fr 1fr 1fr 90px;
}

.empty-table-row {
  padding: 35px 20px;
  text-align: center;
}

.btn-row-view {
  padding: 6px 12px;
  font-size: 12px;
  width: 100%;
}

/* TOOLBAR Y FILTROS */
.toolbar-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 20px;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: var(--radius-btn);
  padding: 10px 14px;
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.search-icon {
  font-size: 13px;
  color: #94a3b8;
}

.filter-input {
  width: 100%;
  border: 0;
  outline: none;
  font-size: 13px;
  color: var(--text-main);
  background: transparent;
}

.clear-btn {
  border: 0;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.filter-selects {
  display: flex;
  align-items: center;
  gap: 8px;
}

.select-control {
  padding: 7px 11px;
  font-size: 12.5px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text-main);
  outline: none;
  cursor: pointer;
}

.refresh-btn {
  padding: 7px 12px;
}

.spin-anim {
  display: inline-block;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* MODALES (.modalback, .modal) */
.modalback {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(11, 22, 42, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 9999;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modalback.show {
  display: flex;
}

.modal {
  background: #ffffff;
  border-radius: var(--radius-modal);
  padding: 24px;
  width: min(600px, 100%);
  box-shadow: 0 16px 36px rgba(11, 22, 42, 0.15);
  animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 90vh;
  overflow-y: auto;
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.modalhead {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.modalhead h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--text-main);
}

.close {
  border: 0;
  background: #f1f3f6;
  border-radius: 8px;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  font-size: 20px;
  color: #64748b;
  cursor: pointer;
}

.close:hover {
  background: #e2e8f0;
  color: var(--text-main);
}

.field {
  margin: 18px 0;
}

.field label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 7px;
  color: var(--text-main);
}

.field input,
.modal-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #d7dce6;
  border-radius: var(--radius-btn);
  font-family: inherit;
  font-size: 13.5px;
  outline: none;
  background: #ffffff;
  color: var(--text-main);
  transition: border-color 0.15s;
}

.field input:focus,
.modal-textarea:focus {
  border-color: var(--b);
  box-shadow: 0 0 0 3px rgba(35, 75, 161, 0.08);
}

.drop {
  border: 1.5px dashed #b6c2d9;
  background: #f8faff;
  padding: 30px;
  text-align: center;
  border-radius: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.drop:hover {
  border-color: var(--b);
  background: #edf2ff;
}

.drop-mini {
  border: 1px dashed #b6c2d9;
  background: #f8faff;
  padding: 14px;
  text-align: center;
  border-radius: 9px;
  cursor: pointer;
  font-size: 12.5px;
  color: #475569;
}

.frag-chips-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.frag-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f1f5f9;
  border: 1px solid var(--line);
  padding: 6px 10px;
  border-radius: 7px;
  font-size: 12px;
}

.chip-remove {
  border: 0;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.modal-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 24px;
}

.tabs-header {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 10px;
}

.tab-btn {
  border: 0;
  background: transparent;
  padding: 8px 14px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
}

.tab-btn.active {
  background: var(--b-light);
  color: var(--b);
}

/* FEEDBACK & TOAST */
.feedback-banner {
  margin: 16px 30px 0;
  padding: 12px 16px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.feedback-banner.success {
  background: var(--badge-ok-bg);
  color: var(--badge-ok-text);
  border: 1px solid #bbf7d0;
}

.feedback-banner.error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.dismiss-feedback-btn {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  background: #182235;
  color: #ffffff;
  padding: 12px 18px;
  border-radius: 9px;
  display: none;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  z-index: 99999;
}

.toast.show {
  display: block;
  animation: toastIn 0.2s ease-out;
}

@keyframes toastIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ACTIVIDAD LIST */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.activity-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
  font-size: 12.5px;
}

.activity-row:last-child {
  border: 0;
}

.activity-glyph {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--b-light);
  color: var(--b);
  display: grid;
  place-items: center;
  font-size: 11px;
}

.activity-glyph.error {
  background: #fee2e2;
  color: #dc2626;
}

.activity-text {
  flex: 1;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-time {
  color: var(--muted);
  font-size: 11px;
}

/* SPINNERS */
.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner-large {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: var(--b);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

.panel-loading,
.panel-empty {
  padding: 30px;
  text-align: center;
}

.gallery-loading,
.gallery-empty {
  padding: 48px;
  text-align: center;
  margin-top: 15px;
}

.empty-icon-large {
  font-size: 36px;
  margin-bottom: 8px;
}

/* RESPONSIVE */
@media (max-width: 900px) {
  .side {
    width: 70px;
  }
  .side .logo span,
  .side .navtitle,
  .side .nav button span,
  .side .user {
    display: none;
  }
  .side .nav button {
    justify-content: center;
    padding: 12px 0;
  }
  .main {
    margin-left: 70px;
    width: calc(100% - 70px);
  }
  .cards {
    grid-template-columns: repeat(2, 1fr);
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .row {
    grid-template-columns: 1.5fr 1fr 1fr 80px;
  }
  .row > *:nth-child(2) {
    display: none;
  }
}

@media (max-width: 600px) {
  .page {
    padding: 20px 14px;
  }
  .cards,
  .projects {
    grid-template-columns: 1fr;
  }
  .head {
    flex-direction: column;
    gap: 14px;
  }
}
</style>
