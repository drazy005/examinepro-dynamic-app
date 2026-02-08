
import { Question, Exam, Submission, User } from './types.js';
import { useJson } from './useJson.js'; // Helper if needed, but we use standard fetch here mainly
import { AuthToken } from '../api/_lib/auth.js'; // Type ref

const API_BASE = '/api';

// Simple fetch wrapper
const request = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    // Try to parse error
    let errorMsg = res.statusText;
    try {
      const json = await res.json();
      errorMsg = json.error || errorMsg;
    } catch { }
    throw new Error(errorMsg);
  }

  // Handle 204 No Content or empty responses if needed
  if (res.status === 204) return {} as T;

  return res.json();
};

// Hook-like helper for loading state (used in components usually, but here we just export functions)
// We'll keep the structure simple.

export const api = {
  auth: {
    login: (credentials: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (data: any) => request<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request<any>('/auth/me'),
    logout: () => request<any>('/auth/logout', { method: 'POST' }),
  },
  questions: {
    list: () => request<Question[]>('/questions'),
    create: (data: Partial<Question>) => request<Question>('/questions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Question>) => request<Question>(`/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/questions/${id}`, { method: 'DELETE' }),
    import: (data: any[]) => request<{ count: number }>('/questions?action=batch', { method: 'POST', body: JSON.stringify(data) }),
    bulkDelete: (ids: string[]) => request<{ count: number }>('/questions?action=batch', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  },
  exams: {
    list: (mode: 'all' | 'available' = 'all') => request<Exam[]>(`/exams?mode=${mode}`),
    get: (id: string) => request<Exam>(`/exams/${id}`),
    create: (data: Partial<Exam>) => request<Exam>('/exams', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Exam>) => request<Exam>(`/exams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/exams/${id}`, { method: 'DELETE' }),
    releaseResults: (id: string) => request<void>(`/exams/${id}?action=release`, { method: 'POST' }),
  },
  submissions: {
    list: (params: { page?: number; limit?: number; mode?: 'history' } = {}) => {
      const qs = new URLSearchParams(params as any).toString();
      return request<{ data: Submission[], pagination: any } | Submission[]>(`/submissions?${qs}`);
    },
    get: (id: string) => request<Submission>(`/submissions/${id}`),
    create: (data: any) => request<Submission>('/submissions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<Submission>(`/submissions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    saveDraft: (submissionId: string, answers: any) => request<void>('/submissions?action=draft', { method: 'POST', body: JSON.stringify({ submissionId, answers }) }),
    grade: (submissionId: string, questionId: string, result: any) => request<void>(`/submissions/${submissionId}?action=grade`, { method: 'POST', body: JSON.stringify({ questionId, result }) }),
    release: (submissionId: string) => request<void>(`/submissions/${submissionId}?action=release`, { method: 'POST' }),
    releaseAll: () => request<void>('/submissions?action=release-all', { method: 'POST' }),
    aiGrade: (submissionId: string) => request<void>(`/submissions/${submissionId}?action=ai-grade`, { method: 'POST' }),
  },
  admin: {
    users: () => request<any[]>('/admin/users'),
    logs: () => request<any[]>('/admin/logs'),
    stats: () => request<any>('/admin/stats'),
  },
  settings: {
    get: () => request<any>('/settings'),
    update: (data: any) => request<any>('/settings', { method: 'POST', body: JSON.stringify(data) }),
  }
};

// Helper for components to wrap async calls
export const withLoading = async <T>(promise: Promise<T>, setLoading?: (l: boolean) => void): Promise<T> => {
  if (setLoading) setLoading(true);
  try {
    return await promise;
  } finally {
    if (setLoading) setLoading(false);
  }
};