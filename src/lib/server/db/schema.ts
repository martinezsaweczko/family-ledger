import {
	bigint,
	char,
	date,
	index,
	int,
	json,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
	boolean
} from 'drizzle-orm/mysql-core';

export const accounts = mysqlTable(
	'accounts',
	{
		id: int('id').autoincrement().primaryKey(),
		iban: varchar('iban', { length: 34 }).notNull(),
		name: varchar('name', { length: 120 }).notNull(),
		currency: char('currency', { length: 3 }).notNull().default('EUR'),
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(t) => [uniqueIndex('accounts_iban_uq').on(t.iban)]
);

export const people = mysqlTable(
	'people',
	{
		id: int('id').autoincrement().primaryKey(),
		name: varchar('name', { length: 80 }).notNull()
	},
	(t) => [uniqueIndex('people_name_uq').on(t.name)]
);

export const categories = mysqlTable(
	'categories',
	{
		id: int('id').autoincrement().primaryKey(),
		slug: varchar('slug', { length: 60 }).notNull(),
		name: varchar('name', { length: 80 }).notNull(),
		color: varchar('color', { length: 9 }).notNull(),
		/** Key into the icon registry (src/lib/icons); NULL = use the slug default / fallback. */
		icon: varchar('icon', { length: 40 }),
		kind: mysqlEnum('kind', ['expense', 'income', 'transfer', 'ignore']).notNull(),
		sortOrder: int('sort_order').notNull().default(0),
		isActive: boolean('is_active').notNull().default(true)
	},
	(t) => [uniqueIndex('categories_slug_uq').on(t.slug)]
);

export const categoryRules = mysqlTable(
	'category_rules',
	{
		id: int('id').autoincrement().primaryKey(),
		pattern: varchar('pattern', { length: 255 }).notNull(),
		matchType: mysqlEnum('match_type', ['contains', 'regex']).notNull().default('contains'),
		categoryId: int('category_id')
			.notNull()
			.references(() => categories.id),
		personId: int('person_id').references(() => people.id),
		priority: int('priority').notNull().default(100),
		direction: mysqlEnum('direction', ['any', 'in', 'out']).notNull().default('any'),
		isActive: boolean('is_active').notNull().default(true)
	},
	(t) => [
		uniqueIndex('category_rules_pattern_uq').on(t.pattern, t.matchType),
		index('category_rules_category_idx').on(t.categoryId)
	]
);

/**
 * Recurring manual entries (e.g. the weekly cleaner paid in cash). `materialiseRecurring`
 * turns them into rows of `statements` (importer_id = 'manual') up to today.
 */
export const recurringEntries = mysqlTable(
	'recurring_entries',
	{
		id: int('id').autoincrement().primaryKey(),
		concept: varchar('concept', { length: 255 }).notNull(),
		/** Always positive; `direction` says whether it is spending or income. */
		amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
		direction: mysqlEnum('direction', ['in', 'out']).notNull().default('out'),
		categoryId: int('category_id').references(() => categories.id),
		frequency: mysqlEnum('frequency', ['weekly', 'biweekly', 'monthly']).notNull(),
		/** weekly/biweekly: ISO weekday 1 (Mon) to 7 (Sun); monthly: day of month 1 to 31 (clamped to month end). */
		anchor: int('anchor').notNull(),
		startDate: date('start_date', { mode: 'string' }).notNull(),
		endDate: date('end_date', { mode: 'string' }),
		isActive: boolean('is_active').notNull().default(true),
		affectsBalance: boolean('affects_balance').notNull().default(false),
		note: text('note'),
		/** Last day already materialised: later runs only generate dates after it, so deleted occurrences stay deleted. */
		lastGenerated: date('last_generated', { mode: 'string' }),
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(t) => [index('recurring_entries_active_idx').on(t.isActive)]
);

export const importBatches = mysqlTable(
	'import_batches',
	{
		id: int('id').autoincrement().primaryKey(),
		importerId: varchar('importer_id', { length: 60 }).notNull(),
		filename: varchar('filename', { length: 255 }).notNull(),
		fileSha256: char('file_sha256', { length: 64 }).notNull(),
		accountId: int('account_id')
			.notNull()
			.references(() => accounts.id),
		rowsTotal: int('rows_total').notNull().default(0),
		rowsInserted: int('rows_inserted').notNull().default(0),
		rowsUpdated: int('rows_updated').notNull().default(0),
		rowsUnchanged: int('rows_unchanged').notNull().default(0),
		importedAt: timestamp('imported_at').notNull().defaultNow()
	},
	(t) => [index('import_batches_account_idx').on(t.accountId)]
);

export const statements = mysqlTable(
	'statements',
	{
		id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
		accountId: int('account_id')
			.notNull()
			.references(() => accounts.id),
		importerId: varchar('importer_id', { length: 60 }).notNull(),
		dedupHash: char('dedup_hash', { length: 64 }).notNull(),
		bookingDate: date('booking_date', { mode: 'string' }).notNull(),
		valueDate: date('value_date', { mode: 'string' }).notNull(),
		concept: text('concept').notNull(),
		amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
		balanceCents: bigint('balance_cents', { mode: 'number' }),
		rawJson: json('raw_json').notNull(),
		batchId: int('batch_id')
			.notNull()
			.references(() => importBatches.id),
		categoryId: int('category_id').references(() => categories.id),
		categorySource: mysqlEnum('category_source', ['rule', 'manual']),
		personId: int('person_id').references(() => people.id),
		/** Free-text note, used by manual entries. */
		note: text('note'),
		/** Manual entries only: also adjusts the displayed bank balance (see analytics/summary latestBalance). */
		affectsBalance: boolean('affects_balance').notNull().default(false),
		/** Set on rows generated from a recurring entry. */
		recurringId: int('recurring_id').references(() => recurringEntries.id, {
			onDelete: 'set null'
		}),
		firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
		lastSeenAt: timestamp('last_seen_at').notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('statements_dedup_uq').on(t.dedupHash),
		index('statements_booking_date_idx').on(t.bookingDate),
		index('statements_category_idx').on(t.categoryId),
		index('statements_account_idx').on(t.accountId),
		index('statements_batch_idx').on(t.batchId),
		index('statements_recurring_idx').on(t.recurringId)
	]
);

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type CategoryRule = typeof categoryRules.$inferSelect;
export type RecurringEntry = typeof recurringEntries.$inferSelect;
export type Statement = typeof statements.$inferSelect;
