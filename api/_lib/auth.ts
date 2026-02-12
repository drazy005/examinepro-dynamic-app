import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import * as cookie from 'cookie';
const { serialize } = cookie;

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-do-not-use-in-prod';
const TOKEN_NAME = 'auth_token';

export interface TokenPayload {
    userId: string;
    role: string;
    email?: string;
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
        return signFn(payload, JWT_SECRET, { expiresIn: '24h' }); // 24 hours session
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
        const isProd = process.env.NODE_ENV === 'production';
        return serialize(TOKEN_NAME, token, {
            httpOnly: true,
            secure: isProd, // Vercel is always HTTPS
            sameSite: 'lax', // 'lax' is robust for OAuth redirects and same-domain app
            maxAge: 60 * 60 * 24, // 24 hours
            path: '/',
        });
    },

    // Clear cookie
    removeCookie: () => {
        const isProd = process.env.NODE_ENV === 'production';
        return serialize(TOKEN_NAME, '', {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            maxAge: -1,
            path: '/',
        });
    }
};

export const signToken = authLib.signToken;

// === Google OAuth Helpers ===

export interface GoogleUser {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google`;

export const getGoogleAuthUrl = () => {
    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
        redirect_uri: GOOGLE_REDIRECT_URI,
        client_id: GOOGLE_CLIENT_ID || '',
        access_type: 'offline',
        response_type: 'code',
        prompt: 'consent',
        scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
        ].join(' '),
    };

    const qs = new URLSearchParams(options).toString();
    return `${rootUrl}?${qs}`;
};

export const getGoogleUser = async (code: string): Promise<GoogleUser> => {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const values = {
        code,
        client_id: GOOGLE_CLIENT_ID || '',
        client_secret: GOOGLE_CLIENT_SECRET || '',
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
    };

    const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(values).toString(),
    });

    if (!tokenRes.ok) throw new Error(`Google Token Error: ${tokenRes.statusText}`);

    const { access_token, id_token } = await tokenRes.json();

    // Fetch User Info
    const userRes = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`, {
        headers: { Authorization: `Bearer ${id_token}` },
    });

    if (!userRes.ok) throw new Error(`Google User Error: ${userRes.statusText}`);

    return userRes.json();
};
