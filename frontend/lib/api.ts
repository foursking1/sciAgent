/**
 * API client for SciAgent backend
 *
 * Priority for API URL:
 * 1. NEXT_PUBLIC_API_URL environment variable (for production deployment)
 * 2. Current page origin with port 8000 (for same-origin deployment)
 * 3. localhost:8000 (fallback for development)
 */
function getApiBaseUrl(): string {
  // 1. Check environment variable (set in production)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // 2. In browser, use current hostname with port 8000
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol; // http: or https:
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:8000`;
  }

  // 3. Server-side fallback (SSR)
  return 'http://localhost:8000';
}

const API_BASE_URL = getApiBaseUrl();

// Custom error class for API errors that includes HTTP status code
export class APIError extends Error {
  public readonly statusCode: number;
  public readonly detail: string;

  constructor(statusCode: number, detail: string) {
    super(`HTTP ${statusCode}: ${detail}`);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.detail = detail;
  }

  // Check if this error is a specific HTTP status code
  isStatus(code: number): boolean {
    return this.statusCode === code;
  }
}

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
}

export interface Session {
  id: string;
  user_id: number;
  working_dir: string;
  title: string | null;
  agent_type: string | null;
  current_mode: string;
  is_public: boolean;
  created_at: string;
  updated_at: string | null;
  preview?: string;
}

export interface PublicSession {
  id: string;
  title: string | null;
  current_mode: string;
  created_at: string;
  preview_image: string | null;
  pdf_path: string | null;
}

export interface PublicSessionDetail {
  id: string;
  title: string | null;
  current_mode: string;
  created_at: string;
  messages: Message[];
  is_owner: boolean;
}

export interface Message {
  id: number;
  session_id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  is_stopped?: boolean;
  created_at: string;
}

export interface FileRecord {
  id: number;
  session_id: string;
  filename: string;
  file_path: string;
  file_size: number;
  content_type: string | null;
  created_at: string;
  item_count?: number;  // Number of items in a directory
}

export interface FilePreview {
  type: 'text' | 'image' | 'binary';
  filename: string;
  extension: string;
  size: number;
  content?: string;
  url?: string;
  message?: string;
}

// DataSource types
export interface DataSource {
  id: number;
  user_id: number;
  name: string;
  type: 'database' | 'vector_store' | 'skill';
  config: Record<string, unknown>;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface DataSourceCreate {
  name: string;
  type: 'database' | 'vector_store' | 'skill';
  config: Record<string, unknown>;
  description?: string;
}

export interface DataSourceUpdate {
  name?: string;
  config?: Record<string, unknown>;
  description?: string;
  is_active?: boolean;
}

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {};

  // Copy existing headers if any
  if (options.headers) {
    const existingHeaders = options.headers as Record<string, string>;
    Object.keys(existingHeaders).forEach((key) => {
      headers[key] = existingHeaders[key];
    });
  }

  // Don't set Content-Type for FormData (let browser set it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
    // Prevent caching to ensure we always get fresh data
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    const errorMessage = error.detail || 'Request failed';
    throw new APIError(response.status, errorMessage);
  }

  // Handle no-content responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Authentication API
export const authApi = {
  /**
   * Register a new user
   * Returns the created user (no token - need to login separately)
   */
  async register(email: string, password: string, full_name?: string): Promise<User> {
    return apiCall<User>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name }),
    });
  },

  /**
   * Login with email and password
   * Returns access token and user info
   */
  async login(email: string, password: string) {
    const data = await apiCall<{ access_token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Fetch user info with the token
    const user = await this.getMe(data.access_token);

    return { access_token: data.access_token, user };
  },

  /**
   * Get current user info
   */
  async getMe(token: string): Promise<User> {
    return apiCall<User>('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },
};

// Sessions API
export const sessionsApi = {
  async list(token: string): Promise<Session[]> {
    // Add cache-busting timestamp
    const timestamp = Date.now();
    const data = await apiCall<{ sessions: Session[]; total: number }>(`/api/sessions?_t=${timestamp}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return data.sessions;
  },

  async get(token: string, sessionId: string): Promise<Session> {
    // Add cache-busting timestamp to ensure we always get fresh data
    const timestamp = Date.now();
    return apiCall<Session>(`/api/sessions/${sessionId}?_t=${timestamp}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  async create(token: string, agent_type?: string, mode?: string): Promise<Session> {
    return apiCall<Session>('/api/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ agent_type, mode }),
    });
  },

  async delete(token: string, sessionId: string): Promise<void> {
    await apiCall<void>(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  async switchMode(token: string, sessionId: string, mode: string): Promise<Session> {
    return apiCall<Session>(`/api/sessions/${sessionId}/mode`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mode }),
    });
  },

  async getMessages(token: string, sessionId: string): Promise<Message[]> {
    return apiCall<Message[]>(`/api/sessions/${sessionId}/messages`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  /**
   * Get all events for a session (including function_call, function_response, etc.)
   * This is used for page refresh recovery to reconstruct full session history.
   */
  async getEvents(token: string, sessionId: string): Promise<{ events: unknown[]; total: number }> {
    return apiCall<{ events: unknown[]; total: number }>(`/api/sessions/${sessionId}/history`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  async sendMessage(token: string, sessionId: string, content: string): Promise<Message> {
    return apiCall<Message>(`/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });
  },

  /**
   * Get SSE stream URL for chat
   */
  getChatStreamUrl(sessionId: string): string {
    return `${API_BASE_URL}/api/sessions/${sessionId}/chat`;
  },

  /**
   * Get SSE stream URL for events (read-only, no message sending)
   */
  getEventsUrl(sessionId: string): string {
    return `${API_BASE_URL}/api/sessions/${sessionId}/events`;
  },

  /**
   * Cancel a running task
   */
  async cancelTask(token: string, sessionId: string, taskId: string): Promise<{ task_id: string; status: string }> {
    return apiCall<{ task_id: string; status: string }>(
      `/api/sessions/${sessionId}/tasks/${taskId}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  },

  /**
   * Get the currently active task for a session (if any)
   * Returns null if no active task exists
   */
  async getActiveTask(token: string, sessionId: string): Promise<{ task_id: string; session_id: string; status: string; created_at: string; started_at: string | null; message: string } | null> {
    try {
      return await apiCall<{ task_id: string; session_id: string; status: string; created_at: string; started_at: string | null; message: string }>(
        `/api/sessions/${sessionId}/active-task`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (error) {
      // 404 means no active task - return null
      if (error instanceof APIError && error.isStatus(404)) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Toggle session public status
   */
  async setPublic(token: string, sessionId: string, isPublic: boolean): Promise<Session> {
    return apiCall<Session>(`/api/sessions/${sessionId}/public`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ is_public: isPublic }),
    });
  },
};

// Files API
export const filesApi = {
  async upload(token: string, sessionId: string, files: FileList): Promise<{ success: boolean; files: Array<{ success: boolean; filename: string; file_path: string; file_size: number; message: string }>; total: number; message: string }> {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    return apiCall<{ success: boolean; files: Array<{ success: boolean; filename: string; file_path: string; file_size: number; message: string }>; total: number; message: string }>(
      `/api/files/upload?session_id=${sessionId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );
  },

  async list(token: string, sessionId: string, currentPath?: string): Promise<FileRecord[]> {
    const url = currentPath
      ? `/api/files/${sessionId}?current_path=${encodeURIComponent(currentPath)}`
      : `/api/files/${sessionId}`;
    const data = await apiCall<{ files: FileRecord[]; total: number }>(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return data.files;
  },

  getDownloadUrl(sessionId: string, filePath: string): string {
    return `${API_BASE_URL}/api/files/${sessionId}/${encodeURIComponent(filePath)}`;
  },

  /**
   * Preview a file's content
   */
  async preview(token: string, sessionId: string, filePath: string): Promise<FilePreview> {
    return apiCall<FilePreview>(`/api/files/${sessionId}/preview/${encodeURIComponent(filePath)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  /**
   * Get public file URL (no auth required)
   */
  getPublicFileUrl(sessionId: string, filePath: string): string {
    return `${API_BASE_URL}/api/files/public/${sessionId}/${encodeURIComponent(filePath)}`;
  },
};

// Public API (no authentication required)
export const publicApi = {
  /**
   * List all public sessions
   */
  async listSessions(): Promise<PublicSession[]> {
    const data = await apiCall<{ sessions: PublicSession[]; total: number }>('/api/sessions/public');
    return data.sessions;
  },

  /**
   * Get a public session with messages
   */
  async getSession(sessionId: string, token?: string): Promise<PublicSessionDetail> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return apiCall<PublicSessionDetail>(`/api/sessions/public/${sessionId}`, { headers });
  },
};

// DataSources API
export const dataSourcesApi = {
  /**
   * List all data sources for the current user
   */
  async list(token: string): Promise<DataSource[]> {
    const data = await apiCall<{ data_sources: DataSource[]; total: number }>('/api/data-sources', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return data.data_sources;
  },

  /**
   * Get a specific data source by ID
   */
  async get(token: string, id: number): Promise<DataSource> {
    return apiCall<DataSource>(`/api/data-sources/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  /**
   * Create a new data source
   */
  async create(token: string, data: DataSourceCreate): Promise<DataSource> {
    return apiCall<DataSource>('/api/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a data source
   */
  async update(token: string, id: number, data: DataSourceUpdate): Promise<DataSource> {
    return apiCall<DataSource>(`/api/data-sources/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a data source
   */
  async delete(token: string, id: number): Promise<void> {
    await apiCall<void>(`/api/data-sources/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  /**
   * Test a data source connection
   */
  async test(token: string, id: number): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
    return apiCall<{ success: boolean; message: string; details?: Record<string, unknown> }>(
      `/api/data-sources/${id}/test`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  },
};
