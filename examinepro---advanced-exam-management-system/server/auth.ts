
import { User } from '../services/types';
import { db } from './db';
import { v4 as uuidv4 } from 'uuid';

// In a real backend, this would be a secure, expiring JWT. Here we simulate it.
interface Session {
  token: string;
  userId: string;
  createdAt: number;
}

// In-memory session store
const sessions: Session[] = [];
const SESSION_DURATION = 3600 * 1000; // 1 hour

export const authService = {
  createSession: (userId: string): { token: string } => {
    const token = `sess_${uuidv4().replace(/-/g, '')}`;
    sessions.push({ token, userId, createdAt: Date.now() });
    return { token };
  },

  destroySession: (token: string) => {
    const index = sessions.findIndex(s => s.token === token);
    if (index > -1) sessions.splice(index, 1);
  },

  verifySession: (token?: string): User | null => {
    if (!token) return null;
    
    const session = sessions.find(s => s.token === token);
    if (!session) return null;

    if (Date.now() - session.createdAt > SESSION_DURATION) {
      authService.destroySession(token);
      return null;
    }

    return db.users.find(u => u.id === session.userId) || null;
  }
};
