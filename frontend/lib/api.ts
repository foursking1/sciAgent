/**
 * API client for SciAgent backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
  agent_type: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Message {
  id: number;
  session_id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
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
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
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
    const data = await apiCall<{ sessions: Session[]; total: number }>('/api/sessions', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return data.sessions;
  },

  async get(token: string, sessionId: string): Promise<Session> {
    return apiCall<Session>(`/api/sessions/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  async create(token: string, agent_type?: string): Promise<Session> {
    return apiCall<Session>('/api/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ agent_type }),
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

  async getMessages(token: string, sessionId: string): Promise<Message[]> {
    return apiCall<Message[]>(`/api/sessions/${sessionId}/messages`, {
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
};

// Files API
export const filesApi = {
  async upload(token: string, sessionId: string, files: FileList): Promise<{ success: boolean; filename: string; file_path: string; file_size: number; message: string }> {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('file', file);
    });

    return apiCall<{ success: boolean; filename: string; file_path: string; file_size: number; message: string }>(
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

  async list(token: string, sessionId: string): Promise<FileRecord[]> {
    const data = await apiCall<{ files: FileRecord[]; total: number }>(
      `/api/files/${sessionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return data.files;
  },

  getDownloadUrl(sessionId: string, filePath: string): string {
    return `${API_BASE_URL}/api/files/${sessionId}/${encodeURIComponent(filePath)}`;
  },

  async delete(token: string, filePath: string, sessionId: string): Promise<void> {
    await apiCall<void>(`/api/files/${encodeURIComponent(filePath)}?session_id=${sessionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },
};
