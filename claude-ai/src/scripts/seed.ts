#!/usr/bin/env bun

/**
 * Seed script for testing admin notes AI POC
 * Generates sample data for development and testing
 */

import { db } from '../db/index.js';
import { adminNotes } from '../db/schema.js';
import { v4 as uuidv4 } from 'uuid';

// Sample student and author IDs
const STUDENT_IDS = [
  '123e4567-e89b-12d3-a456-426614174000',
  '223e4567-e89b-12d3-a456-426614174001',
  '323e4567-e89b-12d3-a456-426614174002'
];

const AUTHOR_IDS = [
  '456e7890-e89b-12d3-a456-426614174001', // Teacher 1
  '556e7890-e89b-12d3-a456-426614174002', // Teacher 2
  '656e7890-e89b-12d3-a456-426614174003'  // Counselor
];

// Sample admin notes content
const SAMPLE_NOTES = [
  "Student showed excellent participation in today's math lesson. Completed all practice problems correctly and helped other students with challenging concepts.",
  "Noticed student seems tired and distracted during morning classes. Might be worth checking in about sleep schedule and home situation.",
  "Great improvement in writing assignments this week. Student is using more descriptive language and organizing thoughts more clearly.",
  "Student had a minor conflict with a classmate during group work. We discussed conflict resolution strategies and both students apologized.",
  "Exceptional performance on the science project presentation. Student demonstrated strong research skills and clear communication.",
  "Student forgot homework for the third time this week. Need to discuss organizational strategies with parents during upcoming conference.",
  "Observed student being very helpful to new classmate during lunch. Shows strong empathy and leadership qualities.",
  "Student struggled with today's reading comprehension exercise. May benefit from additional support or modified assignments.",
  "Fantastic creative thinking displayed in art class today. Student's unique approach to the project inspired other students.",
  "Student reported feeling anxious about upcoming state tests. Provided reassurance and test-taking strategies. Will monitor closely.",
  "Marked improvement in time management. Student completed all activities within allotted time and even helped clean up early.",
  "Student demonstrated excellent problem-solving skills during the engineering challenge. Worked well collaboratively with team.",
  "Notice student has been more withdrawn lately. Made effort to check in privately - student mentioned some family stress at home.",
  "Outstanding effort on the history research project. Student went above and beyond the requirements and showed genuine interest.",
  "Student had difficulty focusing during math lesson. Used fidget tools and movement breaks which seemed to help significantly."
];

async function seedData() {
  console.log('🌱 Starting to seed sample admin notes...');

  try {
    // Clear existing data
    await db.delete(adminNotes);
    console.log('🧹 Cleared existing admin notes');

    const notesToInsert = [];

    // Generate notes for each student
    for (const studentId of STUDENT_IDS) {
      // Each student gets 8-12 notes over the past few weeks
      const numNotes = Math.floor(Math.random() * 5) + 8;

      for (let i = 0; i < numNotes; i++) {
        // Create notes spread over the last 30 days
        const daysAgo = Math.floor(Math.random() * 30);
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - daysAgo);

        notesToInsert.push({
          id: uuidv4(),
          studentId,
          content: SAMPLE_NOTES[Math.floor(Math.random() * SAMPLE_NOTES.length)],
          authorId: AUTHOR_IDS[Math.floor(Math.random() * AUTHOR_IDS.length)],
          createdAt,
          updatedAt: createdAt
        });
      }
    }

    // Insert all notes (this will trigger AI processing via database triggers)
    await db.insert(adminNotes).values(notesToInsert);

    console.log(`✅ Successfully inserted ${notesToInsert.length} admin notes`);
    console.log(`📊 Distribution:`);

    for (const studentId of STUDENT_IDS) {
      const count = notesToInsert.filter(note => note.studentId === studentId).length;
      console.log(`   Student ${studentId}: ${count} notes`);
    }

    console.log('\n🤖 AI processing will start automatically via PostgreSQL triggers');
    console.log('📝 Check the application logs to see AI summaries being generated');

    console.log('\n🔍 Test the API:');
    console.log(`   curl http://localhost:3000/api/students/${STUDENT_IDS[0]}/notes`);
    console.log(`   curl http://localhost:3000/api/students/${STUDENT_IDS[0]}/summaries`);

  } catch (error) {
    console.error('❌ Failed to seed data:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the seed function
seedData();