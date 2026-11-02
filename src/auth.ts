import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Config } from './config.js';
export type User = { id: string; displayName: string };
const cookieName = 'penny_session';
export function authentication(config: Config) {
  const salt = randomBytes(16);
  const passwordHash = scryptSync(config.password, salt, 64);
  const sign = (text: string) => createHmac('sha256', config.sessionSecret).update(text).digest('base64url');
  const isLocal = (req: Request) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '');
  function user(req: Request): User | null {
    if (!config.production && isLocal(req)) return { id: config.ownerId, displayName: config.ownerName };
    const token = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    if (!token) return null;
    try {
      const [body, signature] = token.split('.');
      const expected = Buffer.from(sign(body)), actual = Buffer.from(signature || '');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { sub: string; exp: number };
      if (payload.sub !== config.ownerId || payload.exp <= Date.now()) return null;
      return { id: config.ownerId, displayName: config.ownerName };
    } catch { return null; }
  }
  function login(password: unknown, res: Response) {
    if (typeof password !== 'string' || password.length > 1024 || !config.password || !timingSafeEqual(passwordHash, scryptSync(password, salt, 64))) return false;
    const body = Buffer.from(JSON.stringify({ sub: config.ownerId, exp: Date.now() + 7 * 86400000 })).toString('base64url');
    res.cookie(cookieName, `${body}.${sign(body)}`, { httpOnly: true, secure: config.production, sameSite: 'lax', path: '/', maxAge: 7 * 86400000 });
    return true;
  }
  function logout(res: Response) { res.clearCookie(cookieName, { httpOnly: true, secure: config.production, sameSite: 'lax', path: '/' }); }
  return { user, login, logout };
}
