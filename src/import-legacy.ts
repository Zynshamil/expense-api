import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { configuration, backendRoot } from './config.js';
import { openDatabase } from './database.js';
import { migrate } from './migrate.js';

const config = configuration();
if (config.databaseDriver !== 'sqlite') throw new Error('Legacy local import must target a local SQLite database.');
const folder = resolve(backendRoot, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const candidates = existsSync(folder) ? readdirSync(folder).filter(name => name.endsWith('.sqlite') && name !== 'metadata.sqlite') : [];
if (candidates.length !== 1) throw new Error('Expected one legacy expense database. Pass through a manual reviewed import when multiple databases exist.');
const source = new DatabaseSync(resolve(folder, candidates[0]), { readOnly: true });
const store = openDatabase(config);
try {
  await migrate(store);
  const backupFolder = resolve(backendRoot, '.sites-runtime/backups');
  mkdirSync(backupFolder, { recursive: true });
  const backupPath = resolve(backupFolder, `legacy-${Date.now()}.sqlite`);
  await backup(source, backupPath);
  const profiles = source.prepare('SELECT user_id, currency, budget, categories FROM profiles').all();
  const expenses = source.prepare('SELECT id, user_id, amount, title, category_id, subcategory, date, payment, notes, created_at FROM expenses').all();
  store.sqlite!.exec('BEGIN IMMEDIATE');
  try {
    const insertProfile = store.sqlite!.prepare('INSERT OR IGNORE INTO profiles (user_id,currency,budget,categories) VALUES (?,?,?,?)');
    const insertExpense = store.sqlite!.prepare('INSERT OR IGNORE INTO expenses (id,user_id,amount,title,category_id,subcategory,date,payment,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
    let profileCount = 0, expenseCount = 0;
    for (const row of profiles) profileCount += Number(insertProfile.run(row.user_id, row.currency, row.budget, row.categories).changes);
    for (const row of expenses) expenseCount += Number(insertExpense.run(row.id,row.user_id,row.amount,row.title,row.category_id,row.subcategory,row.date,row.payment,row.notes,row.created_at).changes);
    store.sqlite!.exec('COMMIT');
    console.log(`Imported ${expenseCount} expenses and ${profileCount} profiles. Original database retained; backup saved under api/.sites-runtime/backups.`);
  } catch (error) { store.sqlite!.exec('ROLLBACK'); throw error; }
} finally { source.close(); store.close(); }
