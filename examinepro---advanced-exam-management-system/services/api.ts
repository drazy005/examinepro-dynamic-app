import { User, Exam, Submission, AuditLog, UserRole, BlogPost } from './types';
import { serverApi } from '../server/api';

// This file is the CLIENT-SIDE API client. It calls the simulated backend.

let sessionToken: string | null = sessionStorage.getItem('session_token');

// FIX: Implement a global loading state handler to be consumed by components like Layout.
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
    if (index > -1) {
      loadingSubscribers.splice(index, 1);
    }
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


const simulateLatency = () => new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));

const makeApiCall = <T>(action: () => Promise<T>): Promise<T> => {
    return withLoading(simulateLatency().then(action));
};


export const api = {
  auth: {
    me: async (): Promise<User | null> => makeApiCall(async () => {
      if (!sessionToken) return null;
      try {
        return await serverApi.auth.me(sessionToken);
      } catch (e) {
        sessionToken = null;
        sessionStorage.removeItem('session_token');
        return null;
      }
    }),
    login: async (email: string, pass: string): Promise<User> => makeApiCall(async () => {
      const { user, token } = await serverApi.auth.login(email, pass);
      sessionToken = token;
      sessionStorage.setItem('session_token', token);
      return user;
    }),
    logout: async () => makeApiCall(async () => {
      if (sessionToken) {
        await serverApi.auth.logout(sessionToken);
      }
      sessionToken = null;
      sessionStorage.removeItem('session_token');
    }),
    register: async (userData: Partial<User>): Promise<User> => makeApiCall(() => serverApi.auth.register(userData))
  },

  exams: {
    list: async (): Promise<Exam[]> => makeApiCall(() => serverApi.exams.list(sessionToken!)),
    save: async (exam: Exam): Promise<Exam> => makeApiCall(() => serverApi.exams.save(sessionToken!, exam)),
    delete: async (id: string) => makeApiCall(() => serverApi.exams.delete(sessionToken!, id))
  },

  submissions: {
    list: async (): Promise<Submission[]> => makeApiCall(() => serverApi.submissions.list(sessionToken!)),
    save: async (sub: Submission): Promise<Submission> => makeApiCall(() => serverApi.submissions.save(sessionToken!, sub)),
    update: async (sub: Submission): Promise<Submission | null> => makeApiCall(() => serverApi.submissions.update(sessionToken!, sub)),
    delete: async (id: string) => makeApiCall(() => serverApi.submissions.delete(sessionToken!, id))
  },

  admin: {
    getUsers: async (): Promise<User[]> => makeApiCall(() => serverApi.admin.getUsers(sessionToken!)),
    getLogs: async (): Promise<AuditLog[]> => makeApiCall(() => serverApi.admin.getLogs(sessionToken!)),
    getAnnouncements: async(): Promise<BlogPost[]> => makeApiCall(() => serverApi.admin.getAnnouncements(sessionToken!)),
    updateAnnouncements: async(posts: BlogPost[]): Promise<BlogPost[]> => makeApiCall(() => serverApi.admin.updateAnnouncements(sessionToken!, posts)),
    // FIX: Add the missing backup method for the Super Admin dashboard.
    backup: async (): Promise<any> => makeApiCall(() => serverApi.admin.backup(sessionToken!)),
  }
};