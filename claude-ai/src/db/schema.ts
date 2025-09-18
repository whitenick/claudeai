import { pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core';

export const adminNotes = pgTable('admin_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull(),
  content: text('content').notNull(), // Rich text stored as HTML/Markdown
  authorId: uuid('author_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const aiSummaries = pgTable('ai_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull(),
  summary: text('summary').notNull(),
  noteCount: integer('note_count').notNull(),
  lastProcessedNoteId: uuid('last_processed_note_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Type inference for TypeScript
export type AdminNote = typeof adminNotes.$inferSelect;
export type NewAdminNote = typeof adminNotes.$inferInsert;
export type AiSummary = typeof aiSummaries.$inferSelect;
export type NewAiSummary = typeof aiSummaries.$inferInsert;