export interface BackendHealth {
  online: boolean;
  version?: string;
  port?: number;
  freeMemoryGB?: number;
  totalMemoryGB?: number;
  activeJobs?: number;
}

export type IfcProgressPhase = 'uploading' | 'uploaded' | 'processing' | 'completed';

export interface BackendConversionProgress {
  percent: number;
  stage: string;
  elapsed?: string;
  phase?: IfcProgressPhase;
  loadedBytes?: number;
  totalBytes?: number;
  speedBytesPerSec?: number;
  remainingSec?: number;
}

export interface BackendConversionResult {
  parts: string[];
  fragmentBuffers: Uint8Array[];
  jobId: string;
  durationSec: string;
  totalSizeMB: string;
}

/**
 * Checks if local 64-bit microservice backend is active and available
 */
export async function checkBackendHealth(): Promise<BackendHealth> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      return { online: false };
    }
    const data = await res.json();
    return {
      online: true,
      version: data.version,
      port: data.port,
      freeMemoryGB: data.freeMemoryGB,
      totalMemoryGB: data.totalMemoryGB,
      activeJobs: data.activeJobs,
    };
  } catch {
    clearTimeout(timeoutId);
    return { online: false };
  }
}

/**
 * Formats byte size into human readable string: bytes, KB, MB, GB, TB.
 * Matches standard format (e.g. 3580000000 bytes -> 3.58 GB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) return '0 bytes';
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  const k = 1000;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  if (i === 0) return `${bytes} bytes`;
  const val = (bytes / Math.pow(k, i)).toFixed(2);
  return `${parseFloat(val)} ${units[i]}`;
}

/**
 * Formats transfer speed into string (e.g. 18.4 MB/s, 540 KB/s).
 */
export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0 || isNaN(bytesPerSec)) return '';
  if (bytesPerSec < 1000) return `${Math.round(bytesPerSec)} B/s`;
  if (bytesPerSec < 1000 * 1000) return `${(bytesPerSec / 1000).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1000 * 1000)).toFixed(1)} MB/s`;
}

/**
 * Formats estimated remaining seconds into string (e.g. "Tiempo restante aprox.: 1 min 24 s").
 */
export function formatRemainingTime(seconds: number): string {
  if (seconds === undefined || seconds === null || seconds <= 0 || !isFinite(seconds)) return '';
  if (seconds < 60) return `Tiempo restante aprox.: ${Math.round(seconds)} s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `Tiempo restante aprox.: ${mins} min ${secs} s`;
}

/**
 * Uploads massive IFC file to backend via XMLHttpRequest tracking REAL upload progress,
 * and then subscribes to Server-Sent Events (SSE) for server-side IFC -> FRAG processing.
 */
export async function convertIfcViaBackend(
  file: File,
  onProgress: (progress: BackendConversionProgress) => void,
  projectId?: string,
  signal?: AbortSignal
): Promise<BackendConversionResult> {
  if (signal?.aborted) {
    throw new DOMException('Carga cancelada por el usuario', 'AbortError');
  }

  onProgress({
    percent: 0,
    stage: 'Iniciando subida...',
    phase: 'uploading',
    loadedBytes: 0,
    totalBytes: file.size,
  });

  const formData = new FormData();
  formData.append('file', file, file.name);
  if (projectId) {
    formData.append('projectId', projectId);
  }

  const url = projectId ? `/api/convert?projectId=${encodeURIComponent(projectId)}` : '/api/convert';

  // 1. Upload stream to backend using XMLHttpRequest with real upload progress
  let activeXhr: XMLHttpRequest | null = null;
  let activeEventSource: EventSource | null = null;
  let jobIdCreated: string | null = null;
  let isAborted = false;

  const onAbort = () => {
    isAborted = true;
    if (activeXhr) {
      try { activeXhr.abort(); } catch {}
    }
    if (activeEventSource) {
      try { activeEventSource.close(); } catch {}
    }
    if (jobIdCreated) {
      fetch(`/api/jobs/${jobIdCreated}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
    }
  };

  if (signal) {
    signal.addEventListener('abort', onAbort, { once: true });
  }

  let uploadResponseData: { jobId: string; progressUrl: string };

  try {
    uploadResponseData = await new Promise<{ jobId: string; progressUrl: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      activeXhr = xhr;
      xhr.open('POST', url, true);
      xhr.withCredentials = true;

      let lastTime = performance.now();
      let lastLoaded = 0;
      let smoothedSpeed = 0;

      if (xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (isAborted) return;
          if (e.lengthComputable) {
            const now = performance.now();
            const timeDiffSec = (now - lastTime) / 1000;

            if (timeDiffSec >= 0.25 || e.loaded === e.total) {
              const bytesDiff = e.loaded - lastLoaded;
              const currentSpeed = timeDiffSec > 0 ? bytesDiff / timeDiffSec : 0;
              smoothedSpeed = smoothedSpeed === 0 ? currentSpeed : smoothedSpeed * 0.7 + currentSpeed * 0.3;
              lastTime = now;
              lastLoaded = e.loaded;
            }

            const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
            const remainingBytes = Math.max(0, e.total - e.loaded);
            const remainingSec = smoothedSpeed > 0 ? Math.round(remainingBytes / smoothedSpeed) : undefined;

            onProgress({
              percent,
              stage: 'Subiendo IFC...',
              phase: 'uploading',
              loadedBytes: e.loaded,
              totalBytes: e.total,
              speedBytesPerSec: smoothedSpeed,
              remainingSec,
            });
          }
        };
      }

      xhr.onload = () => {
        if (isAborted) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            onProgress({
              percent: 100,
              stage: 'IFC cargado en el servidor.',
              phase: 'uploaded',
              loadedBytes: file.size,
              totalBytes: file.size,
            });
            resolve(data);
          } catch {
            reject(new Error('No se pudo procesar la respuesta del servidor.'));
          }
        } else {
          let errorMsg = 'No se pudo cargar el archivo.';
          try {
            const errJson = JSON.parse(xhr.responseText);
            if (errJson.error) errorMsg = errJson.error;
            else if (errJson.message) errorMsg = errJson.message;
          } catch {}
          reject(new Error(errorMsg));
        }
      };

      xhr.onerror = () => {
        if (isAborted) return;
        reject(new Error('No se pudo cargar el archivo. Comprueba la conexión.'));
      };

      xhr.onabort = () => {
        reject(new DOMException('Carga cancelada por el usuario', 'AbortError'));
      };

      xhr.send(formData);
    });
  } finally {
    activeXhr = null;
  }

  if (isAborted || signal?.aborted) {
    throw new DOMException('Carga cancelada por el usuario', 'AbortError');
  }

  const { jobId, progressUrl } = uploadResponseData;
  jobIdCreated = jobId;

  // 2. Connect to Server-Sent Events (SSE) for server-side processing
  return new Promise<BackendConversionResult>((resolve, reject) => {
    if (isAborted || signal?.aborted) {
      onAbort();
      return reject(new DOMException('Carga cancelada por el usuario', 'AbortError'));
    }

    const eventSource = new EventSource(progressUrl);
    activeEventSource = eventSource;

    onProgress({
      percent: 0,
      stage: 'Procesando IFC...',
      phase: 'processing',
    });

    eventSource.addEventListener('progress', (e: MessageEvent) => {
      if (isAborted) return;
      try {
        const data = JSON.parse(e.data);
        onProgress({
          percent: typeof data.percent === 'number' ? data.percent : 0,
          stage: data.stage || 'Convirtiendo IFC → FRAG...',
          elapsed: data.elapsed,
          phase: 'processing',
        });
      } catch (err) {
        console.error('Error parseando evento SSE de progreso:', err);
      }
    });

    eventSource.addEventListener('complete', async (e: MessageEvent) => {
      if (isAborted) return;
      eventSource.close();
      activeEventSource = null;

      try {
        const data = JSON.parse(e.data);
        const { parts, downloadUrls, totalSizeMB, durationSec } = data;

        onProgress({
          percent: 98,
          stage: 'Sincronizando fragmentos optimizados...',
          phase: 'processing',
        });

        const fragmentBuffers: Uint8Array[] = [];
        for (let i = 0; i < downloadUrls.length; i++) {
          if (isAborted) break;
          const downloadUrl = downloadUrls[i];
          const partName = parts[i] || `Parte ${i + 1}`;
          onProgress({
            percent: 98,
            stage: `Transfiriendo ${partName} (${i + 1}/${downloadUrls.length})...`,
            phase: 'processing',
          });

          const resp = await fetch(downloadUrl, { credentials: 'include', signal });
          if (!resp.ok) {
            let detail = `HTTP ${resp.status}`;
            try {
              const errJson = await resp.json();
              if (errJson.error) detail += `: ${errJson.error}`;
            } catch {
              const errText = await resp.text().catch(() => '');
              if (errText) detail += `: ${errText}`;
            }
            throw new Error(`Fallo al descargar fragmento desde ${downloadUrl} (${detail})`);
          }
          const buf = await resp.arrayBuffer();
          fragmentBuffers.push(new Uint8Array(buf));
        }

        // Cleanup temporary files on backend
        try {
          await fetch(`/api/jobs/${jobId}`, { method: 'DELETE', credentials: 'include' });
        } catch {}

        onProgress({
          percent: 100,
          stage: 'Proyecto listo.',
          phase: 'completed',
        });

        resolve({
          parts,
          fragmentBuffers,
          jobId,
          durationSec,
          totalSizeMB,
        });
      } catch (err) {
        reject(err);
      } finally {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      }
    });

    eventSource.addEventListener('error', (e: any) => {
      if (isAborted) return;
      eventSource.close();
      activeEventSource = null;
      let errorMsg = 'No se pudo completar el procesamiento del modelo IFC.';
      if (e?.data) {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.error) errorMsg = parsed.error;
        } catch {}
      }
      reject(new Error(errorMsg));
    });

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        // Closed normally or aborted
      }
    };
  });
}

export interface BackendModelItem {
  id: string;
  projectId: string;
  projectName?: string;
  name: string;
  storagePath: string;
  sizeBytes: number;
  status: 'ready' | 'processing' | 'failed' | 'missing_file';
  fileExists: boolean;
  sizeFormatted: string;
  createdAt: number;
  updatedAt: number;
}

export interface BackendProject {
  id: string;
  name: string;
  fileName: string;
  description: string | null;
  imageUrl?: string | null;
  createdAt: number;
  modelsCount: number;
  models: BackendModelItem[];
  parts: string[];
  fileSize: number;
  totalPartsSizeMB: string;
}

export async function fetchBackendProjects(query?: string): Promise<BackendProject[]> {
  try {
    const url = query ? `/api/projects?q=${encodeURIComponent(query)}` : '/api/projects';
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.projects || [];
  } catch (err) {
    console.warn('Error fetching backend projects:', err);
    return [];
  }
}

export async function fetchBackendProject(id: string): Promise<BackendProject> {
  const res = await fetch(`/api/projects/${id}`, { credentials: 'include' });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error obteniendo proyecto (${res.status})`);
  }
  const data = await res.json();
  return data.project;
}

export async function createBackendProject(
  name: string,
  description?: string,
  coverFile?: File | null
): Promise<BackendProject> {
  let res: Response;
  if (coverFile) {
    const formData = new FormData();
    formData.append('name', name);
    if (description) formData.append('description', description);
    formData.append('cover', coverFile);
    res = await fetch('/api/projects', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
  } else {
    res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, description }),
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error creando proyecto (${res.status})`);
  }
  const data = await res.json();
  return data.project;
}

export async function uploadProjectCover(projectId: string, file: File): Promise<BackendProject> {
  const formData = new FormData();
  formData.append('cover', file);
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/cover`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error subiendo imagen de portada (${res.status})`);
  }
  const data = await res.json();
  return data.project;
}

export async function deleteProjectCover(projectId: string): Promise<BackendProject> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/cover`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error eliminando imagen de portada (${res.status})`);
  }
  const data = await res.json();
  return data.project;
}

export async function updateBackendProject(
  id: string,
  updates: { name?: string; description?: string }
): Promise<BackendProject> {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error actualizando proyecto (${res.status})`);
  }
  const data = await res.json();
  return data.project;
}

export async function deleteBackendProject(id: string): Promise<{ success: boolean; deletedModelsCount: number }> {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error eliminando proyecto (${res.status})`);
  }
  return res.json();
}

export async function fetchBackendModels(params?: {
  query?: string;
  projectId?: string;
  status?: string;
}): Promise<BackendModelItem[]> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.query) searchParams.set('q', params.query);
    if (params?.projectId) searchParams.set('projectId', params.projectId);
    if (params?.status) searchParams.set('status', params.status);

    const qs = searchParams.toString();
    const url = qs ? `/api/models?${qs}` : '/api/models';
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.models || [];
  } catch (err) {
    console.warn('Error fetching backend models:', err);
    return [];
  }
}

export async function fetchBackendModelDetail(id: string): Promise<BackendModelItem> {
  const res = await fetch(`/api/models/${id}`, { credentials: 'include' });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error obteniendo detalles del modelo (${res.status})`);
  }
  const data = await res.json();
  return data.model;
}

export async function deleteBackendModel(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/models/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error eliminando modelo (${res.status})`);
  }
  return res.json();
}

export async function downloadModelFragment(modelId: string): Promise<ArrayBuffer> {
  const res = await fetch(`/api/models/${modelId}/download`, { credentials: 'include' });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error descargando archivo FRAG (${res.status})`);
  }
  return res.arrayBuffer();
}

export async function downloadBackendFragments(
  jobId: string,
  parts: string[],
  onProgress?: (loaded: number, total: number) => void
): Promise<ArrayBuffer[]> {
  const buffers: ArrayBuffer[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // 1. Try project-scoped download (/api/projects/{projectId}/models/{modelIdOrName}/download)
    let res = await fetch(
      `/api/projects/${encodeURIComponent(jobId)}/models/${encodeURIComponent(part)}/download`,
      { credentials: 'include' }
    );
    if (!res.ok) {
      // 2. Try direct conversion job part download
      res = await fetch(
        `/api/jobs/${encodeURIComponent(jobId)}/download/${encodeURIComponent(part)}`,
        { credentials: 'include' }
      );
    }
    if (!res.ok) {
      // 3. Try conversion job 1-based index download
      res = await fetch(
        `/api/jobs/${encodeURIComponent(jobId)}/download/${i + 1}`,
        { credentials: 'include' }
      );
    }
    if (!res.ok) {
      // 4. Try global model download (/api/models/{id}/download)
      res = await fetch(
        `/api/models/${encodeURIComponent(part)}/download`,
        { credentials: 'include' }
      );
    }
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson.error) detail += `: ${errJson.error}`;
      } catch {
        const errText = await res.text().catch(() => '');
        if (errText) detail += `: ${errText}`;
      }
      throw new Error(`Error descargando fragmento "${part}" del proyecto "${jobId}" (${detail})`);
    }
    const buf = await res.arrayBuffer();
    buffers.push(buf);
    onProgress?.(i + 1, parts.length);
  }
  return buffers;
}

/**
 * Directly uploads a pre-converted .frag file to a project without running conversion.
 * Tracks real-time upload progress with bytes, speed (MB/s), ETA, and supports AbortSignal.
 * Validates, persists to storage/models/<projectId>/<modelId>/, and registers in SQLite.
 */
export async function uploadDirectFrag(
  projectId: string,
  file: File,
  onProgress?: ((progress: BackendConversionProgress) => void) | ((percent: number) => void),
  signal?: AbortSignal
): Promise<BackendModelItem> {
  if (!file.name.toLowerCase().endsWith('.frag')) {
    throw new Error('Solo se admiten archivos con extensión .frag.');
  }

  if (signal?.aborted) {
    throw new DOMException('Carga cancelada por el usuario', 'AbortError');
  }

  const notifyProgress = (prog: BackendConversionProgress) => {
    if (!onProgress) return;
    if (typeof onProgress === 'function') {
      try {
        (onProgress as any)(prog);
      } catch {
        (onProgress as any)(prog.percent);
      }
    }
  };

  notifyProgress({
    percent: 0,
    stage: 'Subiendo FRAG...',
    phase: 'uploading',
    loadedBytes: 0,
    totalBytes: file.size,
  });

  return new Promise<BackendModelItem>((resolve, reject) => {
    let activeXhr: XMLHttpRequest | null = null;
    let isAborted = false;

    const onAbort = () => {
      isAborted = true;
      if (activeXhr) {
        try { activeXhr.abort(); } catch {}
      }
      reject(new DOMException('Carga cancelada por el usuario', 'AbortError'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const xhr = new XMLHttpRequest();
    activeXhr = xhr;
    xhr.open('POST', `/api/projects/${encodeURIComponent(projectId)}/models/upload-frag`, true);
    xhr.withCredentials = true;

    let lastTime = performance.now();
    let lastLoaded = 0;
    let smoothedSpeed = 0;

    if (xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (isAborted) return;
        if (e.lengthComputable) {
          const now = performance.now();
          const timeDiffSec = (now - lastTime) / 1000;

          if (timeDiffSec >= 0.25 || e.loaded === e.total) {
            const bytesDiff = e.loaded - lastLoaded;
            const currentSpeed = timeDiffSec > 0 ? bytesDiff / timeDiffSec : 0;
            smoothedSpeed = smoothedSpeed === 0 ? currentSpeed : smoothedSpeed * 0.7 + currentSpeed * 0.3;
            lastTime = now;
            lastLoaded = e.loaded;
          }

          if (e.loaded >= e.total) {
            notifyProgress({
              percent: 100,
              stage: 'Archivo recibido. Guardando y registrando modelo...',
              phase: 'uploaded',
              loadedBytes: e.total,
              totalBytes: e.total,
              speedBytesPerSec: smoothedSpeed,
              remainingSec: 0,
            });
            return;
          }

          const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
          const remainingBytes = Math.max(0, e.total - e.loaded);
          const remainingSec = smoothedSpeed > 0 ? Math.round(remainingBytes / smoothedSpeed) : undefined;

          notifyProgress({
            percent,
            stage: 'Subiendo FRAG...',
            phase: 'uploading',
            loadedBytes: e.loaded,
            totalBytes: e.total,
            speedBytesPerSec: smoothedSpeed,
            remainingSec,
          });
        }
      };
    }

    xhr.onload = () => {
      if (isAborted) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.model) {
            notifyProgress({
              percent: 100,
              stage: '✓ Modelo registrado correctamente.',
              phase: 'completed',
              loadedBytes: file.size,
              totalBytes: file.size,
            });
            resolve(response.model);
          } else {
            reject(new Error(response.error || `Error del servidor (${xhr.status})`));
          }
        } catch (err: any) {
          reject(new Error(`Respuesta no válida del servidor (${xhr.status}): ${xhr.responseText || err.message}`));
        }
      } else {
        let errorMsg = `Error del servidor (${xhr.status})`;
        try {
          const errJson = JSON.parse(xhr.responseText);
          if (errJson.error) errorMsg = errJson.error;
          else if (errJson.message) errorMsg = errJson.message;
        } catch {
          if (xhr.responseText && xhr.responseText.length < 200) {
            errorMsg = xhr.responseText;
          }
        }
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      if (isAborted) return;
      reject(new Error('Error de conexión de red durante la subida del archivo .frag.'));
    };

    xhr.onabort = () => {
      reject(new DOMException('Carga cancelada por el usuario', 'AbortError'));
    };

    const formData = new FormData();
    formData.append('file', file, file.name);
    xhr.send(formData);
  });
}

export interface DashboardStats {
  activeProjects: number;
  bimModels: number;
  users: number;
  storageBytes: number;
  storageFormatted: string;
  recentProjects: BackendProject[];
  recentActivity: ActivityLogItem[];
}

export interface ActivityLogItem {
  id: string;
  date: string;
  user: string;
  action: string;
  resource: string;
  projectName?: string;
  result: string;
  statusClass: 'ok' | 'warn' | 'err';
  timestamp: number;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch('/api/dashboard/stats', { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Error obteniendo estadísticas (${res.status})`);
  }
  const data = await res.json();
  return data.stats;
}

export async function fetchActivityLogs(): Promise<ActivityLogItem[]> {
  const res = await fetch('/api/activity', { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Error obteniendo logs de actividad (${res.status})`);
  }
  const data = await res.json();
  return data.logs || [];
}



