import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { configuration } from './config.js';
import { openDatabase, type Store } from './database.js';
export async function migrate(store: Store) {
  await store.execute('CREATE TABLE IF NOT EXISTS penny_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)', [], 'run');
  const directory = fileURLToPath(new URL('../migrations/', import.meta.url));
  for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
    const sql = readFileSync(resolve(directory, name), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const existing = (await store.execute('SELECT checksum FROM penny_migrations WHERE name = ?', [name], 'get')).rows;
    if (existing) {
      if (existing[0] !== checksum) throw new Error(`Applied migration changed: ${name}. Add a new migration instead.`);
      continue;
    }
    for (const statement of sql.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean)) await store.execute(statement, [], 'run');
    await store.execute('INSERT INTO penny_migrations (name, checksum, applied_at) VALUES (?, ?, ?)', [name, checksum, new Date().toISOString()], 'run');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const store = openDatabase(configuration());
  try { await migrate(store); console.log('Database migrations applied.'); } finally { store.close(); }
}
