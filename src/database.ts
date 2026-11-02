import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { drizzle, type AsyncRemoteCallback } from 'drizzle-orm/sqlite-proxy';
import type { Config } from './config.js';
import * as schema from './schema.js';

export function openDatabase(config: Config) {
  let sqlite: DatabaseSync | undefined;
  let execute: AsyncRemoteCallback;
  if (config.databaseDriver === 'sqlite') {
    if (config.databasePath !== ':memory:') mkdirSync(dirname(config.databasePath), { recursive: true });
    sqlite = new DatabaseSync(config.databasePath);
    sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    const connection = sqlite;
    execute = async (sql, parameters, method) => {
      const statement = connection.prepare(sql);
      if (method === 'run') { statement.run(...parameters); return { rows: [] }; }
      statement.setReturnArrays(true);
      return { rows: method === 'get' ? statement.get(...parameters) as unknown as unknown[] : statement.all(...parameters) };
    };
  } else {
    if (!config.accountId || !/^[a-f0-9]{32}$/i.test(config.accountId) || !config.databaseId || !/^[a-f0-9-]{36}$/i.test(config.databaseId) || !config.apiToken) {
      throw new Error('D1 requires CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID and CLOUDFLARE_D1_API_TOKEN on the API service.');
    }
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/raw`;
    execute = async (sql, params, method) => {
      const response = await fetch(endpoint, {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, params }),
      });
      const body = await response.json() as { success: boolean; result?: { success: boolean; results?: { rows?: unknown[][] } }[] };
      if (!response.ok || !body.success || body.result?.some(result => !result.success)) throw new Error('D1 query failed. Check the API service credentials and database status.');
      const rows = body.result?.[0]?.results?.rows || [];
      return { rows: method === 'get' ? rows[0] as unknown[] : rows };
    };
  }
  return { db: drizzle(execute, { schema }), execute, sqlite, close: () => sqlite?.close() };
}
export type Store = ReturnType<typeof openDatabase>;
