import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export const backendRoot = fileURLToPath(new URL('../', import.meta.url));
for (const path of [resolve(backendRoot, '.env'), resolve(backendRoot, '../.env')]) {
  if (existsSync(path)) process.loadEnvFile(path);
}
export function configuration() {
  const production = process.env.NODE_ENV === 'production';
  const databaseDriver = process.env.DATABASE_DRIVER || 'sqlite';
  if (!['sqlite', 'd1'].includes(databaseDriver)) throw new Error('DATABASE_DRIVER must be sqlite or d1.');
  if (production && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32 || !process.env.APP_PASSWORD || process.env.APP_PASSWORD.length < 12)) {
    throw new Error('Production requires SESSION_SECRET (32+ characters) and APP_PASSWORD (12+ characters). Set them in the API service environment.');
  }
  return {
    production, databaseDriver,
    databasePath: resolve(backendRoot, process.env.DATABASE_PATH || 'data/penny.sqlite'),
    port: Number(process.env.API_PORT || process.env.PORT || 3001),
    host: process.env.API_HOST || '127.0.0.1',
    webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5173',
    ownerId: process.env.OWNER_USER_ID || 'local_seedy',
    ownerName: process.env.OWNER_NAME || 'Your account',
    password: process.env.APP_PASSWORD || '',
    sessionSecret: process.env.SESSION_SECRET || 'development-only-session-secret-do-not-deploy',
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID,
    apiToken: process.env.CLOUDFLARE_D1_API_TOKEN,
  };
}
export type Config = ReturnType<typeof configuration>;
