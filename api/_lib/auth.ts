import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { serialize } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-do-not-use-in-prod';
const TOKEN_NAME = 'auth_token';

export interface TokenPayload {
    userId: string;
    role: string;
}

export const authLib = {
    // Hash password
    hashPassword: async (password: string) => {
        return await bcrypt.hash(password, 10);
    },

    // Verify password
    verifyPassword: async (password: string, hash: string) => {
        return await bcrypt.compare(password, hash);
    },

    // Sign JWT
    signToken: (payload: TokenPayload) => {
        return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); // 7 days session
    },

    // Verify JWT
    verifyToken: (token: string): TokenPayload | null => {
        try {
            return jwt.verify(token, JWT_SECRET) as TokenPayload;
        } catch (e) {
            return null;
        }
    },

    // Create HTTP-only cookie
    createCookie: (token: string) => {
        return serialize(TOKEN_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });
    },

    // Clear cookie
    removeCookie: () => {
        return serialize(TOKEN_NAME, '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: -1,
            path: '/',
        });
    }
};
