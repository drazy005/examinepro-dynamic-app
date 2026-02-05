import { User, Exam, Submission, AuditLog, UserRole, BlogPost, Question } from './types';

// Global loading subscribers
const loadingSubscribers: ((loading: boolean) => void)[] = [];
let activeRequests = 0;

const notifySubscribers = () => {
  const isLoading = activeRequests > 0;
  loadingSubscribers.forEach(cb => cb(isLoading));
};

export const subscribeToLoading = (callback: (loading: boolean) => void) => {
  loadingSubscribers.push(callback);
  return () => {
    const index = loadingSubscribers.indexOf(callback);
    if (index > -1) loadingSubscribers.splice(index, 1);
  };
};

const withLoading = async <T>(promise: Promise<T>): Promise<T> => {
  activeRequests++;
  notifySubscribers();
  try {
    return await promise;
  } finally {
    activeRequests--;
    notifySubscribers();
  }
};

// Generic fetch wrapper
const request = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMessage = `Request failed: ${res.status}`;
    try {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data.error) errorMessage = data.error;
      } catch {
        // If not JSON, use the raw text (truncated if too long to avoid huge alerts)
        // This catches Vercel HTML error pages
        errorMessage = `Server Error (${res.status}): ${text.substring(0, 200)}`;
      }
    } catch (e) {
      // Failed to read text
    }
    throw new Error(errorMessage);
  }

  // Some endpoints might return empty body (e.g. logout)
  if (res.status === 204) return {} as T;

  return res.json();
}

export const api = {
  auth: {
    me: async (): Promise<User | null> => {
      return withLoading(request<User>('/auth/me').catch(() => null));
    },
    login: async (email: string, pass: string): Promise<User> => {
      const { user } = await withLoading(request<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass })
      }));
      return user;
    },
    logout: async () => {
      await withLoading(request('/auth/logout', { method: 'POST' }));
    },
    register: async (userData: Partial<User>): Promise<User> => {
      return withLoading(request<User>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      }));
    },
    forgotPassword: async (email: string): Promise<{ message: string }> => {
      return withLoading(request<{ message: string }>('/auth/forgot', {
        method: 'POST',
        body: JSON.stringify({ email })
      }));
    }
  },

  exams: {
    list: async (): Promise<Exam[]> => withLoading(request<Exam[]>('/exams')),
    listAvailable: async (): Promise<Exam[]> => withLoading(request<Exam[]>('/exams?mode=available')),
    get: async (id: string): Promise<Exam> => withLoading(request<Exam>(`/exams/${id}`)),

    create: async (exam: Exam): Promise<Exam> => withLoading(request<Exam>('/exams', {
      method: 'POST',
      body: JSON.stringify(exam)
    })),
    update: async (exam: Exam): Promise<Exam> => withLoading(request<Exam>(`/exams/${exam.id}`, {
      method: 'PUT',
      body: JSON.stringify(exam)
    })),
    startAttempt: async (examId: string): Promise<{ submissionId: string, answersDraft: any, timeStarted: number, resumed: boolean }> => withLoading(request<{ submissionId: string, answersDraft: any, timeStarted: number, resumed: boolean }>('/attempt/start', {
      method: 'POST',
      body: JSON.stringify({ examId })
    })),
    // Deprecated save in favor of explicit create/update, keeping for backward compat if needed but usually removed
    save: async (exam: Exam): Promise<Exam> => withLoading(request<Exam>('/exams', {
      method: 'POST',
      body: JSON.stringify(exam)
    })),
    delete: async (id: string) => withLoading(request(`/exams/${id}`, { method: 'DELETE' }))
  },

  submissions: {
    list: async (page = 1, limit = 50): Promise<{ data: Submission[], pagination: any }> => withLoading(request<{ data: Submission[], pagination: any }>(`/submissions?page=${page}&limit=${limit}`)),
    listMyHistory: async (): Promise<Submission[]> => withLoading(request<Submission[]>('/submissions?mode=history')),
    save: async (sub: Submission): Promise<Submission> => withLoading(request<Submission>('/submissions', {
      method: 'POST',
      body: JSON.stringify(sub)
    })),
    saveDraft: async (submissionId: string, answers: any): Promise<{ success: boolean; savedAt: number }> => request<{ success: boolean; savedAt: number }>('/submissions/draft', {
      method: 'POST',
      body: JSON.stringify({ submissionId, answers })
    }),
    update: async (sub: Submission): Promise<Submission | null> => withLoading(request<Submission>(`/submissions/${sub.id}`, {
      method: 'PUT',
      body: JSON.stringify(sub)
    })),
    delete: async (id: string) => withLoading(request(`/submissions/${id}`, { method: 'DELETE' })),
    // Admin Actions
    bulkDelete: async (ids: string[]) => withLoading(request(`/submissions?ids=${ids.join(',')}`, { method: 'DELETE' })), // Assuming API supports this or we use a different endpoint
    manualGrade: async (submissionId: string, questionId: string, result: any) => withLoading(request(`/submissions/${submissionId}/grade`, { method: 'POST', body: JSON.stringify({ questionId, result }) })),
    releaseResultsForExam: async (examId: string) => withLoading(request(`/exams/${examId}/release`, { method: 'POST' })),
    releaseSingleSubmission: async (submissionId: string) => withLoading(request(`/submissions/${submissionId}/release`, { method: 'POST' })),
    releaseAllDelayedResults: async () => withLoading(request(`/submissions/release-all`, { method: 'POST' })),
    aiGrade: async (submissionId: string) => withLoading(request(`/submissions/${submissionId}/ai-grade`, { method: 'POST' }))
  },

  questions: {
    list: async (): Promise<Question[]> => withLoading(request<Question[]>('/questions')),

    create: async (question: Question): Promise<Question> => withLoading(request<Question>('/questions', {
      method: 'POST',
      body: JSON.stringify(question)
    })),

    update: async (question: Question): Promise<Question> => withLoading(request<Question>(`/questions/${question.id}`, {
      method: 'PUT', // Requires api/questions/[id].ts
      body: JSON.stringify(question)
    })),

    save: async (question: Question): Promise<Question> => {
      // Logic handled by consumer usually, but fallback here
      if (question.id && question.id.length > 10) { // Simple check for existing ID
        return api.questions.update(question);
      }
      return api.questions.create(question);
    },

    delete: async (id: string) => withLoading(request(`/questions/${id}`, { method: 'DELETE' }))
  },

  admin: {
    getUsers: async (page = 1, limit = 50): Promise<{ data: User[], pagination: any }> => withLoading(request<{ data: User[], pagination: any }>(`/admin/users?resource=users&page=${page}&limit=${limit}`)),
    getLogs: async (page = 1, limit = 50): Promise<{ data: AuditLog[], pagination: any }> => withLoading(request<{ data: AuditLog[], pagination: any }>(`/admin/logs?resource=logs&page=${page}&limit=${limit}`)),
    getAnnouncements: async (): Promise<BlogPost[]> => withLoading(request<BlogPost[]>('/admin/announcements')),
    updateAnnouncements: async (posts: BlogPost[]): Promise<BlogPost[]> => withLoading(request<BlogPost[]>('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(posts)
    })),
    getSettings: async (): Promise<any> => withLoading(request<any>('/settings')),
    updateSettings: async (settings: any): Promise<any> => withLoading(request<any>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    })),
    testEmail: async (email: string): Promise<{ success: boolean; message: string }> => withLoading(request<{ success: boolean; message: string }>('/admin/test-email', {
      method: 'POST',
      body: JSON.stringify({ email })
    })),
  }
};