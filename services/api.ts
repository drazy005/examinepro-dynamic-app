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
    }
  },

  exams: {
    list: async (): Promise<Exam[]> => withLoading(request<Exam[]>('/exams')),
    listAvailable: async (): Promise<Exam[]> => withLoading(request<Exam[]>('/exams?mode=available')),

    create: async (exam: Exam): Promise<Exam> => withLoading(request<Exam>('/exams', {
      method: 'POST',
      body: JSON.stringify(exam)
    })),
    update: async (exam: Exam): Promise<Exam> => withLoading(request<Exam>(`/exams/${exam.id}`, {
      method: 'PUT',
      body: JSON.stringify(exam)
    })),
    // Deprecated save in favor of explicit create/update, keeping for backward compat if needed but usually removed
    save: async (exam: Exam): Promise<Exam> => withLoading(request<Exam>('/exams', {
      method: 'POST',
      body: JSON.stringify(exam)
    })),
    delete: async (id: string) => withLoading(request(`/exams/${id}`, { method: 'DELETE' }))
  },

  submissions: {
    list: async (): Promise<Submission[]> => withLoading(request<Submission[]>('/submissions')),
    listMyHistory: async (): Promise<Submission[]> => withLoading(request<Submission[]>('/submissions?mode=history')),
    save: async (sub: Submission): Promise<Submission> => withLoading(request<Submission>('/submissions', {
      method: 'POST',
      body: JSON.stringify(sub)
    })),
    update: async (sub: Submission): Promise<Submission | null> => withLoading(request<Submission>(`/submissions/${sub.id}`, {
      method: 'PUT',
      body: JSON.stringify(sub)
    })),
    delete: async (id: string) => withLoading(request(`/submissions/${id}`, { method: 'DELETE' }))
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
    getUsers: async (): Promise<User[]> => withLoading(request<User[]>('/admin/users')),
    getLogs: async (): Promise<AuditLog[]> => withLoading(request<AuditLog[]>('/admin/logs')),
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
  }
};