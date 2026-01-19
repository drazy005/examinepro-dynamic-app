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
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
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
      // Assuming we will implement register similarly
      return withLoading(request<User>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      }));
    }
  },

  exams: {
    // Placeholder for Phase 3 migration - temporarily throwing error or keeping old shim if needed
    // But per plan, we assume these will be migrated. For now, let's point them to /api/exams
    // Knowing they don't exist yet, this will fail if used.
    list: async (): Promise<Exam[]> => withLoading(request<Exam[]>('/exams')),
    save: async (exam: Exam): Promise<Exam> => withLoading(request<Exam>('/exams', {
      method: 'POST',
      body: JSON.stringify(exam)
    })),
    delete: async (id: string) => withLoading(request(`/exams/${id}`, { method: 'DELETE' }))
  },

  submissions: {
    list: async (): Promise<Submission[]> => withLoading(request<Submission[]>('/submissions')),
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
    save: async (question: Question): Promise<Question> => withLoading(request<Question>('/questions', {
      method: 'POST',
      body: JSON.stringify(question)
    })),
    delete: async (id: string) => withLoading(request(`/questions/${id}`, { method: 'DELETE' }))
  },

  admin: {
    // Placeholder for admin endpoints
    getUsers: async (): Promise<User[]> => withLoading(request<User[]>('/admin/users')),
    getLogs: async (): Promise<AuditLog[]> => withLoading(request<AuditLog[]>('/admin/logs')),
    getAnnouncements: async (): Promise<BlogPost[]> => withLoading(request<BlogPost[]>('/admin/announcements')),
    updateAnnouncements: async (posts: BlogPost[]): Promise<BlogPost[]> => withLoading(request<BlogPost[]>('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(posts)
    })),
    backup: async (): Promise<any> => withLoading(request('/admin/backup')),
  }
};