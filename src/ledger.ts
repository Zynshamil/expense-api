import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { defaultCategories, currencies, payments, type Category, type Profile } from '@penny/shared';
import { expenses, profiles } from './schema.js';
import type { Store } from './database.js';
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const invalid = (message: string): never => { throw new HttpError(400, message); };
export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Send a JSON object.');
  return value as Record<string, unknown>;
}
const string = (value: unknown) => typeof value === 'string' ? value.trim() : '';
function expenseData(value: unknown, categories: Category[]) {
  const body = objectBody(value);
  const amount = body.amount, title = string(body.title), date = string(body.date), payment = string(body.payment), notes = string(body.notes);
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0 || amount > 99999999999) invalid('Enter a valid amount greater than zero.');
  if (!title || title.length > 120) invalid('Enter a description of up to 120 characters.');
  const category = categories.find(category => category.id === body.categoryId);
  if (!category || !category.subcategories.includes(string(body.subcategory))) invalid('Choose a valid category and subcategory.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || date < '1900-01-01' || date > '2100-12-31') invalid('Choose a valid date.');
  if (!payments.includes(payment)) invalid('Choose a payment method.');
  if (notes.length > 1000) invalid('Notes must be 1,000 characters or fewer.');
  return { amount: amount as number, title, categoryId: category!.id, subcategory: string(body.subcategory), date, payment, notes };
}
function validateCategories(value: unknown): Category[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) invalid('Keep between 1 and 100 categories.');
  const ids = new Set<string>(), names = new Set<string>();
  const categories = (value as unknown[]).map(item => {
    const c = objectBody(item);
    const id = string(c.id), name = string(c.name), icon = string(c.icon), color = string(c.color);
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id) || !name || name.length > 60 || names.has(name.toLowerCase()) || !icon || icon.length > 30 || !/^#[0-9a-f]{6}$/i.test(color) || !Array.isArray(c.subcategories) || c.subcategories.length < 1 || c.subcategories.length > 50) invalid('Use unique category names and 1–50 unique subcategories for each.');
    const subcategories = (c.subcategories as unknown[]).map(value => string(value));
    if (subcategories.some(value => !value || value.length > 60) || new Set(subcategories.map(value => value.toLowerCase())).size !== subcategories.length) invalid('Subcategories must have unique names of up to 60 characters.');
    ids.add(id); names.add(name.toLowerCase());
    return { id, name, icon, color, subcategories };
  });
  return categories;
}
export function ledger(store: Store) {
  const db = store.db;
  async function profile(uid: string): Promise<Profile> {
    const row = await db.select().from(profiles).where(eq(profiles.userId, uid)).get();
    return row ? { currency: row.currency, budget: row.budget, categories: JSON.parse(row.categories) as Category[] } : { currency: 'INR', budget: 0, categories: structuredClone(defaultCategories) };
  }
  async function list(uid: string) {
    const [preferences, rows] = await Promise.all([profile(uid), db.select().from(expenses).where(eq(expenses.userId, uid)).orderBy(desc(expenses.date), desc(expenses.createdAt))]);
    return { profile: preferences, expenses: rows.map(({ userId, ...expense }) => expense) };
  }
  async function create(uid: string, body: unknown) {
    const preferences = await profile(uid);
    const expense = { id: randomUUID(), ...expenseData(body, preferences.categories), createdAt: new Date().toISOString() };
    await db.insert(expenses).values({ ...expense, userId: uid });
    return { expense };
  }
  async function update(uid: string, value: unknown) {
    const body = objectBody(value), id = string(body.id);
    if (!id) invalid('An expense ID is required.');
    const preferences = await profile(uid);
    const row = await db.update(expenses).set(expenseData(body, preferences.categories)).where(and(eq(expenses.userId, uid), eq(expenses.id, id))).returning().get();
    if (!row) throw new HttpError(404, 'Expense not found.');
    const { userId, ...expense } = row;
    return { expense };
  }
  async function remove(uid: string, value: unknown) {
    const id = string(objectBody(value).id);
    if (!id) invalid('An expense ID is required.');
    const row = await db.delete(expenses).where(and(eq(expenses.userId, uid), eq(expenses.id, id))).returning({ id: expenses.id }).get();
    if (!row) throw new HttpError(404, 'Expense not found.');
    return { ok: true };
  }
  async function updateProfile(uid: string, value: unknown) {
    const body = objectBody(value), current = await profile(uid);
    const currency = body.currency ?? current.currency, budget = body.budget ?? current.budget;
    if (typeof currency !== 'string' || !currencies.includes(currency) || typeof budget !== 'number' || !Number.isSafeInteger(budget) || budget < 0 || budget > 99999999999) invalid('Check your currency and monthly budget.');
    const categories = body.categories === undefined ? current.categories : validateCategories(body.categories);
    const used = await db.select({ categoryId: expenses.categoryId, subcategory: expenses.subcategory }).from(expenses).where(eq(expenses.userId, uid));
    for (const row of used) if (!categories.some(category => category.id === row.categoryId && category.subcategories.includes(row.subcategory))) invalid('A category or subcategory is used by an expense. Reassign those expenses before removing it.');
    const values = { userId: uid, currency: currency as string, budget: budget as number, categories: JSON.stringify(categories) };
    await db.insert(profiles).values(values).onConflictDoUpdate({ target: profiles.userId, set: { currency: values.currency, budget: values.budget, categories: values.categories } });
    return { profile: { currency, budget, categories } };
  }
  return { list, create, update, remove, updateProfile };
}
