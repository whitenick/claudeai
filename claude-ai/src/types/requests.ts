import { z } from 'zod';

export const createAdminNoteSchema = z.object({
  studentId: z.string().uuid('Student ID must be a valid UUID'),
  content: z.string().min(1, 'Content cannot be empty').max(10000, 'Content too long'),
  authorId: z.string().uuid('Author ID must be a valid UUID')
});

export type CreateAdminNoteRequest = z.infer<typeof createAdminNoteSchema>;

export const getStudentSummariesSchema = z.object({
  studentId: z.string().uuid('Student ID must be a valid UUID')
});

export type GetStudentSummariesRequest = z.infer<typeof getStudentSummariesSchema>;