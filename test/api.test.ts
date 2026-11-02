import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configuration } from '../src/config.js';
import { openDatabase } from '../src/database.js';
import { migrate } from '../src/migrate.js';
import { createApp } from '../src/app.js';
import { ledger } from '../src/ledger.js';

const expense = { amount: 15075, title: 'Lunch', categoryId: 'food', subcategory: 'Lunch', date: '2026-11-02', payment: 'Cash', notes: 'Test record' };
async function fixture(production = false, databasePath = ':memory:') {
  const config = { ...configuration(), production, databaseDriver: 'sqlite', databasePath, ownerId: 'test-owner', ownerName: 'Test', password: 'a-test-password-long-enough', sessionSecret: 'a-test-session-secret-that-is-long-enough', webOrigin: 'http://localhost:5173' };
  const store = openDatabase(config); await migrate(store);
  const server = createApp(config, store).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing address');
  const base = `http://127.0.0.1:${address.port}`;
  async function request(path: string, method = 'GET', body?: unknown, headers: Record<string,string> = {}) {
    const response = await fetch(base + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  async function close() { await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }); store.close(); }
  return { config, store, request, close };
}

test('Express CRUD preserves money, metadata, and validates category references', async () => {
  const f = await fixture();
  try {
    const initial = await f.request('/api/ledger');
    assert.equal(initial.body.expenses.length, 0); assert.equal(initial.body.profile.categories.length, 17);
    assert.equal((await f.request('/api/ledger','POST',{...expense,amount:0})).status,400);
    assert.equal((await f.request('/api/ledger','POST',{...expense,date:'2026-02-30'})).status,400);
    assert.equal((await f.request('/api/ledger','POST',{...expense,subcategory:'Not a subcategory'})).status,400);
    const created = await f.request('/api/ledger','POST',expense);
    assert.equal(created.status,201); assert.equal(created.body.expense.amount,15075);
    const id = created.body.expense.id;
    const updated = await f.request('/api/ledger','PUT',{...expense,id,amount:20099,subcategory:'Dinner'});
    assert.equal(updated.status,200); assert.equal(updated.body.expense.amount,20099); assert.equal(updated.body.expense.subcategory,'Dinner');
    const protectedCategory = await f.request('/api/ledger','PATCH',{categories:initial.body.profile.categories.filter((c:{id:string})=>c.id!=='food')});
    assert.equal(protectedCategory.status,400);
    const custom = { id:'custom-sports',name:'Sports',icon:'heart',color:'#123456',subcategories:['Equipment','Classes'] };
    const patched = await f.request('/api/ledger','PATCH',{categories:[...initial.body.profile.categories,custom],budget:3000000,currency:'USD'});
    assert.equal(patched.status,200); assert.equal(patched.body.profile.budget,3000000); assert.equal(patched.body.profile.categories.length,18);
    assert.equal((await f.request('/api/ledger','DELETE',{id})).status,200);
    assert.equal((await f.request('/api/ledger','DELETE',{id})).status,404);
    assert.equal((await f.request('/api/ledger')).body.expenses.length,0);
  } finally { await f.close(); }
});

test('records belonging to another user cannot be read, edited, or deleted', async () => {
  const f = await fixture();
  try {
    const foreign = await ledger(f.store).create('another-owner',expense);
    assert.equal((await f.request('/api/ledger')).body.expenses.length,0);
    assert.equal((await f.request('/api/ledger','PUT',{...expense,id:foreign.expense.id})).status,404);
    assert.equal((await f.request('/api/ledger','DELETE',{id:foreign.expense.id})).status,404);
    assert.equal((await ledger(f.store).list('another-owner')).expenses.length,1);
  } finally { await f.close(); }
});

test('production requires a valid signed session and rejects forged identity headers and foreign origins', async () => {
  const f = await fixture(true);
  try {
    assert.equal((await f.request('/api/ledger')).status,401);
    assert.equal((await f.request('/api/ledger','GET',undefined,{'oai-authenticated-user-id':'test-owner'})).status,401);
    assert.equal((await f.request('/api/auth/login','POST',{password:'wrong'})).status,401);
    const login = await f.request('/api/auth/login','POST',{password:f.config.password});
    assert.equal(login.status,200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    assert.match(login.headers.get('set-cookie')!,/HttpOnly/); assert.match(login.headers.get('set-cookie')!,/Secure/);
    assert.equal((await f.request('/api/ledger','GET',undefined,{Cookie:cookie})).status,200);
    assert.equal((await f.request('/api/ledger','POST',expense,{Cookie:cookie,Origin:'https://other.example'})).status,403);
    assert.equal((await f.request('/api/ledger','GET',undefined,{Cookie:cookie+'tampered'})).status,401);
  } finally { await f.close(); }
});

test('SQLite records survive a service restart and migrations can run again', async () => {
  const directory = mkdtempSync(join(tmpdir(),'penny-api-test-'));
  const path = join(directory,'expenses.sqlite');
  try {
    const first = await fixture(false,path);
    let savedId: string;
    try { const created = await first.request('/api/ledger','POST',expense); savedId = created.body.expense.id; }
    finally { await first.close(); }
    const second = await fixture(false,path);
    try { const loaded = await second.request('/api/ledger'); assert.equal(loaded.body.expenses[0].id,savedId!); assert.equal(loaded.body.expenses[0].amount,15075); }
    finally { await second.close(); }
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
