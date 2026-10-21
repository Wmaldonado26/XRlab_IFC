<script setup lang="ts">
import { useProjectsView } from './ProjectsView.logic';
const emit = defineEmits(["open-project", "show-toast", "toast"]);
const { ref, computed, onMounted, isAdmin, fetchBackendProjects, createBackendProject, updateBackendProject, deleteBackendProject, uploadProjectCover, deleteProjectCover, uploadDirectFrag, convertIfcViaBackend, IfcUploadProgress, projects, isLoading, searchQuery, statusFilter, showCreateModal, createForm, isSubmitting, createFile, createFiles, uploadedCreateFiles, getCreateFileKey, fileInputRef, createModelState, createError, createdProject, createAbortController, createProgress, createCoverFile, createCoverPreview, createCoverInputRef, directCoverInputRef, targetCoverProject, uploadingCoverProjectId, manageCoverInputRef, showManageModal, manageProjectTarget, editForm, filteredProjects, getCoverGradient, truncate, loadProjects, searchDebounce, onSearchInput, openCreateModal, onCreateCoverSelected, removeCreateCover, onFileSelected, cancelUpload, submitCreateProject, openManageModal, triggerCoverUpload, onDirectCoverSelected, handleDeleteCover, onManageCoverSelected, onManageCoverDelete, onImageError, submitUpdateProject, handleDeleteProject } = useProjectsView(emit);
defineExpose({ openCreateModal, loadProjects });
</script>

<template>
  <div class="page">
    <!-- Page Header -->
    <div class="page-head">
      <div>
        <h1>Proyectos</h1>
        <p>Gestiona los proyectos y sus modelos BIM asociados.</p>
      </div>
      <button
        v-if="isAdmin"
        type="button"
        class="primary-btn"
        @click="openCreateModal"
      >
        + Nuevo proyecto
      </button>
    </div>

    <!-- Filters Toolbar -->
    <div class="filters">
      <input
        v-model="searchQuery"
        class="search"
        placeholder="⌕  Buscar proyecto..."
        @input="onSearchInput"
      />
      <select v-model="statusFilter" style="max-width: 180px;">
        <option value="all">Todos los estados</option>
        <option value="active">Con modelos activos</option>
        <option value="empty">Sin modelos</option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" style="padding: 40px; text-align: center; color: var(--muted);">
      Cargando proyectos desde el servidor...
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredProjects.length === 0" style="padding: 40px; text-align: center; color: var(--muted); background: #ffffff; border-radius: var(--radius); border: 1px solid var(--line);">
      <div style="font-size: 32px; margin-bottom: 8px;">⚓</div>
      <b style="color: var(--navy); font-size: 15px;">No se encontraron proyectos</b>
      <p style="margin-top: 4px; font-size: 13px;">{{ searchQuery ? 'Prueba con otros términos de búsqueda.' : 'Crea tu primer proyecto para comenzar a visualizar modelos BIM.' }}</p>
    </div>

    <!-- Projects Grid Cards -->
    <div v-else class="cards">
      <article
        v-for="(proj, index) in filteredProjects"
        :key="proj.id"
        class="project-card"
      >
        <div
          class="project-cover"
          :class="{ 'has-image': Boolean(proj.imageUrl) }"
          :style="{ background: proj.imageUrl ? undefined : getCoverGradient(index) }"
        >
          <!-- Real Project Cover Image -->
          <img
            v-if="proj.imageUrl"
            :src="proj.imageUrl"
            :alt="proj.name"
            class="project-cover-image"
            loading="lazy"
            @error="onImageError(proj)"
          />
          <div v-if="proj.imageUrl" class="project-cover-overlay"></div>

          <span class="badge">
            {{ (proj.modelsCount > 0 || (proj.parts && proj.parts.length > 0)) ? 'PROYECTO ACTIVO' : 'SIN MODELOS' }}
          </span>

          <!-- Direct action in cover for admin: add / change image -->
          <div v-if="isAdmin" class="cover-actions" @click.stop>
            <button
              type="button"
              class="cover-btn"
              :disabled="uploadingCoverProjectId === proj.id"
              :title="proj.imageUrl ? 'Cambiar imagen del proyecto' : 'Agregar imagen al proyecto'"
              @click.stop="triggerCoverUpload(proj)"
            >
              <span v-if="uploadingCoverProjectId === proj.id">⏳</span>
              <span v-else>📷</span>
              <span>{{ proj.imageUrl ? 'Cambiar foto' : '+ Foto' }}</span>
            </button>
            <button
              v-if="proj.imageUrl"
              type="button"
              class="cover-btn btn-remove"
              :disabled="uploadingCoverProjectId === proj.id"
              title="Quitar imagen del proyecto"
              @click.stop="handleDeleteCover(proj)"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="project-body">
          <h3 :title="proj.name">{{ proj.name }}</h3>
          <p :title="proj.description || ''">
            {{ proj.description ? truncate(proj.description, 90) : 'Modelo digital para seguimiento de construcción naval y revisión en campo.' }}
          </p>

          <div class="project-meta">
            <span>{{ proj.modelsCount || (proj.parts ? proj.parts.length : 0) }} modelos</span>
            <span>{{ proj.totalPartsSizeMB ? `${proj.totalPartsSizeMB} MB` : 'Listo' }}</span>
          </div>

          <div class="project-actions">
            <button
              type="button"
              class="secondary-btn"
              :disabled="!(proj.modelsCount > 0 || (proj.parts && proj.parts.length > 0))"
              :title="!(proj.modelsCount > 0 || (proj.parts && proj.parts.length > 0)) ? 'Carga primero un modelo para abrir el visor' : 'Abrir visor 3D'"
              @click="$emit('open-project', proj)"
            >
              Abrir visor
            </button>
            <button
              v-if="isAdmin"
              type="button"
              class="primary-btn"
              @click="openManageModal(proj)"
            >
              Gestionar
            </button>
          </div>
        </div>
      </article>
    </div>

    <!-- Hidden file input for direct cover uploads from card -->
    <input
      ref="directCoverInputRef"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
      style="display: none;"
      @change="onDirectCoverSelected"
    />

    <!-- =================================================================== -->
    <!-- MODAL: CREAR PROYECTO (Exacto al prototipo con Carga Real Integrada)-->
    <!-- =================================================================== -->
    <div
      class="modal-backdrop"
      :class="{ open: showCreateModal }"
      @click.self="createModelState !== 'UPLOADING' && !isSubmitting ? (showCreateModal = false) : null"
    >
      <div class="modal project-create-modal">
        <div class="modal-head">
          <h3>Crear nuevo proyecto</h3>
          <button
            type="button"
            class="close"
            :disabled="createModelState === 'UPLOADING' || isSubmitting"
            @click="showCreateModal = false"
          >
            ×
          </button>
        </div>

        <form @submit.prevent="submitCreateProject">
          <div class="modal-body">
            <div class="form-group">
              <label>Nombre del proyecto *</label>
              <input
                v-model="createForm.name"
                placeholder="Ej. Patrullera OPV"
                required
                :disabled="createModelState === 'UPLOADING' || isSubmitting"
              />
            </div>

            <div class="form-group">
              <label>Descripción</label>
              <textarea
                v-model="createForm.description"
                rows="3"
                placeholder="Detalles del buque, estructura o coordinación..."
                :disabled="createModelState === 'UPLOADING' || isSubmitting"
              ></textarea>
            </div>

            <div class="form-group">
              <label>Imagen de portada (opcional)</label>
              <div v-if="createCoverPreview" class="cover-upload-preview">
                <img :src="createCoverPreview" alt="Vista previa de portada" class="cover-upload-thumbnail" />
                <div style="flex: 1; min-width: 0;">
                  <strong style="font-size: 13px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    {{ createCoverFile?.name }}
                  </strong>
                  <span style="font-size: 11px; color: var(--muted);">
                    {{ createCoverFile ? (createCoverFile.size / 1024).toFixed(0) + ' KB' : '' }}
                  </span>
                </div>
                <button
                  type="button"
                  class="secondary-btn"
                  style="padding: 4px 10px; font-size: 12px; color: var(--danger); border-color: #fca5a5;"
                  :disabled="createModelState === 'UPLOADING' || isSubmitting"
                  @click="removeCreateCover"
                >
                  ✕ Quitar
                </button>
              </div>
              <div
                v-else
                class="upload-zone"
                style="padding: 16px; min-height: auto;"
                @click="createCoverInputRef?.click()"
              >
                <div style="font-size: 22px; margin-bottom: 2px;">🖼️</div>
                <strong style="font-size: 13px;">Cargar imagen de portada</strong>
                <span style="font-size: 11.5px;">Archivos JPG, PNG o WEBP (máx. 10 MB)</span>
                <input
                  ref="createCoverInputRef"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  style="display: none;"
                  @change="onCreateCoverSelected"
                />
              </div>
            </div>

            <div class="form-group">
              <label>Archivos del modelo inicial (varios FRAG o un IFC)</label>
              <div
                v-if="createModelState === 'IDLE'"
                class="upload-zone"
                @click="fileInputRef?.click()"
              >
                <div class="big">↑</div>
                <strong>Cargar modelos iniciales</strong>
                <span>Selecciona varios archivos .frag o un solo .ifc</span>
                <input
                  ref="fileInputRef"
                  type="file"
                  accept=".ifc,.frag"
                  multiple
                  style="display: none;"
                  @change="onFileSelected"
                />
              </div>

              <!-- Real Upload Progress Bar Integration -->
              <IfcUploadProgress
                v-else
                :state="createModelState"
                :file-name="createFile?.name"
                :file-size="createFile?.size"
                :progress-percent="createProgress.percent"
                :loaded-bytes="createProgress.loadedBytes"
                :total-bytes="createProgress.totalBytes"
                :speed-bytes-per-sec="createProgress.speedBytesPerSec"
                :remaining-sec="createProgress.remainingSec"
                :stage-text="createProgress.stage"
                :error-message="createError"
                @cancel="cancelUpload"
                @retry="submitCreateProject"
                @change-file="fileInputRef?.click()"
              />
              <ul v-if="createFiles.length > 0" style="margin: 8px 0 0; padding: 0; list-style: none; font-size: 12px;">
                <li v-for="(file, index) in createFiles" :key="`${file.name}-${file.lastModified}-${file.size}-${index}`" style="padding: 4px 0; color: var(--muted);">
                  {{ uploadedCreateFiles.includes(getCreateFileKey(file)) ? '✓' : '•' }} {{ file.name }}
                  <span v-if="uploadedCreateFiles.includes(getCreateFileKey(file))" style="color: #15803d;">Cargado</span>
                </li>
              </ul>
            </div>
          </div>

          <div class="modal-foot">
            <button
              type="button"
              class="secondary-btn"
              :disabled="createModelState === 'UPLOADING' || isSubmitting"
              @click="showCreateModal = false"
            >
              Cancelar
            </button>

            <button
              v-if="createModelState === 'COMPLETED' && createdProject"
              type="button"
              class="primary-btn"
              @click="$emit('open-project', createdProject); showCreateModal = false;"
            >
              ⚡ Abrir visor
            </button>

            <button
              v-else
              type="submit"
              class="primary-btn"
              :disabled="!createForm.name.trim() || isSubmitting || createModelState === 'UPLOADING'"
            >
              <span v-if="isSubmitting || createModelState === 'UPLOADING'">Procesando...</span>
              <span v-else>{{ createFiles.length ? `Crear proyecto y cargar ${createFiles.length} archivo${createFiles.length === 1 ? '' : 's'}` : 'Crear proyecto' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL: GESTIONAR PROYECTO (Edición y Eliminación Segura)            -->
    <!-- =================================================================== -->
    <div
      class="modal-backdrop"
      :class="{ open: showManageModal && Boolean(manageProjectTarget) }"
      @click.self="!isSubmitting ? (showManageModal = false) : null"
    >
      <div class="modal">
        <div class="modal-head">
          <h3>Gestionar proyecto</h3>
          <button type="button" class="close" @click="showManageModal = false">×</button>
        </div>

        <div v-if="manageProjectTarget" class="modal-body">
          <div class="form-group">
            <label>Nombre del proyecto</label>
            <input v-model="editForm.name" required />
          </div>

          <div class="form-group">
            <label>Descripción</label>
            <textarea v-model="editForm.description" rows="3"></textarea>
          </div>

          <div class="form-group" style="margin-top: 15px;">
            <label>Imagen de portada</label>
            <div v-if="manageProjectTarget.imageUrl" class="cover-upload-preview">
              <img :src="manageProjectTarget.imageUrl" alt="Portada actual" class="cover-upload-thumbnail" />
              <div style="flex: 1; min-width: 0;">
                <strong style="font-size: 13px; display: block;">Portada personalizada activa</strong>
                <span style="font-size: 11.5px; color: var(--muted);">Visible en la tarjeta de proyecto</span>
              </div>
              <div style="display: flex; gap: 6px;">
                <button
                  type="button"
                  class="secondary-btn"
                  style="padding: 5px 10px; font-size: 12px;"
                  :disabled="isSubmitting"
                  @click="manageCoverInputRef?.click()"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  class="secondary-btn"
                  style="padding: 5px 10px; font-size: 12px; color: var(--danger); border-color: #fca5a5;"
                  :disabled="isSubmitting"
                  @click="onManageCoverDelete"
                >
                  ✕ Quitar
                </button>
              </div>
            </div>
            <div
              v-else
              class="upload-zone"
              style="padding: 16px; min-height: auto;"
              @click="manageCoverInputRef?.click()"
            >
              <div style="font-size: 22px; margin-bottom: 2px;">🖼️</div>
              <strong style="font-size: 13px;">Agregar imagen de portada</strong>
              <span style="font-size: 11.5px;">Haz clic para asignar una foto representativa (JPG, PNG o WEBP)</span>
            </div>
            <input
              ref="manageCoverInputRef"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              style="display: none;"
              @change="onManageCoverSelected"
            />
          </div>

          <div style="margin-top: 20px; padding: 14px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 11px;">
            <b style="color: var(--danger); font-size: 13px;">Zona de peligro</b>
            <p style="font-size: 12px; color: #7f1d1d; margin: 5px 0 10px;">
              Eliminar el proyecto borrará permanentemente sus modelos asociados en almacenamiento y base de datos.
            </p>
            <button
              type="button"
              class="secondary-btn"
              style="color: var(--danger); border-color: #fca5a5;"
              :disabled="isSubmitting"
              @click="handleDeleteProject"
            >
              🗑️ Eliminar proyecto
            </button>
          </div>
        </div>

        <div class="modal-foot">
          <button type="button" class="secondary-btn" @click="showManageModal = false">Cerrar</button>
          <button type="button" class="primary-btn" :disabled="isSubmitting || !editForm.name.trim()" @click="submitUpdateProject">
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
<style src="./ProjectsView.css"></style>
