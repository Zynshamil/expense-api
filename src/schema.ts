import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const profiles = sqliteTable('profiles', {
  userId: text('user_id').primaryKey(), currency: text('currency').notNull().default('INR'),
  budget: integer('budget').notNull().default(0), categories: text('categories').notNull(),
});
export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), amount: integer('amount').notNull(),
  title: text('title').notNull(), categoryId: text('category_id').notNull(), subcategory: text('subcategory').notNull(),
  date: text('date').notNull(), payment: text('payment').notNull(), notes: text('notes').notNull().default(''), createdAt: text('created_at').notNull(),
}, (table) => [index('expense_user_date_idx').on(table.userId, table.date)]);
