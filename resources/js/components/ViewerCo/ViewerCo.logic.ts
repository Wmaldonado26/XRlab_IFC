import { onMounted, onUnmounted, ref, computed, watch, nextTick } from "vue";

import * as THREE from "three";

import * as OBC from "@thatopen/components";

import * as BUI from "@thatopen/ui";

import * as BUIC from "@thatopen/ui-obc";

import * as OBCF from "@thatopen/components-front";

import { downloadFragmentFile, processIfcFile, MassiveIfcFileError, MAX_SAFE_BROWSER_IFC_SIZE } from "../../services/ifc-processor";

import {
    checkBackendHealth,
    convertIfcViaBackend,
    downloadBackendFragments,
    downloadBackendFragmentsProgressive,
    downloadBackendFragmentPart,
    downloadModelFragment,
    uploadDirectFrag,
    type BackendHealth,
    type BackendProject,
    type BackendModelItem,
} from "../../services/backend-client";

import { saveProjectFragments, getProjectFragments, appendProjectFragments, deleteCachedProject } from "../../services/frag-cache";

import ErrorLogModal from "../ErrorLogModal/ErrorLogModal.vue";

import SectionPlaneBar from "../SectionPlaneBar/SectionPlaneBar.vue";

import ViewerToolbar from "../ViewerToolbar/ViewerToolbar.vue";

import ProjectsModal from "../ProjectsModal/ProjectsModal.vue";

import LoginModal from "../LoginModal/LoginModal.vue";

import AdminPanelModal from "../AdminPanelModal/AdminPanelModal.vue";

import {
    currentUser,
    isAdmin,
    logout,
} from "../../services/auth-service";

import { appLogger } from "../../services/logger";

import { viewerDiagnostics } from "../../services/viewer-diagnostics";

export function useViewerCo<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(props: TProps, emit: (...args: any[]) => any) {
  // Estado de UI de Herramientas y Modales
  const isSectionActive = ref(false);

  const isProjectsModalOpen = ref(false);

  const isLoginModalOpen = ref(false);

  const isAdminModalOpen = ref(false);

  const isPanelCollapsed = ref(false);

  const clipAxis = ref<'x' | 'y' | 'z'>('y');

  const clipOffset = ref(0);

  const clipInverted = ref(false);

  const modelBounds = ref<{
      min: [number, number, number];
      max: [number, number, number];
      center: [number, number, number];
      size: [number, number, number];
  }>({
      min: [-100, -20, -100],
      max: [100, 50, 100],
      center: [0, 15, 0],
      size: [200, 70, 200],
  });

  const clipBounds = computed(() => {
      const idx = clipAxis.value === 'x' ? 0 : clipAxis.value === 'y' ? 1 : 2;
      return {
          min: modelBounds.value.min[idx],
          max: modelBounds.value.max[idx],
      };
  });

  // --- Sistema de Navegación Espacial en Primera Persona (WASD + Q/E) ---
  const activeKeys = new Set<string>();

  let wasdFrameId: number | null = null;

  let lastWasdTime = performance.now();

  const isWasdActive = ref(false);

  const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
      }
      if (!e.key) return;
      const key = e.key.toLowerCase();
      if (key === 'p') {
          togglePanel();
          return;
      }
      if (['w', 'a', 's', 'd', 'q', 'e', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
          activeKeys.add(key);
          isWasdActive.value = true;
      }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.key) return;
      const key = e.key.toLowerCase();
      activeKeys.delete(key);
      if (activeKeys.size === 0) {
          isWasdActive.value = false;
      }
  };

  const handleWindowBlur = () => {
      activeKeys.clear();
      isWasdActive.value = false;
  };

  const startWasdLoop = () => {
      lastWasdTime = performance.now();
  
      const loop = () => {
          const now = performance.now();
          const deltaMs = now - lastWasdTime;
          const delta = Math.min(deltaMs / 1000, 0.1);
          lastWasdTime = now;
          viewerDiagnostics.onRenderFrame(deltaMs);
  
          if (activeKeys.size > 0 && world?.camera?.controls) {
              const controls = world.camera.controls as any;
  
              // Escala de velocidad inteligente basada en las dimensiones reales del modelo
              const modelDim = Math.max(modelBounds.value?.size?.[0] || 50, modelBounds.value?.size?.[1] || 20, 20);
              const baseSpeed = Math.max(8, modelDim * 0.15);
              const speedMultiplier = activeKeys.has('shift') ? 2.8 : 1.0;
              const dist = baseSpeed * speedMultiplier * delta;
  
              // W / Flecha Arriba: Avanzar hacia adelante en la dirección de la cámara
              if (activeKeys.has('w') || activeKeys.has('arrowup')) {
                  if (typeof controls.forward === 'function') {
                      controls.forward(dist, false);
                  } else if (typeof controls.dolly === 'function') {
                      controls.dolly(dist, false);
                  }
              }
  
              // S / Flecha Abajo: Retroceder
              if (activeKeys.has('s') || activeKeys.has('arrowdown')) {
                  if (typeof controls.forward === 'function') {
                      controls.forward(-dist, false);
                  } else if (typeof controls.dolly === 'function') {
                      controls.dolly(-dist, false);
                  }
              }
  
              // A / Flecha Izquierda: Desplazamiento lateral (Strafe Left)
              if (activeKeys.has('a') || activeKeys.has('arrowleft')) {
                  if (typeof controls.truck === 'function') {
                      controls.truck(-dist, 0, false);
                  }
              }
  
              // D / Flecha Derecha: Desplazamiento lateral (Strafe Right)
              if (activeKeys.has('d') || activeKeys.has('arrowright')) {
                  if (typeof controls.truck === 'function') {
                      controls.truck(dist, 0, false);
                  }
              }
  
              // E: Subir de nivel / ascender cubierta
              if (activeKeys.has('e')) {
                  if (typeof controls.elevate === 'function') {
                      controls.elevate(dist, false);
                  } else if (typeof controls.truck === 'function') {
                      controls.truck(0, dist, false);
                  }
              }
  
              // Q: Bajar de nivel / descender cubierta
              if (activeKeys.has('q')) {
                  if (typeof controls.elevate === 'function') {
                      controls.elevate(-dist, false);
                  } else if (typeof controls.truck === 'function') {
                      controls.truck(0, -dist, false);
                  }
              }
          }
  
          wasdFrameId = requestAnimationFrame(loop);
      };
  
      wasdFrameId = requestAnimationFrame(loop);
  };

  const containerRef = ref<HTMLDivElement | null>(null);

  const ifcLoadInput = ref<HTMLInputElement | null>(null);

  const ifcConvertInput = ref<HTMLInputElement | null>(null);

  const ifcInput = ifcLoadInput;

  const fragInput = ref<HTMLInputElement | null>(null);

  const isLogModalOpen = ref(false);

  const errorLogCount = ref(0);

  const openLogModal = () => {
      isLogModalOpen.value = true;
  };

  const updateErrorCount = () => {
      errorLogCount.value = appLogger.getErrorCount();
  };

  const isLoading = ref(false);

  const loadingProgress = ref(0);

  const loadingFileName = ref('');

  const loadingFileSize = ref('');

  const loadingStage = ref('Preparando procesador streaming...');

  const loadingMessage = ref('Cargando');

  const loadingSubtitle = ref('Procesamiento Zero-Copy vía Web Worker');

  const panelVisible = ref(true);

  const backendStatus = ref<BackendHealth>({ online: false });

  const isBackendProcessing = ref(false);

  const massiveModalVisible = ref(false);

  const massiveModelInfo = ref({ name: '', sizeGB: '', command: '' });

  const copiedCommand = ref(false);

  const copiedDevAll = ref(false);

  const copyCommand = async () => {
      try {
          await navigator.clipboard.writeText(massiveModelInfo.value.command);
          copiedCommand.value = true;
          setTimeout(() => {
              copiedCommand.value = false;
          }, 2500);
      } catch {
          copiedCommand.value = true;
          setTimeout(() => {
              copiedCommand.value = false;
          }, 2500);
      }
  };

  const copyDevAllCommand = async () => {
      try {
          await navigator.clipboard.writeText('npm run dev:all');
          copiedDevAll.value = true;
          setTimeout(() => {
              copiedDevAll.value = false;
          }, 2500);
      } catch {
          copiedDevAll.value = true;
          setTimeout(() => {
              copiedDevAll.value = false;
          }, 2500);
      }
  };

  const checkBackendAndRetry = async () => {
      const health = await checkBackendHealth();
      backendStatus.value = health;
      if (health.online) {
          massiveModalVisible.value = false;
          alert(`¡Microservicio detectado en línea! (Puerto ${health.port}, RAM libre: ${health.freeMemoryGB} GB). Ya puedes arrastrar o seleccionar tu modelo IFC masivo.`);
      } else {
          alert('Microservicio no detectado en http://localhost:3001. Recuerda ejecutar "npm run dev:all" o "npm run server" en tu terminal.');
      }
  };

  let components: OBC.Components | null = null;

  let panel: any;

  let world: any;

  let fragmentManager!: OBC.FragmentsManager;

  let lastFragmentModelFiles: Array<{ id: string; fileName: string }> = [];

  let highlighter: OBCF.Highlighter | null = null;

  let updatePropertiesTable: ((state?: any) => void) | null = null;

  let updateSpatialTree: ((state?: any) => void) | null = null;

  let updateModelsList: ((state?: any) => void) | null = null;

  const activeProjectId = ref<string | null>(null);

  const activeProjectName = ref<string>('');

  let activeLoadGeneration = 0;

  let currentLoadAbortController: AbortController | null = null;

  let isViewerReady = false;

  let healthInterval: any = null;

  // --- Detección y perfil de hardware móvil / tablet para optimización de memoria RAM ---
  const isMobileOrTabletDevice = (): boolean => {
      if (typeof window === 'undefined' || !window.navigator) return false;
      const ua = navigator.userAgent || '';
      const isTouch = Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|Silk/i.test(ua);
      const isIPadOS = (/Macintosh/i.test(ua) || /iPad/i.test(ua)) && isTouch;
      const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
      return isMobileUA || isIPadOS || isAndroidTablet;
  };

  // Optimización crítica de GPU: limita resolución efectiva para evitar que That Open Engine
  // o pantallas Retina de tablets creen framebuffers de 5400x4000 que provoquen el cierre por OOM.
  const enforceSafePixelRatio = () => {
      if (!world?.renderer?.three) return;
      const isMobile = isMobileOrTabletDevice();
      const maxRatio = isMobile ? 1.0 : 1.5;
      const safeRatio = Math.min(window.devicePixelRatio || 1, maxRatio);
      world.renderer.three.setPixelRatio(safeRatio);
  };

  let fitCameraDebounceTimer: any = null;

  const debouncedFitCamera = (delay = 250) => {
      if (fitCameraDebounceTimer) clearTimeout(fitCameraDebounceTimer);
      fitCameraDebounceTimer = setTimeout(async () => {
          await fitCameraToModels();
      }, delay);
  };

  const refreshSpatialTreeSafely = (models: any[]) => {
      if (!updateSpatialTree) return;
      if (isMobileOrTabletDevice()) {
          console.log('[Viewer] Árbol espacial omitido automáticamente en tablet/móvil para evitar el cierre por falta de memoria RAM.');
          return;
      }
      try {
          updateSpatialTree({ models });
      } catch (err) {
          console.warn('[Viewer] Error al actualizar árbol espacial:', err);
      }
  };

  onMounted(async () => {
      if (!containerRef.value) return;
  
      // Verificar disponibilidad del microservicio local y sondear periódicamente
      backendStatus.value = await checkBackendHealth();
      viewerDiagnostics.setBackendFreeMemory(backendStatus.value.freeMemoryGB || 0);
      if (healthInterval) clearInterval(healthInterval);
      healthInterval = setInterval(async () => {
          backendStatus.value = await checkBackendHealth();
          viewerDiagnostics.setBackendFreeMemory(backendStatus.value.freeMemoryGB || 0);
      }, 8000);
  
      // Inicializar contador de errores y suscribirse a nuevos eventos
      updateErrorCount();
      appLogger.subscribe(updateErrorCount);
  
      BUI.Manager.init();
  
      components = new OBC.Components();
      const worlds = components.get(OBC.Worlds);
      world = worlds.create<
          OBC.SimpleScene,
          OBC.SimpleCamera,
          OBC.SimpleRenderer
      >();
  
      world.scene = new OBC.SimpleScene(components);
      world.scene.three.background = null;
  
      const viewport = document.createElement("bim-viewport");
      world.renderer = new OBC.SimpleRenderer(components, viewport);
      world.camera = new OBC.OrthoPerspectiveCamera(components);
  
      components.init();
  
      // Optimización crítica de GPU para tablets: limitar pixelRatio e interceptar resize
      if (world?.renderer?.three) {
          enforceSafePixelRatio();
          viewerDiagnostics.registerRenderer(world.renderer);
  
          // Envolver resize de That Open Engine para garantizar que no vuelva a forzar pixelRatio = 2 en cada redibujado
          const originalResize = world.renderer.resize.bind(world.renderer);
          world.renderer.resize = (size?: any) => {
              originalResize(size);
              enforceSafePixelRatio();
          };
  
          const canvas = world.renderer.three.domElement;
          if (canvas) {
              canvas.addEventListener('webglcontextlost', (event: Event) => {
                  event.preventDefault();
                  console.error('[WebGL] Contexto WebGL perdido por límite de GPU/memoria.');
                  appLogger.error('El navegador perdió el contexto WebGL por falta de memoria RAM/GPU.');
                  loadingMessage.value = 'Contexto WebGL perdido';
                  loadingStage.value = 'El dispositivo agotó la memoria gráfica. Cierra otras aplicaciones y pestañas.';
                  alert('El navegador se quedó sin memoria gráfica (WebGL Context Lost). En tablets o dispositivos con memoria limitada, se recomienda cerrar otras pestañas o dividir el modelo.');
              }, false);
          }
      }
  
      world.camera.controls.maxDistance = 10000000;
      world.camera.controls.minDistance = 0.01;
      world.camera.controls.setLookAt(-60, 30, -20, 0, 0, -20);
      world.scene.setup();
  
      const grids = components.get(OBC.Grids);
      grids.create(world);
  
      fragmentManager = components.get(OBC.FragmentsManager);
      fragmentManager.init("/worker.mjs");
  
      // Optimización de culling: limitar consultas masivas a 300ms y alinear modelos del proyecto
      if (fragmentManager.core?.settings) {
          fragmentManager.core.settings.maxUpdateRate = 300;
          fragmentManager.core.settings.autoCoordinate = true;
      }
  
      world.camera.controls.addEventListener("rest", async () => {
          try {
              const models = Array.from(fragmentManager?.list?.values() || []);
              const anyBusy = models.some((m: any) => m.isBusy);
              if (!anyBusy) {
                  await fragmentManager.core.update(false);
              }
          } catch {}
      });
  
      // Al cargar cualquier modelo fragmentado, vincular cámara, clipping y calidad gráfica adaptativa
      fragmentManager.list.onItemSet.add(async ({ value: model }) => {
          try {
              if (world?.camera?.three) {
                  model.useCamera(world.camera.three);
              }
              // Enlace de planos de corte al culling del worker
              model.getClippingPlanesEvent = () => (world?.renderer?.three?.clippingPlanes || []);
  
              // Calidad gráfica adaptativa: 0.75 en tablet para reducir consumo de vértices/LOD, 1.0 en PC
              if (isMobileOrTabletDevice()) {
                  model.graphicsQuality = 0.75;
              }
          } catch {}
          if (model.object && world?.scene?.three && !world.scene.three.children.includes(model.object)) {
              world.scene.three.add(model.object);
          }
          debouncedFitCamera(250);
      });
  
      const [modelsListEl, updateModelsFn] = BUIC.tables.modelsList({
          components,
          metaDataTags: ["schema"],
          actions: { download: isAdmin.value ? true : false },
      });
      updateModelsList = updateModelsFn;
  
      const [spatialTreeEl, updateSpatialFn] = BUIC.tables.spatialTree({
          components,
          models: [],
      });
      updateSpatialTree = updateSpatialFn;
  
      const [propertiesTableEl, updatePropertiesFn] = BUIC.tables.itemsData({
          components,
          modelIdMap: {},
      });
      updatePropertiesTable = updatePropertiesFn;
  
      highlighter = components.get(OBCF.Highlighter);
      highlighter.setup({ world });
  
      highlighter.events.select.onHighlight.add((modelIdMap) => {
          updatePropertiesTable?.({ modelIdMap });
      });
  
      highlighter.events.select.onClear.add(() =>
          updatePropertiesTable?.({ modelIdMap: {} })
      );
  
      propertiesTableEl.preserveStructureOnFilter = true;
      propertiesTableEl.indentationInText = false;
  
      // Panel UI Adaptativo según rol y dispositivo (Admin vs Usuario Normal / Tablet)
      panel = BUI.Component.create(() => {
          const onSearchSpatialTree = (e: Event) => {
              const input = e.target as BUI.TextInput;
              spatialTreeEl.queryString = input.value;
          };
  
          const onTextInput = (e: Event) => {
              const input = e.target as BUI.TextInput;
              propertiesTableEl.queryString = input.value !== "" ? input.value : null;
          };
  
          const onManualGenerateTree = () => {
              if (updateSpatialTree && fragmentManager) {
                  updateSpatialTree({ models: Array.from(fragmentManager.list.values()) });
              }
          };
  
          const isMobile = isMobileOrTabletDevice();
  
          return BUI.html`
              <bim-panel label="${isAdmin.value ? 'IFC / FRAG Engine' : 'Visor BIM'}">
                  ${isAdmin.value ? BUI.html`
                  <bim-panel-section label="Gestión de Archivos">
                      <bim-button label="Cargar Archivo(s) IFC" icon="material-symbols:file-open" @click=${openIfcLoadDialog}></bim-button>
                      <bim-button label="Cargar Archivo(s) .FRAG" icon="mage:box-3d-fill" @click=${openFragDialog}></bim-button>
                      <bim-button label="Convertir IFC a .FRAG" icon="material-symbols:transform" @click=${openIfcConvertDialog}></bim-button>
                      <bim-button label="Guardar .FRAG Actual" icon="flowbite:download-solid" @click=${downloadCurrentFrag}></bim-button>
                      <bim-button label="Enfocar Todo (Zoom Todo)" icon="material-symbols:fit-screen" @click=${() => fitCameraToModels()}></bim-button>
                      <bim-button label="Ver Consola / Logs de Errores" icon="material-symbols:terminal" @click=${openLogModal}></bim-button>
                      ${isMobile ? BUI.html`
                      <div style="padding: 6px 10px; margin: 4px 0; background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 6px; font-size: 11px; color: #93c5fd;">
                          ⚡ <strong>Modo Tablet:</strong> Árbol jerárquico en pausa para proteger memoria.
                      </div>
                      <bim-button label="Cargar Árbol Manualmente" icon="material-symbols:account-tree" @click=${onManualGenerateTree}></bim-button>
                      ` : ''}
                      <bim-text-input @input=${onSearchSpatialTree} placeholder="Buscar en Árbol..." debounce="200"></bim-text-input>
                      ${spatialTreeEl}
                  </bim-panel-section>
                  ` : BUI.html`
                  <bim-panel-section label="Navegación del Modelo">
                      <bim-button label="Enfocar Todo (Zoom Todo)" icon="material-symbols:fit-screen" @click=${() => fitCameraToModels()}></bim-button>
                      ${isMobile ? BUI.html`
                      <div style="padding: 6px 10px; margin: 4px 0; background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 6px; font-size: 11px; color: #93c5fd;">
                          ⚡ <strong>Modo Tablet:</strong> Árbol jerárquico en pausa para proteger memoria.
                      </div>
                      <bim-button label="Cargar Árbol Manualmente" icon="material-symbols:account-tree" @click=${onManualGenerateTree}></bim-button>
                      ` : ''}
                      <bim-text-input @input=${onSearchSpatialTree} placeholder="Buscar en Árbol..." debounce="200"></bim-text-input>
                      ${spatialTreeEl}
                  </bim-panel-section>
                  `}
                  <bim-panel-section icon="mage:box-3d-fill" label="Modelos Cargados">
                      ${modelsListEl}
                  </bim-panel-section>
                  <bim-panel-section label="Propiedades">
                      <bim-text-input @input=${onTextInput} placeholder="Buscar propiedad..." debounce="200"></bim-text-input>
                      ${propertiesTableEl}
                  </bim-panel-section>
              </bim-panel>
          `;
      });
  
      const app = document.getElementById("appGrid") as any;
      app.layouts = {
          main: {
              template: `
              "panel viewport"
              / 23rem 1fr
              `,
              elements: { panel, viewport },
          },
          collapsed: {
              template: `
              "viewport"
              / 1fr
              `,
              elements: { viewport },
          },
      };
  
      app.layout = isPanelCollapsed.value ? "collapsed" : "main";
  
      // Iniciar controladores de navegación por teclado WASD
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('blur', handleWindowBlur);
      startWasdLoop();
  
      // Marcar el visor como completamente listo
      isViewerReady = true;
  
      if (props.initialProject) {
          loadBackendProject(props.initialProject);
      }
  });

  watch(
      () => props.initialProject,
      async (proj) => {
          if (!isViewerReady || !fragmentManager) return;
          if (proj) {
              await loadBackendProject(proj);
          } else {
              await clearScene();
          }
      }
  );

  const togglePanel = () => {
      isPanelCollapsed.value = !isPanelCollapsed.value;
      const app = document.getElementById("appGrid") as any;
      if (app) {
          app.layout = isPanelCollapsed.value ? "collapsed" : "main";
      }
      setTimeout(() => {
          world?.renderer?.resize?.();
          window.dispatchEvent(new Event('resize'));
      }, 60);
  };

  onUnmounted(() => {
      if (currentLoadAbortController) {
          currentLoadAbortController.abort();
          currentLoadAbortController = null;
      }
      if (healthInterval) {
          clearInterval(healthInterval);
          healthInterval = null;
      }
      if (fitCameraDebounceTimer) {
          clearTimeout(fitCameraDebounceTimer);
          fitCameraDebounceTimer = null;
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      if (wasdFrameId !== null) {
          cancelAnimationFrame(wasdFrameId);
      }
      if (components) {
          try {
              components.dispose();
          } catch (e) {
              console.warn('[Viewer] Error al disponer components:', e);
          }
          components = null;
      }
      viewerDiagnostics.dispose();
  });

  const fitCameraToModels = async (targetModel?: any) => {
      if (!world?.camera?.controls) return;
  
      const controls = world.camera.controls;
      controls.maxDistance = 10000000;
      controls.minDistance = 0.01;
  
      try {
          await fragmentManager.core.update(true);
      } catch {}
  
      const combinedBox = new THREE.Box3();
      const models = targetModel ? [targetModel] : Array.from(fragmentManager.list.values());
      if (models.length === 0) return;
  
      for (const m of models as any[]) {
          if (!m?.object) continue;
          m.object.updateMatrixWorld(true);
  
          let box: THREE.Box3 | null = null;
          try {
              if (m.box && !m.box.isEmpty()) {
                  box = m.box;
              }
          } catch {}
  
          if (!box || box.isEmpty()) {
              try {
                  const computed = new THREE.Box3().setFromObject(m.object);
                  if (!computed.isEmpty()) {
                      box = computed;
                  }
              } catch {}
          }
  
          if (!box || box.isEmpty()) {
              try {
                  const boxes = await m.getBoxes();
                  if (boxes && boxes.length > 0) {
                      box = new THREE.Box3();
                      for (const b of boxes) {
                          box.union(b);
                      }
                  }
              } catch {}
          }
  
          if (box && !box.isEmpty()) {
              combinedBox.union(box);
          }
      }
  
      if (combinedBox.isEmpty()) {
          console.warn("[Viewer] No se pudo determinar el bounding box del modelo para encuadrar.");
          return;
      }
  
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      combinedBox.getCenter(center);
      combinedBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
  
      console.log(
          `[Viewer] Bounding Box detectado: centro=(${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)}), dimensiones=(${size.x.toFixed(1)}, ${size.y.toFixed(1)}, ${size.z.toFixed(1)}), maxDim=${maxDim.toFixed(1)}`
      );
  
      modelBounds.value = {
          min: [combinedBox.min.x, combinedBox.min.y, combinedBox.min.z],
          max: [combinedBox.max.x, combinedBox.max.y, combinedBox.max.z],
          center: [center.x, center.y, center.z],
          size: [size.x, size.y, size.z],
      };
      clipOffset.value = center.y;
  
      const farDistance = Math.max(500000, maxDim * 25);
      const nearDistance = Math.max(0.01, Math.min(1, maxDim / 10000));
  
      if (world.camera.threePersp) {
          world.camera.threePersp.far = farDistance;
          world.camera.threePersp.near = nearDistance;
          world.camera.threePersp.updateProjectionMatrix();
      }
      if (world.camera.threeOrtho) {
          world.camera.threeOrtho.far = farDistance;
          world.camera.threeOrtho.near = -farDistance;
          world.camera.threeOrtho.updateProjectionMatrix();
      }
  
      controls.truckSpeed = Math.max(2, maxDim / 100);
  
      try {
          await controls.fitToBox(combinedBox, true, {
              paddingLeft: 0.04,
              paddingRight: 0.04,
              paddingTop: 0.04,
              paddingBottom: 0.04,
          });
      } catch {
          const fitDistance = maxDim * 1.5;
          await controls.setLookAt(
              center.x - fitDistance * 0.7,
              center.y + fitDistance * 0.5,
              center.z - fitDistance * 0.7,
              center.x,
              center.y,
              center.z,
              true
          );
      }
  
      try {
          await fragmentManager.core.update(true);
      } catch {}
  };

  const updateClippingPlane = () => {
      if (!world?.renderer?.three) return;
      const renderer = world.renderer.three as any;
      renderer.localClippingEnabled = true;
  
      if (!isSectionActive.value) {
          renderer.clippingPlanes = [];
          return;
      }
  
      const sign = clipInverted.value ? -1 : 1;
      let normal = new THREE.Vector3(0, -1 * sign, 0);
      if (clipAxis.value === 'x') normal = new THREE.Vector3(-1 * sign, 0, 0);
      if (clipAxis.value === 'z') normal = new THREE.Vector3(0, 0, -1 * sign);
  
      const plane = new THREE.Plane(normal, clipOffset.value * sign);
      renderer.clippingPlanes = [plane];
  };

  const onUpdateClipAxis = (newAxis: 'x' | 'y' | 'z') => {
      clipAxis.value = newAxis;
      const idx = newAxis === 'x' ? 0 : newAxis === 'y' ? 1 : 2;
      clipOffset.value = modelBounds.value.center[idx];
      updateClippingPlane();
  };

  const onUpdateClipOffset = (newOffset: number) => {
      clipOffset.value = newOffset;
      updateClippingPlane();
  };

  const onUpdateClipInverted = (newInverted: boolean) => {
      clipInverted.value = newInverted;
      updateClippingPlane();
  };

  watch(isSectionActive, (active) => {
      if (active) {
          const idx = clipAxis.value === 'x' ? 0 : clipAxis.value === 'y' ? 1 : 2;
          clipOffset.value = modelBounds.value.center[idx];
      }
      updateClippingPlane();
  });

  const setCameraPreset = (preset: 'top' | 'front' | 'side' | 'iso') => {
      if (!world?.camera?.controls) return;
      const controls = world.camera.controls;
      const { center, size } = modelBounds.value;
      const maxDim = Math.max(size[0], size[1], size[2], 30);
      const dist = maxDim * 1.5;
  
      const [cx, cy, cz] = center;
  
      switch (preset) {
          case 'top':
              controls.setLookAt(cx, cy + dist, cz + 0.0001, cx, cy, cz, true);
              break;
          case 'front':
              controls.setLookAt(cx, cy, cz + dist, cx, cy, cz, true);
              break;
          case 'side':
              controls.setLookAt(cx + dist, cy, cz, cx, cy, cz, true);
              break;
          case 'iso':
          default:
              controls.setLookAt(cx + dist * 0.7, cy + dist * 0.6, cz + dist * 0.7, cx, cy, cz, true);
              break;
      }
  };

  const clearScene = async () => {
      // Cancelar cualquier descarga o inyección activa en curso
      if (currentLoadAbortController) {
          currentLoadAbortController.abort();
          currentLoadAbortController = null;
      }
  
      // Incrementar generación para invalidar cargas asíncronas pendientes
      activeLoadGeneration++;
      activeProjectId.value = null;
      activeProjectName.value = '';
  
      // Liberar referencias a buffers crudos en memoria para permitir recolección de basura
      lastFragmentModelFiles = [];
  
      // 1. Limpiar highlighter y selecciones activas (con timeout de seguridad para evitar bloqueos)
      if (highlighter) {
          try {
              const hasSelection = Object.values((highlighter as any).selection || {}).some(
                  (map: any) => map && Object.keys(map).length > 0
              );
              if (hasSelection) {
                  await Promise.race([
                      highlighter.clear(),
                      new Promise((resolve) => setTimeout(resolve, 300)),
                  ]);
              }
          } catch (e) {
              console.warn('Error al limpiar highlighter:', e);
          }
      }
  
      // 2. Limpiar tabla de propiedades del elemento seleccionado
      if (updatePropertiesTable) {
          try {
              updatePropertiesTable({ modelIdMap: {} });
          } catch (e) {
              console.warn('Error al limpiar propertiesTable:', e);
          }
      }
  
      // 3. Limpiar modelos del FragmentManager y de la escena Three.js
      if (fragmentManager) {
          try {
              const models = Array.from(fragmentManager.list.values());
              for (const m of models as any[]) {
                  if (m?.object && world?.scene?.three) {
                      world.scene.three.remove(m.object);
                  }
  
                  if (m?.modelId && typeof fragmentManager.core?.disposeModel === 'function') {
                      try {
                          await Promise.race([
                              fragmentManager.core.disposeModel(m.modelId),
                              new Promise((resolve) => setTimeout(resolve, 500)),
                          ]);
                      } catch (errDispose) {
                          console.warn(`Error al disponer modelo ${m.modelId}:`, errDispose);
                      }
                  } else if (typeof m?.dispose === 'function') {
                      try {
                          await m.dispose();
                      } catch (errDispose) {
                          console.warn(`Error al disponer modelo ${m?.modelId}:`, errDispose);
                      }
                  }
              }
  
              fragmentManager.list.clear();
              if (models.length > 0) {
                  await Promise.race([
                      fragmentManager.core?.update?.(true),
                      new Promise((resolve) => setTimeout(resolve, 500)),
                  ]);
              }
          } catch (e) {
              console.warn('Error al limpiar fragments:', e);
          }
      }
  
      // 4. Actualizar tablas de UI (lista de modelos y árbol espacial)
      if (updateModelsList) {
          try {
              updateModelsList();
          } catch (e) {
              console.warn('Error al actualizar modelsList:', e);
          }
      }
      if (updateSpatialTree) {
          try {
              updateSpatialTree({ models: [] });
          } catch (e) {
              console.warn('Error al actualizar spatialTree:', e);
          }
      }
  
      // 5. Limpiar planos de corte y estado de sección
      if (world?.renderer?.three) {
          world.renderer.three.clippingPlanes = [];
      }
      isSectionActive.value = false;
  
      // 6. Resetear bounds del modelo
      modelBounds.value = {
          min: [-100, -20, -100],
          max: [100, 50, 100],
          center: [0, 15, 0],
          size: [200, 70, 200],
      };
  };

  const clearSceneForFileLoad = async () => {
      const projectId = activeProjectId.value;
      const projectName = activeProjectName.value;
      await clearScene();
      activeProjectId.value = projectId;
      activeProjectName.value = projectName;
  };

  const loadCachedModel = async (id: string) => {
      const userId = currentUser.value?.id;
      if (!userId) {
          alert('Inicia sesiÃ³n para acceder a la cachÃ© BIM de tu cuenta.');
          return;
      }
      const cached = await getProjectFragments(userId, id);
      if (!cached || !cached.parts.length) {
          alert('No se encontraron fragmentos en la caché local.');
          return;
      }
  
      await clearScene();
      if (currentLoadAbortController) {
          currentLoadAbortController.abort();
          currentLoadAbortController = null;
      }
      currentLoadAbortController = new AbortController();
      const signal = currentLoadAbortController.signal;
  
      const currentGen = ++activeLoadGeneration;
      activeProjectId.value = id;
  
      isLoading.value = true;
      loadingProgress.value = 15;
      loadingFileName.value = cached.name;
      const totalBytes = cached.parts.reduce((a, b) => a + (b ? b.byteLength : 0), 0);
      loadingFileSize.value = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB (Caché Local)`;
      loadingMessage.value = 'Cargando desde Caché Local IndexedDB...';
      loadingSubtitle.value = 'Carga instantánea sin consumo de red';
      loadingStage.value = 'Inyectando fragmentos en Three.js...';
  
      viewerDiagnostics.markLoadStart(cached.parts.length, totalBytes);
      try {
          for (let i = 0; i < cached.parts.length; i++) {
              if (currentGen !== activeLoadGeneration || signal.aborted) return;
              const buf = cached.parts[i];
              if (!buf) continue;
              let bytes: Uint8Array | null = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
              const partName = (cached.partNames && cached.partNames[i]) || `${cached.name || id}_part_${i + 1}`;
              const cleanModelId = partName.replace(/\.frag$/i, '');
              let loadedModel: any = null;
              try {
                  loadedModel = await fragmentManager.core.load(bytes as any, { modelId: cleanModelId, raw: false });
              } catch (errNormal) {
                  console.warn(`[FRAG-CACHE] Carga raw=false falló (${errNormal}), reintentando raw=true para ${cleanModelId}`);
                  try {
                      loadedModel = await fragmentManager.core.load(bytes as any, { modelId: cleanModelId, raw: true });
                  } catch (errRaw) {
                      console.error(`[FRAG-CACHE] Fallo al cargar parte "${cleanModelId}":`, errRaw);
                  }
              }
  
              // Liberar referencia al buffer de este fragmento para permitir al GC reclamar RAM
              cached.parts[i] = null as any;
              bytes = null;
  
              if (loadedModel && currentGen === activeLoadGeneration && !signal.aborted) {
                  const modelKey = cleanModelId;
                  if (!fragmentManager.list.has(modelKey)) {
                      fragmentManager.list.set(modelKey, loadedModel);
                  }
                  if (world?.camera?.three) {
                      try { loadedModel.useCamera(world.camera.three); } catch {}
                  }
                  if (loadedModel.object && world?.scene?.three && !world.scene.three.children.includes(loadedModel.object)) {
                      world.scene.three.add(loadedModel.object);
                  }
              }
              loadingProgress.value = Math.round(((i + 1) / cached.parts.length) * 90);
          }
  
          if (currentGen !== activeLoadGeneration || signal.aborted) return;
  
          try {
              await fragmentManager.core.update(true);
          } catch {}
  
          if (updateModelsList) {
              updateModelsList();
          }
          refreshSpatialTreeSafely(Array.from(fragmentManager.list.values()));
  
          loadingProgress.value = 100;
          loadingStage.value = 'Encuadrando vista de cámara...';
          enforceSafePixelRatio();
          nextTick(() => {
              world?.renderer?.resize?.();
              enforceSafePixelRatio();
              window.dispatchEvent(new Event('resize'));
          });
          setTimeout(async () => {
              if (currentGen === activeLoadGeneration && !signal.aborted) {
                  world?.renderer?.resize?.();
                  enforceSafePixelRatio();
                  await fitCameraToModels();
              }
          }, 150);
      } catch (err: any) {
          if (currentGen === activeLoadGeneration && !signal.aborted) {
              console.error('Error cargando desde caché:', err);
              alert(`Error al cargar modelo desde caché: ${err.message}`);
          }
      } finally {
          if (currentGen === activeLoadGeneration) {
              isLoading.value = false;
          }
          viewerDiagnostics.markLoadEnd();
      }
  };

  const loadBackendProject = async (proj: BackendProject) => {
      if (!proj || !proj.id) return;
  
      // Si ya estamos exactamente en este proyecto y ya tiene todos sus fragmentos cargados
      if (activeProjectId.value === proj.id) {
          let allPartsAlreadyLoaded = Boolean(proj.parts && proj.parts.length > 0);
          if (allPartsAlreadyLoaded && proj.parts) {
              for (const part of proj.parts) {
                  const cleanPartId = part.replace(/\.frag$/i, '');
                  if (!fragmentManager || !fragmentManager.list.has(cleanPartId)) {
                      allPartsAlreadyLoaded = false;
                      break;
                  }
              }
          }
  
          if (allPartsAlreadyLoaded) {
              appLogger.info(`El proyecto "${proj.name || proj.fileName}" ya se encuentra activo en la escena.`);
              setTimeout(async () => {
                  await fitCameraToModels();
              }, 100);
              return;
          }
      }
  
      // Limpiar modelos del proyecto anterior antes de cargar el nuevo para garantizar aislamiento estricto
      await clearScene();
  
      // Iniciar nuevo AbortController para esta sesión de carga
      if (currentLoadAbortController) {
          currentLoadAbortController.abort();
          currentLoadAbortController = null;
      }
      currentLoadAbortController = new AbortController();
      const signal = currentLoadAbortController.signal;
  
      // Establecer nueva generación y registrar projectId activo
      const currentGen = ++activeLoadGeneration;
      activeProjectId.value = proj.id;
      activeProjectName.value = proj.name || proj.fileName || '';
  
      if (!proj.parts || proj.parts.length === 0) {
          appLogger.warn(`El proyecto "${proj.name || proj.fileName}" no contiene modelos FRAG listos.`);
          return;
      }
  
      isLoading.value = true;
      isBackendProcessing.value = true;
      loadingFileName.value = proj.name || proj.fileName;
      loadingFileSize.value = `${proj.totalPartsSizeMB || '0'} MB`;
      loadingMessage.value = 'Carga progresiva de fragmentos...';
      loadingSubtitle.value = `Procesando ${proj.parts.length} partes secuencialmente`;
      loadingProgress.value = 10;
      loadingStage.value = 'Conectando con el backend...';
  
      let injectedCount = 0;
      let failedCount = 0;
  
      const totalEstimatedBytes = (Number(proj.totalPartsSizeMB) || 0) * 1024 * 1024;
      viewerDiagnostics.markLoadStart(proj.parts.length, totalEstimatedBytes);
      try {
          // Carga progresiva real: descarga fragmento i -> inyecta en GPU -> libera buffer -> descarga fragmento i+1
          // Evita por completo acumular todos los ArrayBuffers en memoria RAM simultáneamente.
          await downloadBackendFragmentsProgressive(
              proj.id,
              proj.parts,
              async (buffer: ArrayBuffer, index: number, total: number, partName: string) => {
                  if (currentGen !== activeLoadGeneration || signal.aborted) return;
  
                  loadingStage.value = `Inyectando en GPU: ${partName} (${index + 1}/${total})...`;
                  const cleanModelId = partName.replace(/\.frag$/i, '');
  
                  if (fragmentManager && fragmentManager.list.has(cleanModelId)) {
                      return;
                  }
  
                  let bytes: Uint8Array | null = new Uint8Array(buffer);
                  let loadedModel: any = null;
                  try {
                      loadedModel = await fragmentManager.core.load(bytes as any, { modelId: cleanModelId, raw: false });
                  } catch (errNormal) {
                      console.warn(`[FRAG] Carga raw=false falló (${errNormal}), reintentando raw=true para ${cleanModelId}`);
                      try {
                          loadedModel = await fragmentManager.core.load(bytes as any, { modelId: cleanModelId, raw: true });
                      } catch (errRaw) {
                          failedCount++;
                          console.error(`[FRAG] Fallo al cargar fragmento "${cleanModelId}":`, errRaw);
                          appLogger.warn(`Fragmento ${partName} no pudo ser cargado: ${errRaw instanceof Error ? errRaw.message : String(errRaw)}`);
                      }
                  }
  
                  // Liberar referencia binaria inmediatamente para recuperación de RAM
                  bytes = null;
  
                  if (loadedModel && currentGen === activeLoadGeneration && !signal.aborted) {
                      const modelKey = cleanModelId;
                      if (!fragmentManager.list.has(modelKey)) {
                          fragmentManager.list.set(modelKey, loadedModel);
                      }
                      if (world?.camera?.three) {
                          try { loadedModel.useCamera(world.camera.three); } catch {}
                      }
                      if (loadedModel.object && world?.scene?.three && !world.scene.three.children.includes(loadedModel.object)) {
                          world.scene.three.add(loadedModel.object);
                      }
                      injectedCount++;
                      console.log(`[FRAG] Modelo ${cleanModelId} inyectado en escena 3D (${index + 1}/${total})`);
                  }
  
                  if (currentGen === activeLoadGeneration && !signal.aborted) {
                      loadingProgress.value = Math.min(92, Math.round(((index + 1) / total) * 90));
                      loadingStage.value = `Fragmento ${index + 1} de ${total} cargado`;
                  }
              },
              {
                  signal,
                  onProgress: (loaded, total, stage) => {
                      if (currentGen === activeLoadGeneration && !signal.aborted) {
                          loadingStage.value = stage;
                          loadingProgress.value = Math.max(10, Math.round((loaded / total) * 85));
                      }
                  }
              }
          );
  
          // Verificar si la generación cambió o se canceló durante el proceso progresivo
          if (currentGen !== activeLoadGeneration || signal.aborted) {
              appLogger.info('Carga cancelada: el proyecto activo cambió o fue interrumpido.');
              return;
          }
  
          try {
              await fragmentManager.core.update(true);
          } catch {}
  
          // Actualizar listas y árboles en la interfaz de forma segura para tablets
          if (updateModelsList) {
              updateModelsList();
          }
          refreshSpatialTreeSafely(Array.from(fragmentManager.list.values()));
  
          loadingProgress.value = 100;
          loadingStage.value = 'Encuadrando vista de cámara...';
  
          enforceSafePixelRatio();
  
          nextTick(() => {
              world?.renderer?.resize?.();
              enforceSafePixelRatio();
              window.dispatchEvent(new Event('resize'));
          });
  
          setTimeout(async () => {
              if (currentGen === activeLoadGeneration && !signal.aborted) {
                  world?.renderer?.resize?.();
                  enforceSafePixelRatio();
                  await fitCameraToModels();
              }
          }, 150);
  
          const summaryMsg = failedCount > 0
              ? `Proyecto cargado con advertencias: ${injectedCount}/${proj.parts.length} fragmentos (${failedCount} fallaron).`
              : `Proyecto cargado exitosamente: ${proj.name || proj.fileName} (${injectedCount} fragmentos).`;
          appLogger.info(summaryMsg);
      } catch (err: any) {
          if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
              console.log('[Viewer] Carga de proyecto cancelada por el usuario o cambio de proyecto.');
              return;
          }
          if (currentGen === activeLoadGeneration) {
              console.error('Error cargando proyecto del backend:', err);
              alert(`Error al descargar proyecto: ${err.message}`);
          }
      } finally {
          if (currentGen === activeLoadGeneration) {
              isLoading.value = false;
              isBackendProcessing.value = false;
          }
          viewerDiagnostics.markLoadEnd(failedCount === 0);
      }
  };

  const loadBackendModel = async (model: BackendModelItem) => {
      const cleanModelId = model.name.replace(/\.frag$/i, '');
  
      await clearScene();
      if (currentLoadAbortController) {
          currentLoadAbortController.abort();
          currentLoadAbortController = null;
      }
      currentLoadAbortController = new AbortController();
      const signal = currentLoadAbortController.signal;
  
      const currentGen = ++activeLoadGeneration;
      activeProjectId.value = model.projectId || model.id;
      activeProjectName.value = model.projectName || model.name || '';
  
      isLoading.value = true;
      isBackendProcessing.value = true;
      loadingFileName.value = model.name;
      loadingFileSize.value = model.sizeFormatted;
      loadingMessage.value = 'Descargando modelo persistente de almacenamiento local...';
      loadingSubtitle.value = `Proyecto: ${model.projectName || 'Catálogo local'}`;
      loadingProgress.value = 20;
      loadingStage.value = 'Conectando con el almacenamiento local...';
  
      viewerDiagnostics.markLoadStart(1, model.sizeBytes || 0);
      try {
          let buffer: ArrayBuffer | null = await downloadModelFragment(model.id, signal);
          if (currentGen !== activeLoadGeneration || signal.aborted) return;
  
          loadingProgress.value = 75;
          loadingStage.value = 'Inyectando fragmento en GPU y escena 3D...';
  
          let bytes: Uint8Array | null = new Uint8Array(buffer);
          let loadedModel: any = null;
          try {
              loadedModel = await fragmentManager.core.load(bytes as any, { modelId: cleanModelId, raw: false });
          } catch {
              loadedModel = await fragmentManager.core.load(bytes as any, { modelId: cleanModelId, raw: true });
          }
  
          // Liberar referencias al buffer de descarga inmediatamente
          buffer = null;
          bytes = null;
  
          if (loadedModel && currentGen === activeLoadGeneration && !signal.aborted) {
              const modelKey = cleanModelId || loadedModel.modelId || loadedModel.id;
              if (!fragmentManager.list.has(modelKey)) {
                  fragmentManager.list.set(modelKey, loadedModel);
              }
              if (world?.camera?.three) {
                  try { loadedModel.useCamera(world.camera.three); } catch {}
              }
              if (loadedModel.object && world?.scene?.three && !world.scene.three.children.includes(loadedModel.object)) {
                  world.scene.three.add(loadedModel.object);
              }
          }
  
          if (currentGen !== activeLoadGeneration || signal.aborted) return;
  
          if (updateModelsList) {
              updateModelsList();
          }
          refreshSpatialTreeSafely(Array.from(fragmentManager.list.values()));
  
          loadingProgress.value = 100;
          loadingStage.value = 'Encuadrando vista de cámara...';
          enforceSafePixelRatio();
          setTimeout(async () => {
              if (currentGen === activeLoadGeneration && !signal.aborted) {
                  world?.renderer?.resize?.();
                  enforceSafePixelRatio();
                  await fitCameraToModels();
              }
          }, 150);
          appLogger.info(`Modelo persistente cargado con éxito: ${model.name}`);
      } catch (err: any) {
          if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
              return;
          }
          if (currentGen === activeLoadGeneration) {
              console.error('Error cargando modelo del backend:', err);
              alert(`Error al descargar o inyectar modelo: ${err.message}`);
          }
      } finally {
          if (currentGen === activeLoadGeneration) {
              isLoading.value = false;
              isBackendProcessing.value = false;
          }
          viewerDiagnostics.markLoadEnd();
      }
  };

  const openIfcLoadDialog = () => {
      if (!currentUser.value) {
          isLoginModalOpen.value = true;
          alert('Debe iniciar sesión para cargar o convertir archivos IFC.');
          return;
      }
      if (!isAdmin.value) {
          alert('Acceso restringido: Solo los administradores pueden cargar archivos IFC al catálogo.');
          return;
      }
      ifcLoadInput.value?.click();
  };

  const openIfcConvertDialog = () => {
      if (!currentUser.value) {
          isLoginModalOpen.value = true;
          alert('Debe iniciar sesión para cargar o convertir archivos IFC.');
          return;
      }
      if (!isAdmin.value) {
          alert('Acceso restringido: Solo los administradores pueden convertir archivos IFC.');
          return;
      }
      ifcConvertInput.value?.click();
  };

  const openIfcDialog = openIfcLoadDialog;

  const openFragDialog = () => fragInput.value?.click();

  const onLoginSuccess = () => {
      appLogger.info(`Sesión iniciada correctamente: ${currentUser.value?.email}`);
  };

  const handleLogout = async () => {
      await logout();
      appLogger.info('Sesión cerrada.');
  };

  const handleMixedFilesSelected = async (files: File[]) => {
      const fragFiles = files.filter((f) => f.name.toLowerCase().endsWith('.frag'));
      const ifcFiles = files.filter((f) => f.name.toLowerCase().endsWith('.ifc'));
  
      if (fragFiles.length === 0 && ifcFiles.length === 0) {
          alert('Por favor selecciona uno o varios archivos válidos (.ifc o .frag).');
          return;
      }
  
      if (fragFiles.length > 0) {
          await loadMultipleFragFiles(fragFiles);
      }
  
      if (ifcFiles.length > 0) {
          if (!currentUser.value) {
              isLoginModalOpen.value = true;
              alert('Debe iniciar sesión para procesar archivos IFC.');
              return;
          }
          await processMultipleIfcFiles(ifcFiles, false, fragFiles.length === 0);
      }
  };

  const onIfcLoadSelected = async (e: Event) => {
      if (!isAdmin.value) {
          alert('Acceso restringido: Solo los administradores pueden cargar o procesar archivos de modelos.');
          return;
      }
      const input = e.target as HTMLInputElement;
      const files = input.files ? Array.from(input.files) : [];
      if (files.length === 0) return;
      await handleMixedFilesSelected(files);
      input.value = '';
  };

  const onIfcConvertSelected = async (e: Event) => {
      if (!isAdmin.value) {
          alert('Acceso restringido: Solo los administradores pueden convertir archivos IFC.');
          return;
      }
      const input = e.target as HTMLInputElement;
      const files = input.files ? Array.from(input.files) : [];
      if (files.length === 0) return;
      await processMultipleIfcFiles(files, true);
      input.value = '';
  };

  const onIfcFileSelected = onIfcLoadSelected;

  const onFragFileSelected = async (e: Event) => {
      if (!isAdmin.value) {
          alert('Acceso restringido: Solo los administradores pueden cargar archivos de modelos.');
          return;
      }
      const input = e.target as HTMLInputElement;
      const files = input.files ? Array.from(input.files) : [];
      if (files.length === 0) return;
      await handleMixedFilesSelected(files);
      input.value = '';
  };

  const handleDrop = async (e: DragEvent) => {
      if (!isAdmin.value) {
          alert('Acceso restringido: Como usuario normal solo puedes visualizar los modelos asignados a tus proyectos.');
          return;
      }
      const fileList = e.dataTransfer?.files;
      if (!fileList || fileList.length === 0) return;
  
      const files = Array.from(fileList);
      const fragFiles = files.filter((f) => f.name.toLowerCase().endsWith('.frag'));
      const ifcFiles = files.filter((f) => f.name.toLowerCase().endsWith('.ifc'));
  
      if (fragFiles.length === 0 && ifcFiles.length === 0) {
          alert('Por favor arrastra uno o varios archivos .ifc o .frag válidos.');
          return;
      }
  
      if (fragFiles.length > 0) {
          await loadMultipleFragFiles(fragFiles);
      }
  
      if (ifcFiles.length > 0) {
          if (!currentUser.value) {
              isLoginModalOpen.value = true;
              alert('Debe iniciar sesión para procesar archivos IFC.');
              return;
          }
          await processMultipleIfcFiles(ifcFiles, false, fragFiles.length === 0);
      }
  };

  const loadMultipleFragFiles = async (files: File[], clearExistingScene: boolean = true) => {
      if (clearExistingScene) {
          await clearSceneForFileLoad();
      }
      isLoading.value = true;
      loadingProgress.value = 0;
      lastFragmentModelFiles = [];
  
      const isMobile = isMobileOrTabletDevice();
      const totalSizeMB = files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024);
  
      try {
          const cachedBuffers: ArrayBuffer[] = [];
          for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const prefix = files.length > 1 ? `[${i + 1}/${files.length}] ` : '';
              loadingMessage.value = `${prefix}Cargando .FRAG`;
              loadingFileName.value = file.name;
              loadingFileSize.value = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
              loadingStage.value = 'Leyendo buffer de archivo .frag...';
              loadingProgress.value = Math.round((i / files.length) * 100);
  
              const buffer = await file.arrayBuffer();
              if (!isMobile && totalSizeMB < 60) {
                  cachedBuffers.push(buffer);
              }
              const bytes = new Uint8Array(buffer);
  
              loadingStage.value = 'Inicializando geometría en GPU...';
              const cleanModelId = file.name.replace(/\.frag$/i, '');
              let loadedModel: any = null;
              try {
                  // Probar primero carga con descompresión estándar
                  loadedModel = await fragmentManager.core.load(bytes as any, { modelId: cleanModelId, raw: false });
              } catch {
                  // Si el archivo fue guardado sin compresión (raw flatbuffer), cargar con raw=true
                  loadedModel = await fragmentManager.core.load(bytes as any, { modelId: cleanModelId, raw: true });
              }
  
              if (loadedModel) {
                  let modelKey = cleanModelId || loadedModel.modelId || loadedModel.id;
                  if (fragmentManager.list.has(modelKey)) {
                      modelKey = `${modelKey}_${Date.now()}_${i}`;
                  }
                  fragmentManager.list.set(modelKey, loadedModel);
                  lastFragmentModelFiles.push({ id: modelKey, fileName: file.name });
                  if (world?.camera?.three) {
                      try { loadedModel.useCamera(world.camera.three); } catch {}
                  }
                  if (loadedModel.object && world?.scene?.three && !world.scene.three.children.includes(loadedModel.object)) {
                      world.scene.three.add(loadedModel.object);
                  }
              }
              console.log(`[FRAG] Modelo cargado (${i + 1}/${files.length}): ${file.name}`);
          }
  
          // Auto-guardar en IndexedDB local solo si es Desktop y tamaño menor a 60MB (evita clonaciones pesadas en tablets)
          if (cachedBuffers.length > 0 && !isMobile && totalSizeMB < 60) {
              const userId = currentUser.value?.id;
              if (userId && activeProjectId.value) {
                  await appendProjectFragments(userId, activeProjectId.value, loadingFileName.value || 'Proyecto', cachedBuffers);
              } else if (userId) {
                  const cacheKey = files.map((f) => f.name).join('_');
                  await saveProjectFragments(userId, cacheKey, files[0].name, cachedBuffers);
              }
          }
          cachedBuffers.length = 0;
  
          // Si hay un proyecto activo en el backend, persistir automáticamente en SQLite y almacenamiento
          if (activeProjectId.value) {
              for (const file of files) {
                  try {
                      await uploadDirectFrag(activeProjectId.value, file);
                      console.log(`[FRAG] Archivo ${file.name} guardado y persistido para proyecto ${activeProjectId.value}`);
                      appLogger.info(`Modelo ${file.name} guardado en el proyecto.`);
                  } catch (persistErr) {
                      console.warn(`[FRAG] No se pudo persistir automáticamente en backend:`, persistErr);
                  }
              }
          }
  
          if (updateModelsList) {
              updateModelsList();
          }
          refreshSpatialTreeSafely(Array.from(fragmentManager.list.values()));
  
          loadingProgress.value = 100;
          loadingStage.value = 'Encuadrando vista de cámara...';
          setTimeout(async () => {
              await fitCameraToModels();
          }, 150);
      } catch (err) {
          console.error("[FRAG] Error al cargar:", err);
          alert(`Error al cargar el archivo .frag: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
          isLoading.value = false;
      }
  };

  const loadFragFile = async (file: File) => {
      await loadMultipleFragFiles([file]);
  };

  const processMultipleIfcFiles = async (
      files: File[],
      autoDownloadFrag: boolean = false,
      clearExistingScene: boolean = true,
  ) => {
      if (clearExistingScene) {
          await clearSceneForFileLoad();
      }
      isLoading.value = true;
      loadingProgress.value = 0;
  
      try {
          for (let i = 0; i < files.length; i++) {
              const file = files[i];
  
              // Detección proactiva de modelos masivos que exceden el límite de WebAssembly en el navegador
              if (file.size > MAX_SAFE_BROWSER_IFC_SIZE) {
                  // Verificar si el microservicio de 64 bits está en línea
                  const health = await checkBackendHealth();
                  backendStatus.value = health;
  
                  if (health.online) {
                      isBackendProcessing.value = true;
                      loadingFileName.value = file.name;
                      loadingFileSize.value = `${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
                      loadingMessage.value = 'IFC conversion on server';
                      loadingSubtitle.value = 'The FRAG stays on the server and is not loaded into the viewer.';
                      loadingProgress.value = 0;
                      loadingStage.value = 'Iniciando subida en streaming al microservicio local...';
  
                      try {
                          await convertIfcViaBackend(file, (progress) => {
                              loadingProgress.value = progress.percent;
                              loadingStage.value = progress.stage;
                              if (progress.elapsed) {
                                  loadingMessage.value = `Server conversion (${progress.elapsed})`;
                              }
                          }, undefined, undefined, { downloadResult: false });

                          if (updateModelsList) {
                              updateModelsList();
                          }
                          loadingProgress.value = 100;
                          loadingStage.value = 'Conversion completed; FRAG saved without loading into the viewer.';
                      } catch (backendErr: any) {
                          console.error("Error en microservicio backend:", backendErr);
                          alert(`Error en conversión vía microservicio local: ${backendErr.message}`);
                      } finally {
                          isBackendProcessing.value = false;
                          loadingSubtitle.value = 'Procesamiento Zero-Copy vía Web Worker';
                      }
                  } else {
                      isLoading.value = false;
                      massiveModelInfo.value = {
                          name: file.name,
                          sizeGB: (file.size / (1024 * 1024 * 1024)).toFixed(2),
                          command: `npm run convert -- "${file.name}"`,
                      };
                      massiveModalVisible.value = true;
                      return;
                  }
              }
  
              const prefix = files.length > 1 ? `[${i + 1}/${files.length}] ` : '';
              loadingMessage.value = `${prefix}Procesando IFC`;
              loadingFileName.value = file.name;
              loadingFileSize.value = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
              loadingStage.value = 'Iniciando Web Worker streaming (FileReaderSync Zero-Copy)...';
              loadingProgress.value = 0;
  
              let generated: Uint8Array | Uint8Array[] = await processIfcFile(file, {
                  wasmPath: "/",
                  raw: true,
                  onProgress: (progress: number, detail?: any) => {
                      loadingProgress.value = progress;
                      if (detail?.stage) {
                          loadingMessage.value = `[Fase ${detail.stage}/${detail.totalStages || 2}] Procesando IFC`;
                      }
                      if (detail?.process === 'geometries') {
                          loadingStage.value = detail.class
                              ? `Geometría: ${detail.class} (${detail.entitiesProcessed || 0} elem.)`
                              : 'Extrayendo mallas y geometrías 3D...';
                      } else if (detail?.process === 'attributes') {
                          loadingStage.value = detail.class
                              ? `Propiedades BIM: ${detail.class}`
                              : 'Indexando propiedades y tipos...';
                      } else if (detail?.process === 'relations') {
                          loadingStage.value = 'Mapeando relaciones espaciales...';
                      } else if (progress >= 90) {
                          loadingStage.value = 'Construyendo buffer FlatBuffer optimizado...';
                      }
                  },
              });
  
              const fragmentArray = Array.isArray(generated) ? generated : [generated];
              // The model can recreate its FRAG buffer on demand. Avoid keeping
              // every generated fragment buffer alive while it is rendered.
              lastFragmentModelFiles = [];
  
              for (let partIdx = 0; partIdx < fragmentArray.length; partIdx++) {
                  const fragmentBytes = fragmentArray[partIdx];
                  const partSuffix = fragmentArray.length > 1 ? `_part${partIdx + 1}` : '';
                  const fragFileName = file.name.replace(/\.ifc$/i, '') + partSuffix + '.frag';
  
                  // Si autoDownloadFrag es true, descargar automáticamente el archivo .frag
                  if (autoDownloadFrag) {
                      downloadFragmentFile(fragmentBytes, fragFileName);
                      console.log(`[IFC] Archivo .frag descargado automáticamente: ${fragFileName}`);
                  }
  
                  // Carga directa en el visor para visualización inmediata en 3D (Zero-Copy)
                  const partLabel = fragmentArray.length > 1 ? ` (${partIdx + 1}/${fragmentArray.length})` : '';
                  loadingStage.value = `Cargando Fragments en GPU${partLabel}...`;
                  const cleanModelId = fragFileName.replace(/\.frag$/i, '');
                  let loadedModel: any = null;
                  try {
                      loadedModel = await fragmentManager.core.load(fragmentBytes, { modelId: cleanModelId, raw: true });
                  } catch {
                      loadedModel = await fragmentManager.core.load(fragmentBytes, { modelId: cleanModelId, raw: false });
                  }
  
                  if (loadedModel) {
                      let modelKey = cleanModelId || loadedModel.modelId || loadedModel.id;
                      if (fragmentManager.list.has(modelKey)) {
                          modelKey = `${modelKey}_${Date.now()}_${partIdx}`;
                      }
                      fragmentManager.list.set(modelKey, loadedModel);
                      lastFragmentModelFiles.push({ id: modelKey, fileName: fragFileName });
                      if (world?.camera?.three) {
                          try { loadedModel.useCamera(world.camera.three); } catch {}
                      }
                      if (loadedModel.object && world?.scene?.three && !world.scene.three.children.includes(loadedModel.object)) {
                          world.scene.three.add(loadedModel.object);
                      }
                  }
                  console.log(`[IFC] Modelo renderizado en escena: ${fragFileName}`);
              }
              // Release converted byte arrays as soon as their models are in the scene.
              fragmentArray.fill(new Uint8Array(0));
              generated = new Uint8Array(0);
          }
  
          if (updateModelsList) {
              updateModelsList();
          }
          refreshSpatialTreeSafely(Array.from(fragmentManager.list.values()));
  
          loadingProgress.value = 100;
          loadingStage.value = 'Encuadrando vista de cámara...';
          setTimeout(async () => {
              await fitCameraToModels();
          }, 200);
      } catch (err) {
          console.error("IFC conversion failed:", err);
          if (err instanceof MassiveIfcFileError || (err instanceof Error && err.name === 'MassiveIfcFileError')) {
              massiveModelInfo.value = {
                  name: (err as any).fileName || loadingFileName.value || 'Modelo IFC',
                  sizeGB: (err as any).fileSizeGB || loadingFileSize.value || '',
                  command: `npm run convert -- "${(err as any).fileName || loadingFileName.value || 'modelo.ifc'}"`,
              };
              massiveModalVisible.value = true;
          } else {
              alert(`Fallo en el procesamiento del IFC: ${err instanceof Error ? err.message : String(err)}`);
          }
      } finally {
          isLoading.value = false;
      }
  };

  const processAndConvertIfc = async (file: File) => {
      await processMultipleIfcFiles([file], true);
  };

  const downloadCurrentFrag = async () => {
      if (lastFragmentModelFiles.length > 0) {
          for (const { id, fileName } of lastFragmentModelFiles) {
              const model = fragmentManager.list.get(id);
              if (!model || typeof model.getBuffer !== 'function') continue;

              try {
                  const buffer = await model.getBuffer(false);
                  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
                  downloadFragmentFile(bytes, fileName);
              } catch (e) {
                  console.error(`Error al exportar el fragmento ${fileName}:`, e);
              }
          }
          return;
      }

      // Si hay algún modelo actualmente cargado en el administrador
      for (const [id, model] of fragmentManager.list) {
          try {
              const buffer = await model.getBuffer(false);
              const cleanId = id.replace(/\.ifc$/i, '').replace(/\.frag$/i, '');
              downloadFragmentFile(new Uint8Array(buffer), `${cleanId}.frag`);
              return;
          } catch (e) {
              console.error("Error al exportar buffer del modelo:", e);
          }
      }
  
      alert("No hay ningún modelo fragment cargado actualmente para guardar.");
  };

  return {
    onMounted,
    onUnmounted,
    ref,
    computed,
    watch,
    nextTick,
    THREE,
    OBC,
    BUI,
    BUIC,
    OBCF,
    downloadFragmentFile,
    processIfcFile,
    MassiveIfcFileError,
    MAX_SAFE_BROWSER_IFC_SIZE,
    checkBackendHealth,
    convertIfcViaBackend,
    downloadBackendFragments,
    downloadBackendFragmentsProgressive,
    downloadBackendFragmentPart,
    downloadModelFragment,
    uploadDirectFrag,
    saveProjectFragments,
    getProjectFragments,
    appendProjectFragments,
    deleteCachedProject,
    ErrorLogModal,
    SectionPlaneBar,
    ViewerToolbar,
    ProjectsModal,
    LoginModal,
    AdminPanelModal,
    currentUser,
    isAdmin,
    logout,
    appLogger,
    viewerDiagnostics,
    isSectionActive,
    isProjectsModalOpen,
    isLoginModalOpen,
    isAdminModalOpen,
    isPanelCollapsed,
    clipAxis,
    clipOffset,
    clipInverted,
    modelBounds,
    clipBounds,
    activeKeys,
    wasdFrameId,
    lastWasdTime,
    isWasdActive,
    handleKeyDown,
    handleKeyUp,
    handleWindowBlur,
    startWasdLoop,
    containerRef,
    ifcLoadInput,
    ifcConvertInput,
    ifcInput,
    fragInput,
    isLogModalOpen,
    errorLogCount,
    openLogModal,
    updateErrorCount,
    isLoading,
    loadingProgress,
    loadingFileName,
    loadingFileSize,
    loadingStage,
    loadingMessage,
    loadingSubtitle,
    panelVisible,
    backendStatus,
    isBackendProcessing,
    massiveModalVisible,
    massiveModelInfo,
    copiedCommand,
    copiedDevAll,
    copyCommand,
    copyDevAllCommand,
    checkBackendAndRetry,
    components,
    panel,
    world,
    fragmentManager,
    highlighter,
    updatePropertiesTable,
    updateSpatialTree,
    updateModelsList,
    activeProjectId,
    activeProjectName,
    activeLoadGeneration,
    currentLoadAbortController,
    isViewerReady,
    healthInterval,
    isMobileOrTabletDevice,
    enforceSafePixelRatio,
    fitCameraDebounceTimer,
    debouncedFitCamera,
    refreshSpatialTreeSafely,
    togglePanel,
    fitCameraToModels,
    updateClippingPlane,
    onUpdateClipAxis,
    onUpdateClipOffset,
    onUpdateClipInverted,
    setCameraPreset,
    clearScene,
    loadCachedModel,
    loadBackendProject,
    loadBackendModel,
    openIfcLoadDialog,
    openIfcConvertDialog,
    openIfcDialog,
    openFragDialog,
    onLoginSuccess,
    handleLogout,
    handleMixedFilesSelected,
    onIfcLoadSelected,
    onIfcConvertSelected,
    onIfcFileSelected,
    onFragFileSelected,
    handleDrop,
    loadMultipleFragFiles,
    loadFragFile,
    processMultipleIfcFiles,
    processAndConvertIfc,
    downloadCurrentFrag,
  };
}
