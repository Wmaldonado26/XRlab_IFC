<script setup lang="ts">
import type { BackendProject } from '../../services/backend-client';
import { useViewerCo } from './ViewerCo.logic';
const props = defineProps<{
  initialProject: BackendProject | null;
}>();
const emit = defineEmits(["project-changed", "return-gallery"]);
const { onMounted, onUnmounted, ref, computed, watch, nextTick, THREE, OBC, BUI, BUIC, OBCF, downloadFragmentFile, processIfcFile, MassiveIfcFileError, MAX_SAFE_BROWSER_IFC_SIZE, checkBackendHealth, convertIfcViaBackend, downloadBackendFragments, downloadBackendFragmentsProgressive, downloadBackendFragmentPart, downloadModelFragment, uploadDirectFrag, saveProjectFragments, getProjectFragments, appendProjectFragments, deleteCachedProject, ErrorLogModal, SectionPlaneBar, ViewerToolbar, ProjectsModal, LoginModal, AdminPanelModal, currentUser, isAdmin, logout, appLogger, viewerDiagnostics, isSectionActive, isProjectsModalOpen, isLoginModalOpen, isAdminModalOpen, isPanelCollapsed, clipAxis, clipOffset, clipInverted, modelBounds, clipBounds, activeKeys, wasdFrameId, lastWasdTime, isWasdActive, handleKeyDown, handleKeyUp, handleWindowBlur, startWasdLoop, containerRef, ifcLoadInput, ifcConvertInput, ifcInput, fragInput, isLogModalOpen, errorLogCount, openLogModal, updateErrorCount, isLoading, loadingProgress, loadingFileName, loadingFileSize, loadingStage, loadingMessage, loadingSubtitle, panelVisible, backendStatus, isBackendProcessing, massiveModalVisible, massiveModelInfo, copiedCommand, copiedDevAll, copyCommand, copyDevAllCommand, checkBackendAndRetry, components, panel, world, fragmentManager, highlighter, updatePropertiesTable, updateSpatialTree, updateModelsList, activeProjectId, activeProjectName, activeLoadGeneration, currentLoadAbortController, isViewerReady, healthInterval, isMobileOrTabletDevice, enforceSafePixelRatio, fitCameraDebounceTimer, debouncedFitCamera, refreshSpatialTreeSafely, togglePanel, fitCameraToModels, updateClippingPlane, onUpdateClipAxis, onUpdateClipOffset, onUpdateClipInverted, setCameraPreset, clearScene, loadCachedModel, loadBackendProject, loadBackendModel, openIfcLoadDialog, openIfcConvertDialog, openIfcDialog, openFragDialog, onLoginSuccess, handleLogout, handleMixedFilesSelected, onIfcLoadSelected, onIfcConvertSelected, onIfcFileSelected, onFragFileSelected, handleDrop, loadMultipleFragFiles, loadFragFile, processMultipleIfcFiles, processAndConvertIfc, downloadCurrentFrag } = useViewerCo(props, emit);
</script>

<template>
    <!-- Technical BIM Loading HUD (Optimized for Heavy IFC / Fragments) -->
    <div v-if="isLoading" class="loading-overlay">
        <div class="bim-hud-card">
            <div class="hud-header">
                <div class="hud-title-wrap">
                    <span class="hud-icon">{{ isBackendProcessing ? '🚀' : '⚡' }}</span>
                    <div>
                        <h3 class="hud-title">{{ isBackendProcessing ? 'Microservicio Local • 64-bit BitSet' : 'Motor BIM • Carga de Alto Rendimiento' }}</h3>
                        <p class="hud-subtitle">{{ loadingSubtitle }}</p>
                    </div>
                </div>
                <div class="hud-badge" :class="{ 'backend-badge': isBackendProcessing }">
                    <span class="hud-pulse" :class="{ 'backend-pulse': isBackendProcessing }"></span>
                    <span>{{ isBackendProcessing ? 'NODE 64-BIT' : 'WASM 4GB' }}</span>
                </div>
            </div>

            <div class="hud-file-info">
                <div class="file-info-row">
                    <span class="file-name" :title="loadingFileName">{{ loadingFileName || 'Modelo BIM' }}</span>
                    <span v-if="loadingFileSize" class="file-size">{{ loadingFileSize }}</span>
                </div>
            </div>

            <div class="hud-progress-block">
                <div class="progress-labels">
                    <span class="stage-text">{{ loadingStage || loadingMessage }}</span>
                    <span class="percentage-text">{{ loadingProgress }}%</span>
                </div>
                <div class="progress-track">
                    <div
                        class="progress-fill"
                        :style="{ width: `${Math.min(Math.max(loadingProgress, 3), 100)}%` }"
                    ></div>
                </div>
            </div>

            <div class="hud-footer">
                <span class="hud-tech-note">Stream directo a memoria GPU • Sin duplicación en Heap JS</span>
            </div>
        </div>
    </div>

    <!-- Modal Informativo para Modelos IFC Masivos (> 1.85 GB) -->
    <div v-if="massiveModalVisible" class="loading-overlay" style="z-index: 100000;">
        <div class="bim-hud-card massive-modal-card">
            <div class="hud-header">
                <div class="hud-title-wrap">
                    <span class="hud-icon massive-icon">🚢</span>
                    <div>
                        <h3 class="hud-title">Modelo IFC Masivo Detectado</h3>
                        <p class="hud-subtitle">Límite físico de direccionamiento WebAssembly 32-bit</p>
                    </div>
                </div>
                <div class="hud-badge massive-badge">
                    <span>{{ massiveModelInfo.sizeGB }} GB</span>
                </div>
            </div>

            <div class="massive-modal-body">
                <p class="massive-text">
                    El archivo <strong>{{ massiveModelInfo.name }}</strong> ({{ massiveModelInfo.sizeGB }} GB) supera el límite de memoria direccionable de <strong>32 bits de WebAssembly</strong> (~1.85 GB) en navegadores web.
                </p>
                <p class="massive-text">
                    Para procesar este modelo naval gigantesco de forma 100% transparente en el visor, puedes iniciar el <strong>microservicio local de 64 bits</strong> (recomendado), o convertirlo manualmente:
                </p>

                <div class="terminal-command-box">
                    <div class="command-header">
                        <span>Opción A: Microservicio Local (Carga Automática en Web)</span>
                        <button class="copy-cmd-btn" type="button" @click="copyDevAllCommand">
                            {{ copiedDevAll ? '✓ Copiado' : 'Copiar comando' }}
                        </button>
                    </div>
                    <code class="command-code">npm run dev:all</code>
                </div>

                <div class="terminal-command-box" style="margin-top: 10px;">
                    <div class="command-header">
                        <span>Opción B: Conversor CLI Autónomo</span>
                        <button class="copy-cmd-btn" type="button" @click="copyCommand">
                            {{ copiedCommand ? '✓ Copiado' : 'Copiar comando' }}
                        </button>
                    </div>
                    <code class="command-code">{{ massiveModelInfo.command }}</code>
                </div>

                <div class="massive-hint-box">
                    <span>💡</span>
                    <p class="massive-hint">
                        <strong>Una vez iniciado <code>npm run dev:all</code>:</strong><br />
                        Vuelve a arrastrar el archivo IFC masivo. El microservicio lo procesará en streaming y lo inyectará directamente en la escena 3D sin crasheos de memoria.
                    </p>
                </div>
            </div>

            <div class="massive-modal-footer">
                <button class="retry-btn" type="button" @click="checkBackendAndRetry">
                    Comprobar microservicio
                </button>
                <button class="close-modal-btn" type="button" @click="massiveModalVisible = false">
                    Entendido
                </button>
            </div>
        </div>
    </div>

    <div
        ref="containerRef"
        class="full-screen"
        @dragover.prevent
        @drop.prevent="handleDrop"
    >
        <!-- Barra superior flotante (.vtop) -->
        <div v-if="isAdmin" class="vtop">
            <div class="vtop-right-group">
                <!-- Pill de estado del microservicio 64-bit (Solo Administrador) -->
                <div
                    class="backend-status-pill"
                    :class="{ 'is-online': backendStatus.online }"
                    :title="backendStatus.online ? `Microservicio 64-bit conectado (RAM libre: ${backendStatus.freeMemoryGB} GB)` : 'Microservicio desconectado'"
                >
                    <span class="status-dot"></span>
                    <span class="status-text">{{ backendStatus.online ? 'Backend 64-bit' : 'Offline' }}</span>
                </div>
            </div>
        </div>

        <bim-grid id="appGrid"></bim-grid>
        <input
            ref="ifcLoadInput"
            type="file"
            accept=".ifc,.frag"
            multiple
            style="display: none"
            @change="onIfcLoadSelected"
        />
        <input
            ref="ifcConvertInput"
            type="file"
            accept=".ifc,.frag"
            multiple
            style="display: none"
            @change="onIfcConvertSelected"
        />
        <input
            ref="fragInput"
            type="file"
            accept=".frag,.ifc"
            multiple
            style="display: none"
            @change="onFragFileSelected"
        />

        <!-- Barra flotante de control de planos de sección 3D -->
        <SectionPlaneBar
            v-if="isSectionActive"
            :axis="clipAxis"
            :offset="clipOffset"
            :inverted="clipInverted"
            :min="clipBounds.min"
            :max="clipBounds.max"
            @update:axis="onUpdateClipAxis"
            @update:offset="onUpdateClipOffset"
            @update:inverted="onUpdateClipInverted"
            @close="isSectionActive = false"
        />

        <!-- Botón Plegable Flotante para el Menú Lateral (Menú BIM a la izquierda) -->
        <button
            class="panel-toggle-tab"
            :class="{ 'is-collapsed': isPanelCollapsed }"
            :title="isPanelCollapsed ? 'Mostrar menú BIM (Árbol y Propiedades) [P]' : 'Ocultar menú BIM [P]'"
            type="button"
            @click="togglePanel"
        >
            <span class="toggle-icon">{{ isPanelCollapsed ? '▶' : '◀' }}</span>
            <span v-if="isPanelCollapsed" class="toggle-label">Menú BIM</span>
        </button>

        <!-- Dock Flotante de Herramientas del Visor -->
        <ViewerToolbar
            :is-section-active="isSectionActive"
            @open-ifc="openIfcLoadDialog"
            @open-frag="openFragDialog"
            @toggle-section="isSectionActive = !isSectionActive"
            @set-camera-view="setCameraPreset"
            @open-projects="isProjectsModalOpen = true"
            @clear-scene="clearScene"
        />
    </div>

    <!-- Modal de Catálogo de Proyectos y Caché Local -->
    <ProjectsModal
        v-model="isProjectsModalOpen"
        @load-cached="loadCachedModel"
        @load-backend="loadBackendProject"
        @load-model="loadBackendModel"
    />

    <!-- Modal de Consola y Logs de Errores -->
    <ErrorLogModal v-model="isLogModalOpen" />

    <!-- Modal de Inicio de Sesión -->
    <LoginModal
        v-model="isLoginModalOpen"
        @login-success="onLoginSuccess"
    />

    <!-- Modal de Administración de Usuarios -->
    <AdminPanelModal
        v-if="isAdmin"
        v-model="isAdminModalOpen"
    />
</template>
<style src="./ViewerCo.shared.css"></style>
<style scoped src="./ViewerCo.css"></style>




