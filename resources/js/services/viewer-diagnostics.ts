/**
 * IXRlab_IFC - Viewer Diagnostics & Telemetry Service
 * Tracks memory, GPU allocations, WebGL context, frame timings, and load performance.
 * Distinguishes JS Heap, GPU VRAM, and Process/System memory safely without assuming universal APIs.
 */

export interface ViewerDiagnosticsSnapshot {
  timestamp: number;
  webglStatus: 'active' | 'lost' | 'unsupported';
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometriesCount: number;
  texturesCount: number;
  devicePixelRatio: number;
  canvasResolution: string;

  // Memory breakdown
  memoryApiSupported: boolean;
  jsHeapUsedMB: number | null;
  jsHeapTotalMB: number | null;
  jsHeapLimitMB: number | null;
  gpuMemoryEstimatedMB: number;
  backendFreeMemoryGB: number | null;

  // Load session tracking
  concurrentLoads: number;
  lastLoadDurationMs: number | null;
  lastLoadBytes: number | null;
  lastLoadPartsCount: number | null;
  lastLoadSpeedMBs: number | null;
}

class ViewerDiagnosticsService {
  private activeConcurrentLoads = 0;
  private lastSessionStart = 0;
  private lastSessionDurationMs: number | null = null;
  private lastSessionBytes: number | null = null;
  private lastSessionParts: number | null = null;

  private webglStatus: 'active' | 'lost' | 'unsupported' = 'active';
  private frameCount = 0;
  private lastFpsTime = performance.now();
  private currentFps = 60;
  private currentFrameTimeMs = 16.6;

  private activeRenderer: any = null;
  private backendFreeMemoryGB: number | null = null;

  private listeners: Array<(snapshot: ViewerDiagnosticsSnapshot) => void> = [];
  private tickerInterval: any = null;

  constructor() {
    this.startTicker();
  }

  public registerRenderer(renderer: any) {
    this.activeRenderer = renderer;
    if (renderer?.three?.domElement) {
      const canvas = renderer.three.domElement;
      canvas.addEventListener('webglcontextlost', () => {
        this.webglStatus = 'lost';
        this.notify();
      });
      canvas.addEventListener('webglcontextrestored', () => {
        this.webglStatus = 'active';
        this.notify();
      });
    }
  }

  public setBackendFreeMemory(freeGB: number) {
    this.backendFreeMemoryGB = freeGB;
  }

  public markLoadStart(partsCount: number, totalBytes?: number) {
    this.activeConcurrentLoads++;
    this.lastSessionStart = performance.now();
    this.lastSessionParts = partsCount;
    this.lastSessionBytes = totalBytes || null;
    this.notify();
  }

  public markLoadEnd(success = true) {
    this.activeConcurrentLoads = Math.max(0, this.activeConcurrentLoads - 1);
    if (this.lastSessionStart > 0) {
      this.lastSessionDurationMs = Math.round(performance.now() - this.lastSessionStart);
      this.lastSessionStart = 0;
    }
    this.notify();
  }

  public onRenderFrame(frameDeltaMs: number) {
    this.frameCount++;
    this.currentFrameTimeMs = Math.round(frameDeltaMs * 10) / 10;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
      this.notify();
    }
  }

  public getSnapshot(): ViewerDiagnosticsSnapshot {
    const memoryApiSupported = typeof window !== 'undefined' && 'memory' in performance;
    let jsHeapUsedMB: number | null = null;
    let jsHeapTotalMB: number | null = null;
    let jsHeapLimitMB: number | null = null;

    if (memoryApiSupported) {
      const perfMemory = (performance as any).memory;
      if (perfMemory) {
        jsHeapUsedMB = Math.round((perfMemory.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
        jsHeapTotalMB = Math.round((perfMemory.totalJSHeapSize / (1024 * 1024)) * 10) / 10;
        jsHeapLimitMB = Math.round((perfMemory.jsHeapSizeLimit / (1024 * 1024)) * 10) / 10;
      }
    }

    let drawCalls = 0;
    let triangles = 0;
    let geometriesCount = 0;
    let texturesCount = 0;
    let canvasResolution = '0x0';
    let devicePixelRatio = 1;
    let gpuMemoryEstimatedMB = 0;

    if (this.activeRenderer?.three) {
      const threeRenderer = this.activeRenderer.three;
      const info = threeRenderer.info;
      if (info) {
        drawCalls = info.render?.calls || 0;
        triangles = info.render?.triangles || 0;
        geometriesCount = info.memory?.geometries || 0;
        texturesCount = info.memory?.textures || 0;
      }

      const canvas = threeRenderer.domElement;
      if (canvas) {
        canvasResolution = `${canvas.width}x${canvas.height}`;
        devicePixelRatio = threeRenderer.getPixelRatio ? threeRenderer.getPixelRatio() : window.devicePixelRatio || 1;
        // Framebuffer calculation: width * height * 4 (RGBA) * 4 (MSAA default) + depth/stencil (4 bytes)
        const frameBufferBytes = canvas.width * canvas.height * 20;
        // Geometry estimate: avg 32 bytes per triangle vertex attribute
        const geometryBytes = triangles * 32 * 3;
        gpuMemoryEstimatedMB = Math.round(((frameBufferBytes + geometryBytes) / (1024 * 1024)) * 10) / 10;
      }
    }

    let lastLoadSpeedMBs: number | null = null;
    if (this.lastSessionBytes && this.lastSessionDurationMs && this.lastSessionDurationMs > 0) {
      const mb = this.lastSessionBytes / (1024 * 1024);
      const sec = this.lastSessionDurationMs / 1000;
      lastLoadSpeedMBs = Math.round((mb / sec) * 10) / 10;
    }

    return {
      timestamp: Date.now(),
      webglStatus: this.webglStatus,
      fps: this.currentFps,
      frameTimeMs: this.currentFrameTimeMs,
      drawCalls,
      triangles,
      geometriesCount,
      texturesCount,
      devicePixelRatio,
      canvasResolution,
      memoryApiSupported,
      jsHeapUsedMB,
      jsHeapTotalMB,
      jsHeapLimitMB,
      gpuMemoryEstimatedMB,
      backendFreeMemoryGB: this.backendFreeMemoryGB,
      concurrentLoads: this.activeConcurrentLoads,
      lastLoadDurationMs: this.lastSessionDurationMs,
      lastLoadBytes: this.lastSessionBytes,
      lastLoadPartsCount: this.lastSessionParts,
      lastLoadSpeedMBs,
    };
  }

  public subscribe(fn: (snapshot: ViewerDiagnosticsSnapshot) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((l) => {
      try { l(snapshot); } catch {}
    });
  }

  private startTicker() {
    if (this.tickerInterval) clearInterval(this.tickerInterval);
    this.tickerInterval = setInterval(() => {
      this.notify();
    }, 1500);
  }

  public dispose() {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }
    this.listeners = [];
  }
}

export const viewerDiagnostics = new ViewerDiagnosticsService();
