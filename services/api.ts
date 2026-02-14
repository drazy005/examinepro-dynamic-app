
import { Question, Exam, Submission, User } from './types.js';

const API_BASE = '/api';

// === Global Loading State Management ===
type LoadingListener = (isLoading: boolean) => void;
let loadingListeners: LoadingListener[] = [];
let activeRequests = 0;

const notifyLoading = (isLoading: boolean) => {
  loadingListeners.forEach(l => l(isLoading));
};

export const subscribeToLoading = (listener: LoadingListener) => {
  loadingListeners.push(listener);
  return () => {
    loadingListeners = loadingListeners.filter(l => l !== listener);
  };
};

// === Request Wrapper ===
const request = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  if (activeRequests === 0) notifyLoading(true);
  activeRequests++;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include', // Ensure cookies are sent with requests
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      let errorMsg = res.statusText || `Request failed with status ${res.status}`;
      try {
        const json = JSON.parse(text);
        console.error("API Error Detail:", json);
        errorMsg = json.error || errorMsg;
      } catch (e) {
        console.error("API Error Text:", text);
        // If text is HTML (Vercel 404/500 page), showing it is helpful
        if (text.includes('<!DOCTYPE html>')) errorMsg = `Server Error (${res.status})`;
      }
      throw new Error(errorMsg);
    }

    if (res.status === 204) return {} as T;
    return res.json();
  } finally {
    activeRequests--;
    if (activeRequests === 0) notifyLoading(false);
  }
};

// === API Definitions ===
export const api = {
  auth: {
    login: (credentials: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (data: any) => request<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request<any>('/auth/me'),
    logout: () => request<any>('/auth/logout', { method: 'POST' }),
    forgotPassword: (email: string) => request<void>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  },
  questions: {
    list: (params: any = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request<{ data: Question[], pagination: any } | Question[]>(`/questions?${qs}`);
    },
    getBatches: () => request<string[]>('/api/questions?action=get-batches'),
    create: (data: Partial<Question>) => request<Question>('/questions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Question>) => request<Question>(`/questions?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/questions?id=${id}`, { method: 'DELETE' }),

    import: (data: any[]) => request<{ count: number }>('/questions?action=batch', { method: 'POST', body: JSON.stringify(data) }),
    bulkDelete: (ids: string[]) => request<{ count: number }>('/questions?action=batch', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  },
  exams: {
    list: (mode: 'all' | 'available' = 'all') => request<Exam[]>(`/exams?mode=${mode}`),
    get: (id: string) => request<Exam>(`/exams?id=${id}`),
    create: (data: Partial<Exam>) => request<Exam>('/exams', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Exam>) => request<Exam>(`/exams?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/exams?id=${id}`, { method: 'DELETE' }),
    releaseResults: (id: string) => request<void>(`/exams?id=${id}&action=release`, { method: 'POST' }),
    start: (examId: string) => request<{ exam: Exam, startTime: number, submissionId: string, answersDraft?: any, resumed?: boolean }>('/submissions?action=start', { method: 'POST', body: JSON.stringify({ examId }) }),
  },
  submissions: {
    list: (params: { page?: number; limit?: number; mode?: 'history' } = {}) => {
      const qs = new URLSearchParams(params as any).toString();
      return request<{ data: Submission[], pagination: any } | Submission[]>(`/submissions?${qs}`);
    },
    get: (id: string) => request<Submission>(`/submissions?id=${id}`),
    create: (data: any) => request<Submission>('/submissions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<Submission>(`/submissions?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/submissions?id=${id}`, { method: 'DELETE' }),
    saveDraft: (submissionId: string, answers: any) => request<void>('/submissions?action=draft', { method: 'POST', body: JSON.stringify({ submissionId, answers }) }),
    grade: (submissionId: string, questionId: string, result: any) => request<void>(`/submissions?id=${submissionId}&action=grade`, { method: 'POST', body: JSON.stringify({ questionId, result }) }),
    release: (submissionId: string) => request<void>(`/submissions?id=${submissionId}&action=release`, { method: 'POST' }),
    toggleRelease: (submissionId: string, release: boolean) => request<void>(`/submissions?id=${submissionId}&action=toggle-release`, { method: 'POST', body: JSON.stringify({ release }) }),
    releaseAll: () => request<void>('/submissions?action=release-all-scheduled', { method: 'POST' }),
    regradeAll: () => request<{ success: boolean; count: number }>('/submissions?action=regrade-all', { method: 'POST' }),
    regrade: (id: string) => request<{ success: boolean; result: any }>(`/submissions?id=${id}&action=regrade`, { method: 'POST' }),
    aiGrade: (submissionId: string) => request<void>(`/submissions?id=${submissionId}&action=ai-grade`, { method: 'POST' }),
    markReviewed: (submissionId: string) => request<void>(`/submissions?id=${submissionId}&action=review`, { method: 'POST' }),
    bulkDelete: (ids: string[]) => request<void>(`/submissions?ids=${ids.join(',')}`, { method: 'DELETE' }),
  },
  admin: {
    users: Object.assign(
      (page = 1, limit = 50) => request<{ data: any[], pagination: any }>(`/admin/users?page=${page}&limit=${limit}`),
      {
        resetPassword: (userId: string, newPassword: string) => request<any>('/admin/users', {
          method: 'POST',
          body: JSON.stringify({ action: 'reset-password', userId, newPassword })
        })
      }
    ),
    logs: (page = 1, limit = 50) => request<{ data: any[], pagination: any }>(`/admin/logs?page=${page}&limit=${limit}`),
    stats: () => request<any>('/admin/stats'),
    broadcast: (data: any) => request<any>('/admin/broadcast', { method: 'POST', body: JSON.stringify(data) }),
    testEmail: (email: string) => request<any>('/admin/test-email', { method: 'POST', body: JSON.stringify({ email }) }),
    announcements: {
      list: () => request<any[]>('/admin/announcements'),
      create: (data: any[]) => request<any[]>('/admin/announcements', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id: string) => request<void>(`/admin/announcements?id=${id}`, { method: 'DELETE' }),
      bulkDelete: (ids: string[]) => request<void>('/admin/announcements', { method: 'DELETE', body: JSON.stringify({ ids }) }),
    },
  },
  settings: {
    get: () => request<any>('/admin/settings'),
    update: (data: any) => request<any>('/admin/settings', { method: 'POST', body: JSON.stringify(data) }),
  }
};

export const withLoading = async <T>(promise: Promise<T>, setLoading?: (l: boolean) => void): Promise<T> => {
  if (setLoading) setLoading(true);
  try {
    return await promise;
  } finally {
    if (setLoading) setLoading(false);
  }
};