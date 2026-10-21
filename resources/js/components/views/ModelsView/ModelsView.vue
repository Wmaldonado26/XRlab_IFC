

<script setup lang="ts">
import { useModelsView } from './ModelsView.logic';
const emit = defineEmits(["open-project", "show-toast"]);
const { ref, computed, onMounted, fetchBackendModels, fetchBackendProjects, uploadDirectFrag, convertIfcViaBackend, IfcUploadProgress, models, projects, isLoading, searchQuery, isUploadModalOpen, selectedProjectId, selectedFiles, selectedFile, selectedTotalSizeMB, fileInputRef, isUploading, uploadPhase, uploadProgress, uploadStage, uploadSpeed, uploadRemaining, uploadError, currentUploadingFileName, uploadState, loadData, getFormat, formatDate, openModelInViewer, onFileSelected, handleStartUpload } = useModelsView(emit);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Modelos BIM</h1>
        <p>Archivos IFC y FRAG registrados en la plataforma.</p>
      </div>
      <button class="primary-btn" @click="isUploadModalOpen = true">
        ↑ Cargar modelo
      </button>
    </div>

    <div v-if="isLoading" class="panel" style="padding: 40px; text-align: center; color: var(--muted)">
      Cargando modelos BIM...
    </div>

    <div v-else-if="models.length === 0" class="panel" style="padding: 50px; text-align: center">
      <div style="font-size: 32px; margin-bottom: 12px">◇</div>
      <h3 style="margin: 0 0 8px; color: var(--text)">No hay modelos registrados</h3>
      <p style="color: var(--muted); font-size: 13px; margin: 0 0 20px">
        Comienza cargando un modelo IFC o FRAG en cualquiera de tus proyectos activos.
      </p>
      <button class="primary-btn" @click="isUploadModalOpen = true">+ Cargar primer modelo</button>
    </div>

    <div v-else class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>Modelo</th>
            <th>Proyecto</th>
            <th>Formato</th>
            <th>Tamaño</th>
            <th>Estado</th>
            <th>Última actualización</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in models" :key="m.id">
            <td>
              <b>{{ m.name }}</b>
              <br>
              <small style="color: #8996aa">ID: {{ m.id.substring(0, 12) }}</small>
            </td>
            <td>{{ m.projectName || 'Proyecto ' + m.projectId.substring(0, 8) }}</td>
            <td>
              <span class="badge" style="background: #eef3f8; color: var(--blue); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 10px">
                {{ getFormat(m.name) }}
              </span>
            </td>
            <td>{{ m.sizeFormatted || '—' }}</td>
            <td>
              <span v-if="m.status === 'ready'" class="status ok">Disponible</span>
              <span v-else-if="m.status === 'processing'" class="status warn">Procesando</span>
              <span v-else class="status err">Error</span>
            </td>
            <td>{{ formatDate(m.updatedAt || m.createdAt) }}</td>
            <td style="text-align: right">
              <button class="secondary-btn" style="padding: 6px 12px; font-size: 11px" @click="openModelInViewer(m)">
                Abrir en Visor
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL CARGAR MODELO BIM -->
    <div v-if="isUploadModalOpen" class="modal-backdrop open" @click.self="isUploadModalOpen = false">
      <div class="modal">
        <div class="modal-head">
          <h3>Cargar modelo BIM</h3>
          <button class="close" @click="isUploadModalOpen = false">×</button>
        </div>
        <div class="modal-body">
          <div
            class="upload-zone"
            @click="fileInputRef?.click()"
            style="cursor: pointer"
          >
            <div class="big">◇</div>
            <strong v-if="selectedFiles.length === 0">Selecciona uno o varios archivos IFC o FRAG</strong>
            <strong v-else-if="selectedFiles.length === 1" style="color: var(--blue)">{{ selectedFiles[0].name }} ({{ (selectedFiles[0].size / (1024 * 1024)).toFixed(2) }} MB)</strong>
            <strong v-else style="color: var(--blue)">{{ selectedFiles.length }} archivos seleccionados ({{ selectedTotalSizeMB }} MB)</strong>
            <span>Los archivos se procesan de forma controlada en el backend.</span>
            <input
              ref="fileInputRef"
              type="file"
              accept=".ifc,.frag"
              multiple
              style="display: none"
              @change="onFileSelected"
            >
          </div>

          <div style="margin-top: 18px">
            <label style="font-size: 11px; font-weight: 800; display: block; margin-bottom: 6px">
              Proyecto destino
            </label>
            <select v-model="selectedProjectId" style="width: 100%">
              <option v-for="p in projects" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>
          </div>

          <!-- Barra de progreso real si está subiendo -->
          <div v-if="isUploading" style="margin-top: 20px">
            <IfcUploadProgress
              :state="uploadState"
              :file-name="currentUploadingFileName"
              :progress-percent="uploadProgress"
              :stage-text="uploadStage"
              :error-message="uploadError"
            />
          </div>
        </div>
        <div class="modal-foot">
          <button class="secondary-btn" :disabled="isUploading" @click="isUploadModalOpen = false">
            Cancelar
          </button>
          <button class="primary-btn" :disabled="isUploading || selectedFiles.length === 0" @click="handleStartUpload">
            Iniciar carga
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
