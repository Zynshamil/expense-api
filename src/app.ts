import express, { type NextFunction, type Request, type Response } from 'express';
import type { Config } from './config.js';
import type { Store } from './database.js';
import { authentication } from './auth.js';
import { ledger, HttpError } from './ledger.js';

export function createApp(config: Config, store: Store) {
  const app = express(), auth = authentication(config), service = ledger(store);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb', strict: true }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== config.webOrigin) {
      res.status(403).json({ error: 'Request origin is not allowed.' }); return;
    }
    next();
  });
  app.get('/api/health', async (_req, res) => {
    await store.execute('SELECT 1', [], 'get');
    res.json({ status: 'ok', service: 'penny-express-api', database: config.databaseDriver });
  });
  const attempts = new Map<string, { count: number; until: number }>();
  app.post('/api/auth/login', (req, res) => {
    const address = req.socket.remoteAddress || 'unknown', now = Date.now();
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
    const current = attempts.get(address) || { count: 0, until: now + 15 * 60000 };
    if (current.count >= 10) { res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' }); return; }
    if (!auth.login(req.body?.password, res)) {
      attempts.set(address, { ...current, count: current.count + 1 });
      res.status(401).json({ error: 'Incorrect password.' }); return;
    }
    attempts.delete(address); res.json({ ok: true });
  });
  app.post('/api/auth/logout', (_req, res) => { auth.logout(res); res.json({ ok: true }); });
  app.use('/api', (req, res, next) => {
    const user = auth.user(req);
    if (!user) { res.status(401).json({ error: 'Please sign in to continue.' }); return; }
    res.locals.user = user; next();
  });
  app.get('/api/auth/me', (_req, res) => res.json({ user: res.locals.user, development: !config.production }));
  app.get('/api/ledger', async (_req, res) => res.json({ ...await service.list(res.locals.user.id), user: res.locals.user, development: !config.production }));
  app.post('/api/ledger', async (req, res) => res.status(201).json(await service.create(res.locals.user.id, req.body)));
  app.put('/api/ledger', async (req, res) => res.json(await service.update(res.locals.user.id, req.body)));
  app.delete('/api/ledger', async (req, res) => res.json(await service.remove(res.locals.user.id, req.body)));
  app.patch('/api/ledger', async (req, res) => res.json(await service.updateProfile(res.locals.user.id, req.body)));
  app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
    const bodyError = error as { type?: string };
    if (bodyError.type === 'entity.parse.failed') { res.status(400).json({ error: 'Send valid JSON.' }); return; }
    if (bodyError.type === 'entity.too.large') { res.status(413).json({ error: 'Request is too large.' }); return; }
    console.error('Express API request failed:', error);
    res.status(500).json({ error: 'Could not complete your request. Please try again.' });
  });
  return app;
}
