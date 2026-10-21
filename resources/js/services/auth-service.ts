import { ref, computed } from 'vue';
import { clearAllCachedProjects } from './frag-cache';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  isActive: boolean;
  assignedProjectIds: string[];
  createdAt: number;
}

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  isActive: boolean;
  assignedProjectIds: string[];
  assignedProjectsCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface AdminUsersPagination {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface AdminUsersPage {
  users: AdminUserItem[];
  pagination: AdminUsersPagination;
}

export const currentUser = ref<UserSession | null>(null);
export const isAuthLoading = ref<boolean>(true);
export const authError = ref<string | null>(null);

export const isAuthenticated = computed(() => currentUser.value !== null);
export const isAdmin = computed(() => currentUser.value?.role === 'admin');

function getCsrfToken(): string | null {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : null;
}

function getDefaultHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  const token = getCsrfToken();
  if (token) {
    headers['X-CSRF-TOKEN'] = token;
  }
  return headers;
}

let checkSessionPromise: Promise<UserSession | null> | null = null;
let isInitialCheckDone = false;

/**
 * Checks current session with the Laravel backend (/api/auth/me).
 */
export async function checkSession(force = false): Promise<UserSession | null> {
  if (checkSessionPromise && !force) {
    return checkSessionPromise;
  }

  // Only show the blocking/initial auth loading screen during initial bootstrap
  if (!isInitialCheckDone) {
    isAuthLoading.value = true;
  }
  authError.value = null;

  checkSessionPromise = (async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: getDefaultHeaders(),
        credentials: 'include',
      });
      if (!res.ok) {
        currentUser.value = null;
        if (res.status === 401 || res.status === 403) {
          await clearAllCachedProjects();
        }
        return null;
      }
      const data = await res.json();
      if (data.authenticated && data.user) {
        currentUser.value = data.user;
        return data.user;
      } else {
        currentUser.value = null;
        await clearAllCachedProjects();
        return null;
      }
    } catch (err) {
      console.warn('[Auth] Error consultando estado de sesión:', err);
      currentUser.value = null;
      return null;
    } finally {
      isInitialCheckDone = true;
      isAuthLoading.value = false;
      checkSessionPromise = null;
    }
  })();

  return checkSessionPromise;
}

/**
 * Performs secure login and establishes session with Laravel backend.
 */
export async function login(email: string, password: string, remember = false): Promise<UserSession> {
  isAuthLoading.value = true;
  authError.value = null;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        ...getDefaultHeaders(),
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password, remember }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      const msg = data.error || 'Fallo de autenticación.';
      authError.value = msg;
      throw new Error(msg);
    }

    await clearAllCachedProjects();
    currentUser.value = data.user;
    return data.user;
  } catch (err: any) {
    authError.value = err.message || 'Error de conexión durante el inicio de sesión.';
    throw err;
  } finally {
    isAuthLoading.value = false;
  }
}

export async function requestPasswordReset(email: string): Promise<string> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: {
      ...getDefaultHeaders(),
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'No se pudo procesar la solicitud. Intenta nuevamente.');
  }
  return data.message || 'Si el correo corresponde a una cuenta, recibirÃ¡ instrucciones para continuar.';
}

export async function submitPasswordReset(payload: {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}): Promise<string> {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: {
      ...getDefaultHeaders(),
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'El enlace no es vÃ¡lido o expirÃ³. Solicita uno nuevo.');
  }
  return data.message || 'La contraseÃ±a se restableciÃ³. Ya puedes iniciar sesiÃ³n.';
}

/**
 * Closes the active session.
 */
export async function logout(): Promise<void> {
  isAuthLoading.value = true;
  await clearAllCachedProjects();
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getDefaultHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      const meta = document.querySelector('meta[name="csrf-token"]');
      if (data.csrfToken && meta) {
        meta.setAttribute('content', data.csrfToken);
      }
    }
  } catch (err) {
    console.warn('[Auth] Error en cierre de sesión:', err);
  } finally {
    currentUser.value = null;
    isAuthLoading.value = false;
  }
}

/* ===================================================================
 * ADMIN USER MANAGEMENT APIS
 * =================================================================== */

export async function adminFetchUsersPage(options: {
  query?: string;
  role?: 'all' | 'admin' | 'user';
  status?: 'all' | 'active' | 'inactive';
  page?: number;
  perPage?: number;
} = {}): Promise<AdminUsersPage> {
  const params = new URLSearchParams({
    page: String(options.page ?? 1),
    per_page: String(options.perPage ?? 25),
    role: options.role ?? 'all',
    status: options.status ?? 'all',
  });
  if (options.query?.trim()) params.set('q', options.query.trim());

  const res = await fetch(`/api/users?${params.toString()}`, {
    headers: getDefaultHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error obteniendo usuarios (${res.status})`);
  }

  const data = await res.json();
  return {
    users: data.users || [],
    pagination: data.pagination,
  };
}

export async function adminCreateUser(payload: {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  isActive: boolean;
  assignedProjectIds?: string[];
}): Promise<AdminUserItem> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: {
      ...getDefaultHeaders(),
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error creando usuario (${res.status})`);
  }
  const data = await res.json();
  return data.user;
}

export async function adminUpdateUser(
  id: string,
  payload: {
    name?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'user';
    isActive?: boolean;
    assignedProjectIds?: string[];
  }
): Promise<AdminUserItem> {
  const res = await fetch(`/api/users/${id}`, {
    method: 'PATCH',
    headers: {
      ...getDefaultHeaders(),
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error actualizando usuario (${res.status})`);
  }
  const data = await res.json();
  return data.user;
}

export async function adminDeleteUser(id: string): Promise<void> {
  const res = await fetch(`/api/users/${id}`, {
    method: 'DELETE',
    headers: getDefaultHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error eliminando usuario (${res.status})`);
  }
}

export async function adminUpdateUserProjects(userId: string, projectIds: string[]): Promise<string[]> {
  const res = await fetch(`/api/users/${userId}/projects`, {
    method: 'PUT',
    headers: {
      ...getDefaultHeaders(),
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ projectIds }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error asignando proyectos (${res.status})`);
  }
  const data = await res.json();
  return data.assignedProjectIds;
}
