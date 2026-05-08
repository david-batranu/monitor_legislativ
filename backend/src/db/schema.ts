import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const laws = pgTable('laws', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  registrationNumber: varchar('registration_number', { length: 255 }).notNull().unique(),
  currentStatus: varchar('current_status', { length: 255 }).notNull(),
  chamber: varchar('chamber', { length: 50 }).notNull(), // 'Senat' or 'CDEP'
  originalUrl: text('original_url'),
});

export const statusHistory = pgTable('status_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  lawId: uuid('law_id').notNull().references(() => laws.id, { onDelete: 'cascade' }),
  statusLabel: varchar('status_label', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }), // e.g., 'Comisia Juridică', 'Plen'
  timestamp: timestamp('timestamp').notNull(),
});

export const members = pgTable('members', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  party: varchar('party', { length: 100 }),
  chamber: varchar('chamber', { length: 50 }).notNull(),
  photoUrl: text('photo_url'),
});

export const votes = pgTable('votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  lawId: uuid('law_id').notNull().references(() => laws.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  voteValue: varchar('vote_value', { length: 50 }).notNull(), // 'Yes', 'No', 'Abstain', 'Absent'
  voteDate: timestamp('vote_date').notNull(),
});

export const lawsRelations = relations(laws, ({ many }) => ({
  statusHistory: many(statusHistory),
  votes: many(votes),
}));

export const membersRelations = relations(members, ({ many }) => ({
  votes: many(votes),
}));

export const statusHistoryRelations = relations(statusHistory, ({ one }) => ({
  law: one(laws, {
    fields: [statusHistory.lawId],
    references: [laws.id],
  }),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  law: one(laws, {
    fields: [votes.lawId],
    references: [laws.id],
  }),
  member: one(members, {
    fields: [votes.memberId],
    references: [members.id],
  }),
}));
