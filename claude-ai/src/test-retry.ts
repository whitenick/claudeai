#!/usr/bin/env bun
/**
 * Test script for verifying the retry mechanism
 * Run with: bun run src/test-retry.ts
 */

import { db, notificationClient } from './db/index.js';
import { RetryService } from './services/retry-service.js';
import { AdminNoteCreatedEvent } from './types/events.js';

async function testRetryMechanism() {
  console.log('🧪 Testing retry mechanism...');

  const retryService = new RetryService();

  // Test data that will cause AI service to fail (invalid student_id)
  const invalidEvent: AdminNoteCreatedEvent = {
    id: 'test-invalid-id',
    student_id: 'invalid-uuid-that-will-fail',
    content: 'This is a test note that should fail processing',
    created_at: new Date().toISOString(),
    event_type: 'admin_note_created'
  };

  try {
    console.log('📝 Recording a failed job for testing...');

    // Simulate a failure
    const testError = new Error('Test failure - invalid student ID format');

    await retryService.recordFailedJob(
      'admin_note_summary',
      invalidEvent,
      testError,
      2 // Only 2 retries for testing
    );

    console.log('✅ Failed job recorded successfully');

    // Get stats
    const stats = await retryService.getFailedJobsStats();
    console.log('📊 Failed jobs stats:', stats);

    // Start retry processor for a short test
    console.log('🔄 Starting retry processor for 10 seconds...');
    retryService.startRetryProcessor(5000); // Check every 5 seconds

    // Let it run for a bit
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Stop processor
    retryService.stopRetryProcessor();
    console.log('🛑 Stopped retry processor');

    // Check final stats
    const finalStats = await retryService.getFailedJobsStats();
    console.log('📊 Final stats:', finalStats);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup: remove test jobs
    console.log('🧹 Cleaning up test data...');
    await db.raw(`DELETE FROM failed_jobs WHERE payload->>'student_id' = ?`, ['invalid-uuid-that-will-fail']);
    console.log('✅ Test cleanup complete');

    await notificationClient.end();
    await db.destroy();
  }
}

// Run the test
testRetryMechanism().catch(console.error);