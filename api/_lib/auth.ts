import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import * as cookie from 'cookie';
const { serialize } = cookie;

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-do-not-use-in-prod';
const TOKEN_NAME = 'auth_token';

export interface TokenPayload {
    userId: string;
    role: string;
}

export const authLib = {
    // Hash password
    hashPassword: async (password: string) => {
        // Handle CJS/ESM interop
        const hashFn = bcrypt.hash || (bcrypt as any).default?.hash;
        if (!hashFn) throw new Error('bcrypt.hash is not available');
        return await hashFn(password, 10);
    },

    // Verify password
    verifyPassword: async (password: string, hash: string) => {
        const compareFn = bcrypt.compare || (bcrypt as any).default?.compare;
        if (!compareFn) throw new Error('bcrypt.compare is not available');
        return await compareFn(password, hash);
    },

    // Sign JWT
    signToken: (payload: TokenPayload) => {
        const signFn = jwt.sign || (jwt as any).default?.sign;
        if (!signFn) throw new Error('jwt.sign is not available');
        return signFn(payload, JWT_SECRET, { expiresIn: '7d' }); // 7 days session
    },

    // Verify JWT
    verifyToken: (token: string): TokenPayload | null => {
        try {
            const verifyFn = jwt.verify || (jwt as any).default?.verify;
            if (!verifyFn) throw new Error('jwt.verify is not available');
            return verifyFn(token, JWT_SECRET) as TokenPayload;
        } catch (e) {
            return null;
        }
    },

    // Create HTTP-only cookie
    createCookie: (token: string) => {
        return serialize(TOKEN_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax', // Lax is required for consistent sessions during navigation
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });
    },

    // Clear cookie
    removeCookie: () => {
        return serialize(TOKEN_NAME, '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: -1,
            path: '/',
        });
    }
};
