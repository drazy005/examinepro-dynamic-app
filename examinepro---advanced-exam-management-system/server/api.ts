import { db } from './db';
import { authService } from './auth';
import { User, Exam, Submission, AuditLog, UserRole, BlogPost } from '../services/types';
import { v4 as uuidv4 } from 'uuid';

// This object simulates the server-side API router.
// The client-side api.ts will call these functions.

const requireAuth = (token?: string) => {
  const user = authService.verifySession(token);
  if (!user) throw new Error("401 Unauthorized");
  return user;
};

const requireRole = (token: string, role: UserRole) => {
    const user = requireAuth(token);
    if (user.role !== role && user.role !== UserRole.SUPERADMIN) {
        throw new Error("403 Forbidden");
    }
    return user;
}

export const serverApi = {
  auth: {
    me: async (token: string): Promise<User | null> => {
        return authService.verifySession(token);
    },
    login: async (email: string, pass: string): Promise<{user: User, token: string}> => {
      const user = db.users.find(u => u.email === email && u.password === pass);
      if (!user) throw new Error("Invalid credentials");
      const { token } = authService.createSession(user.id);
      return { user, token };
    },
    logout: async (token: string) => {
      authService.destroySession(token);
    },
    register: async (userData: Partial<User>): Promise<User> => {
        return db.users.create(userData);
    }
  },

  exams: {
    list: async (token: string): Promise<Exam[]> => {
      requireAuth(token);
      return db.exams.list();
    },
    save: async (token: string, exam: Exam): Promise<Exam> => {
      requireRole(token, UserRole.ADMIN);
      return db.exams.save(exam);
    },
    delete: async (token: string, id: string) => {
      requireRole(token, UserRole.ADMIN);
      db.exams.delete(id);
    }
  },

  submissions: {
    list: async (token: string): Promise<Submission[]> => {
        const user = requireAuth(token);
        if(user.role === UserRole.BASIC) {
            return db.submissions.listForStudent(user.id);
        }
        return db.submissions.list();
    },
    save: async (token: string, sub: Submission): Promise<Submission> => {
      requireAuth(token);
      return db.submissions.save(sub);
    },
    update: async (token: string, sub: Submission): Promise<Submission | null> => {
      requireRole(token, UserRole.ADMIN);
      return db.submissions.update(sub);
    },
    delete: async (token: string, id: string) => {
        requireRole(token, UserRole.ADMIN);
        db.submissions.delete(id);
    }
  },

  admin: {
    getUsers: async (token: string): Promise<User[]> => {
      requireRole(token, UserRole.ADMIN);
      return db.users.list();
    },
    getLogs: async (token: string): Promise<AuditLog[]> => {
      requireRole(token, UserRole.SUPERADMIN);
      return db.auditLogs.list();
    },
    getAnnouncements: async (token: string): Promise<BlogPost[]> => {
        requireAuth(token);
        return db.blog.list();
    },
    updateAnnouncements: async (token: string, posts: BlogPost[]): Promise<BlogPost[]> => {
        requireRole(token, UserRole.SUPERADMIN);
        return db.blog.updateAll(posts);
    },
    // FIX: Add the missing backup method for the Super Admin dashboard.
    backup: async (token: string): Promise<any> => {
        requireRole(token, UserRole.SUPERADMIN);
        return {
            users: db.users.list(),
            exams: db.exams.list(),
            submissions: db.submissions.list(),
            auditLogs: db.auditLogs.list(),
            blogPosts: db.blog.list(),
            timestamp: Date.now()
        };
    },
  }
};