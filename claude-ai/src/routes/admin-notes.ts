import { Hono } from 'hono';
import { db } from '../db/index.js';
import { adminNotes, aiSummaries } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { createAdminNoteSchema, getStudentSummariesSchema } from '../types/requests.js';
import { HTTPException } from 'hono/http-exception';

export function adminNotesRoutes(app: Hono) {
  const routes = new Hono();

  // Create a new admin note
  routes.post('/admin-notes', async (c) => {
    try {
      // Validate request body
      const body = await c.req.json();
      const data = createAdminNoteSchema.parse(body);

      // Insert note into database (trigger will handle AI processing)
      const [newNote] = await db
        .insert(adminNotes)
        .values({
          studentId: data.studentId,
          content: data.content,
          authorId: data.authorId
        })
        .returning();

      return c.json({
        success: true,
        note: newNote,
        message: 'Admin note created successfully. AI summary will be processed automatically.'
      });

    } catch (error) {
      console.error('Failed to create admin note:', error);

      if (error instanceof Error && error.name === 'ZodError') {
        throw new HTTPException(400, {
          message: 'Validation error',
        });
      }

      throw new HTTPException(500, {
        message: 'Failed to create admin note'
      });
    }
  });

  // Get all admin notes for a student
  routes.get('/students/:studentId/notes', async (c) => {
    try {
      const studentId = c.req.param('studentId');
      const validatedParams = getStudentSummariesSchema.parse({ studentId });

      const notes = await db
        .select()
        .from(adminNotes)
        .where(eq(adminNotes.studentId, validatedParams.studentId))
        .orderBy(desc(adminNotes.createdAt))
        .limit(50); // Limit to last 50 notes

      return c.json({
        success: true,
        notes,
        count: notes.length
      });

    } catch (error) {
      console.error('Failed to fetch student notes:', error);

      if (error instanceof Error && error.name === 'ZodError') {
        throw new HTTPException(400, {
          message: 'Invalid student ID'
        });
      }

      throw new HTTPException(500, {
        message: 'Failed to fetch student notes'
      });
    }
  });

  // Get AI summaries for a student
  routes.get('/students/:studentId/summaries', async (c) => {
    try {
      const studentId = c.req.param('studentId');
      const validatedParams = getStudentSummariesSchema.parse({ studentId });

      const summaries = await db
        .select()
        .from(aiSummaries)
        .where(eq(aiSummaries.studentId, validatedParams.studentId))
        .orderBy(desc(aiSummaries.createdAt))
        .limit(10); // Last 10 summaries

      return c.json({
        success: true,
        summaries,
        count: summaries.length
      });

    } catch (error) {
      console.error('Failed to fetch student summaries:', error);

      if (error instanceof Error && error.name === 'ZodError') {
        throw new HTTPException(400, {
          message: 'Invalid student ID'
        });
      }

      throw new HTTPException(500, {
        message: 'Failed to fetch student summaries'
      });
    }
  });

  // Get latest AI summary for a student
  routes.get('/students/:studentId/summary/latest', async (c) => {
    try {
      const studentId = c.req.param('studentId');
      const validatedParams = getStudentSummariesSchema.parse({ studentId });

      const [latestSummary] = await db
        .select()
        .from(aiSummaries)
        .where(eq(aiSummaries.studentId, validatedParams.studentId))
        .orderBy(desc(aiSummaries.createdAt))
        .limit(1);

      if (!latestSummary) {
        throw new HTTPException(404, {
          message: 'No AI summary found for this student'
        });
      }

      return c.json({
        success: true,
        summary: latestSummary
      });

    } catch (error) {
      console.error('Failed to fetch latest summary:', error);

      if (error instanceof Error && error.name === 'ZodError') {
        throw new HTTPException(400, {
          message: 'Invalid student ID'
        });
      }

      if (error instanceof HTTPException) {
        throw error;
      }

      throw new HTTPException(500, {
        message: 'Failed to fetch latest summary'
      });
    }
  });

  return routes;
}