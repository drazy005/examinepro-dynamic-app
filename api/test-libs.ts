import { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// We test the local import which is the prime suspect
import { authLib } from '../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // Test bcrypt
        const hash = await bcrypt.hash('test', 1);

        // Test jwt
        const token = jwt.sign({ foo: 'bar' }, 'secret');

        // Test local lib
        const cookie = authLib.createCookie('test-token');

        return res.status(200).json({
            status: 'OK',
            modules: {
                bcrypt: 'Loaded',
                jwt: 'Loaded',
                localLib: 'Loaded'
            },
            results: {
                hashStr: hash.substring(0, 10),
                tokenStr: token.substring(0, 10),
                cookieStr: cookie.substring(0, 10)
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            status: 'ERROR',
            message: 'Module loading failed',
            detailedError: error.message,
            stack: error.stack
        });
    }
}
