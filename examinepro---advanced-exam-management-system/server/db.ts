
import { User, UserRole, Exam, Submission, AuditLog, QuestionType, Difficulty, ResultRelease, BlogPost } from '../services/types';
import { v4 as uuidv4 } from 'uuid';

// --- IN-MEMORY DATABASE TABLES ---

let users: User[] = [
  { id: 'super-001', name: 'Root Administrator', email: 'super@examine.pro', password: 'Password123!', role: UserRole.SUPERADMIN, isVerified: true },
  { id: 'admin-001', name: 'Dr. Evelyn Reed', email: 'admin@examine.pro', password: 'Password123!', role: UserRole.ADMIN, isVerified: true },
  { id: 'user-001', name: 'Alex Johnson', email: 'student@examine.pro', password: 'Password123!', role: UserRole.BASIC, isVerified: true },
];

let exams: Exam[] = [
  // ... (Example exam data can be added here)
];

let submissions: Submission[] = [
  // ... (Example submission data can be added here)
];

let auditLogs: AuditLog[] = [];
let blogPosts: BlogPost[] = [
    { id: 'post-1', title: 'Welcome to the New Platform', content: 'We are excited to launch the new ExaminePro. Explore the new features and improved interface.', authorId: 'super-001', authorName: 'System Admin', createdAt: Date.now() - 86400000, published: true }
];

// --- DATABASE ACCESS LAYER ---

export const db = {
  users: {
    find: (predicate: (u: User) => boolean) => users.find(predicate),
    list: () => users,
    create: (data: Partial<User>) => {
      const newUser: User = { ...data, id: uuidv4(), isVerified: true, lastActive: Date.now() } as User;
      users.push(newUser);
      return newUser;
    }
  },
  exams: {
    list: () => exams,
    find: (id: string) => exams.find(e => e.id === id),
    save: (exam: Exam) => {
      const index = exams.findIndex(e => e.id === exam.id);
      if (index > -1) {
        exams[index] = exam;
      } else {
        exams.unshift(exam);
      }
      return exam;
    },
    delete: (id: string) => {
      exams = exams.filter(e => e.id !== id);
    }
  },
  submissions: {
    list: () => submissions,
    listForStudent: (studentId: string) => submissions.filter(s => s.studentId === studentId),
    find: (id: string) => submissions.find(s => s.id === id),
    save: (sub: Submission) => {
      submissions.unshift(sub);
      return sub;
    },
    update: (sub: Submission) => {
      const index = submissions.findIndex(s => s.id === sub.id);
      if(index > -1) {
          submissions[index] = sub;
          return sub;
      }
      return null;
    },
    delete: (id: string) => {
      submissions = submissions.filter(s => s.id !== id);
    }
  },
  auditLogs: {
    list: () => auditLogs.slice(0, 200),
    add: (log: AuditLog) => {
      auditLogs.unshift(log);
      if (auditLogs.length > 500) auditLogs.pop();
    }
  },
  blog: {
      list: () => blogPosts,
      updateAll: (posts: BlogPost[]) => {
          blogPosts = posts;
          return blogPosts;
      }
  }
};
