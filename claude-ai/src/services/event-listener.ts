import { notificationClient } from '../db/index.js';
import { AIService } from './ai-service.js';
import { AdminNoteCreatedEvent, SummaryCompletedEvent, SummaryFailedEvent } from '../types/events.js';

export class EventListener {
  private aiService = new AIService();
  private isListening = false;

  async startListening(): Promise<void> {
    if (this.isListening) {
      console.log('⚠️  Event listener already running');
      return;
    }

    console.log('🎧 Starting PostgreSQL event listener...');

    try {
      // Listen to admin notes creation events
      await notificationClient.listen('admin_notes_created', async (payload) => {
        try {
          const event: AdminNoteCreatedEvent = JSON.parse(payload);
          console.log(`📝 Received admin_notes_created: ${event.id} for student ${event.student_id}`);
          await this.aiService.processAdminNoteCreated(event);
        } catch (error) {
          console.error('❌ Failed to process admin_notes_created event:', error);
        }
      });

      // Listen to summary completion events (for logging/monitoring)
      await notificationClient.listen('summary_completed', (payload) => {
        try {
          const event: SummaryCompletedEvent = JSON.parse(payload);
          console.log(`✅ Summary completed: ${event.id} for student ${event.student_id} (${event.note_count} notes)`);
        } catch (error) {
          console.error('Failed to parse summary_completed event:', error);
        }
      });

      // Listen to summary failure events
      await notificationClient.listen('summary_failed', (payload) => {
        try {
          const event: SummaryFailedEvent = JSON.parse(payload);
          console.error(`❌ Summary failed for student ${event.student_id}: ${event.error}`);
        } catch (error) {
          console.error('Failed to parse summary_failed event:', error);
        }
      });

      this.isListening = true;
      console.log('✅ PostgreSQL event listener started successfully');

    } catch (error) {
      console.error('❌ Failed to start event listener:', error);
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    console.log('🛑 Stopping PostgreSQL event listener...');

    try {
      await notificationClient.unlisten('admin_notes_created');
      await notificationClient.unlisten('summary_completed');
      await notificationClient.unlisten('summary_failed');

      this.isListening = false;
      console.log('✅ PostgreSQL event listener stopped');

    } catch (error) {
      console.error('❌ Error stopping event listener:', error);
      throw error;
    }
  }

  isRunning(): boolean {
    return this.isListening;
  }
}