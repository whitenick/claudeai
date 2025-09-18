import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { db } from '../db/index.js';
import { adminNotes, aiSummaries } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { createAdminNoteSchema, getStudentSummariesSchema } from '../types/requests.js';

export async function adminNotesRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {

  // Create a new admin note
  fastify.post('/admin-notes', async (request, reply) => {
    try {
      // Validate request body
      const data = createAdminNoteSchema.parse(request.body);

      // Insert note into database (trigger will handle AI processing)
      const [newNote] = await db
        .insert(adminNotes)
        .values({
          studentId: data.studentId,
          content: data.content,
          authorId: data.authorId
        })
        .returning();

      return {
        success: true,
        note: newNote,
        message: 'Admin note created successfully. AI summary will be processed automatically.'
      };

    } catch (error) {
      fastify.log.error('Failed to create admin note:', error);

      if (error instanceof Error && error.name === 'ZodError') {
        reply.code(400);
        return {
          success: false,
          error: 'Validation error',
          details: error.message
        };
      }

      reply.code(500);
      return {
        success: false,
        error: 'Failed to create admin note'
      };
    }
  });

  // Get all admin notes for a student
  fastify.get('/students/:studentId/notes', async (request, reply) => {
    try {
      const { studentId } = getStudentSummariesSchema.parse(request.params);

      const notes = await db
        .select()
        .from(adminNotes)
        .where(eq(adminNotes.studentId, studentId))
        .orderBy(desc(adminNotes.createdAt))
        .limit(50); // Limit to last 50 notes

      return {
        success: true,
        notes,
        count: notes.length
      };

    } catch (error) {
      fastify.log.error('Failed to fetch student notes:', error);

      if (error instanceof Error && error.name === 'ZodError') {
        reply.code(400);
        return {
          success: false,
          error: 'Invalid student ID'
        };
      }

      reply.code(500);
      return {
        success: false,
        error: 'Failed to fetch student notes'
      };
    }
  });

  // Get AI summaries for a student
  fastify.get('/students/:studentId/summaries', async (request, reply) => {
    try {
      const { studentId } = getStudentSummariesSchema.parse(request.params);

      const summaries = await db
        .select()
        .from(aiSummaries)
        .where(eq(aiSummaries.studentId, studentId))
        .orderBy(desc(aiSummaries.createdAt))
        .limit(10); // Last 10 summaries

      return {
        success: true,
        summaries,
        count: summaries.length
      };

    } catch (error) {
      fastify.log.error('Failed to fetch student summaries:', error);

      if (error instanceof Error && error.name === 'ZodError') {
        reply.code(400);
        return {
          success: false,
          error: 'Invalid student ID'
        };
      }

      reply.code(500);
      return {
        success: false,
        error: 'Failed to fetch student summaries'
      };
    }
  });

  // Get latest AI summary for a student
  fastify.get('/students/:studentId/summary/latest', async (request, reply) => {
    try {
      const { studentId } = getStudentSummariesSchema.parse(request.params);

      const [latestSummary] = await db
        .select()
        .from(aiSummaries)
        .where(eq(aiSummaries.studentId, studentId))
        .orderBy(desc(aiSummaries.createdAt))
        .limit(1);

      if (!latestSummary) {
        reply.code(404);
        return {
          success: false,
          error: 'No AI summary found for this student'
        };
      }

      return {
        success: true,
        summary: latestSummary
      };

    } catch (error) {
      fastify.log.error('Failed to fetch latest summary:', error);

      if (error instanceof Error && error.name === 'ZodError') {
        reply.code(400);
        return {
          success: false,
          error: 'Invalid student ID'
        };
      }

      reply.code(500);
      return {
        success: false,
        error: 'Failed to fetch latest summary'
      };
    }
  });
}