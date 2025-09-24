import { db, notificationClient } from '../db/index.js';
import { adminNotes, aiSummaries, type AdminNote } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { AdminNoteCreatedEvent } from '../types/events.js';
import { AiProvider, AiProviderType, AiRequest } from '../types/ai-provider.js';
import { AiProviderFactory } from './ai-providers/provider-factory.js';

export class AIService {
  private aiProvider: AiProvider;
  private readonly providerType: AiProviderType;
  private readonly model: string;

  constructor() {
    // Get AI provider configuration from environment
    this.providerType = (process.env.AI_PROVIDER as AiProviderType) || 'claude';
    this.model = process.env.AI_MODEL || AiProviderFactory.getDefaultModel(this.providerType);

    if (!this.isValidProvider(this.providerType)) {
      throw new Error(`Invalid AI provider: ${this.providerType}. Supported: ${AiProviderFactory.getSupportedProviders().join(', ')}`);
    }

    // Initialize provider asynchronously
    this.initializeProvider().catch(error => {
      console.error('Failed to initialize AI provider:', error);
      throw error;
    });
  }

  private isValidProvider(provider: string): provider is AiProviderType {
    return AiProviderFactory.getSupportedProviders().includes(provider as AiProviderType);
  }

  private async initializeProvider(): Promise<void> {
    const apiKey = this.getApiKeyForProvider();

    if (!apiKey) {
      throw new Error(`API key required for ${this.providerType} provider`);
    }

    try {
      this.aiProvider = await AiProviderFactory.createProvider(this.providerType, {
        apiKey,
        baseUrl: process.env.AI_BASE_URL,
        timeout: parseInt(process.env.AI_TIMEOUT || '30000'),
        maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3')
      });

      console.log(`✅ Initialized ${this.providerType} AI provider with model ${this.model}`);
    } catch (error) {
      console.error(`❌ Failed to initialize ${this.providerType} provider:`, error);
      throw error;
    }
  }

  private getApiKeyForProvider(): string {
    const keyMap: Record<AiProviderType, string> = {
      'claude': process.env.CLAUDE_API_KEY || '',
      'openai': process.env.OPENAI_API_KEY || '',
      'azure-openai': process.env.AZURE_OPENAI_API_KEY || '',
      'palm': process.env.PALM_API_KEY || '',
      'cohere': process.env.COHERE_API_KEY || ''
    };

    return keyMap[this.providerType];
  }

  async processAdminNoteCreated(event: AdminNoteCreatedEvent): Promise<void> {
    try {
      console.log(`🤖 Processing AI summary for student ${event.student_id}`);

      // Get last 10 notes for this student
      const recentNotes = await db
        .select()
        .from(adminNotes)
        .where(eq(adminNotes.studentId, event.student_id))
        .orderBy(desc(adminNotes.createdAt))
        .limit(10);

      if (recentNotes.length === 0) {
        console.log('⚠️  No notes found for student');
        return;
      }

      console.log(`📚 Found ${recentNotes.length} notes for analysis`);

      // Generate AI summary
      const summary = await this.generateSummary(recentNotes);

      // Store summary (will trigger summary_completed event)
      const [newSummary] = await db
        .insert(aiSummaries)
        .values({
          studentId: event.student_id,
          summary,
          noteCount: recentNotes.length,
          lastProcessedNoteId: event.id
        })
        .returning();

      console.log(`✅ AI summary completed for student ${event.student_id} (${newSummary.id})`);

    } catch (error) {
      console.error('❌ AI processing failed:', error);

      // Record failed job for retry
      const { RetryService } = await import('./retry-service.js');
      const retryService = new RetryService();

      await retryService.recordFailedJob(
        'admin_note_summary',
        event,
        error instanceof Error ? error : new Error('Unknown error'),
        3 // max retries
      );

      // Also notify immediate failure via pub/sub
      try {
        await notificationClient.unsafe(`
          SELECT pg_notify('summary_failed', '${JSON.stringify({
          student_id: event.student_id,
          note_id: event.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          created_at: new Date().toISOString(),
          event_type: 'summary_failed'
        })}')
        `);
      } catch (notifyError) {
        console.error('Failed to notify error:', notifyError);
      }
    }
  }

  private async generateSummary(notes: AdminNote[]): Promise<string> {
    const prompt = this.buildSummaryPrompt(notes);

    console.log(`🧠 Generating AI summary using ${this.providerType} (${this.model})...`);

    const settings = AiProviderFactory.getRecommendedSettings('summarization');

    const request: AiRequest = {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: settings.maxTokens,
      temperature: settings.temperature,
      systemPrompt: `Create a short summary of all notes provided in the input. Keep the summary brief, 
      with a maximum of three sentences. Highlight areas of excellence, and an area of improvement. Flag any concerns. `
    };

    try {
      const response = await this.aiProvider.generateCompletion(request);

      console.log(`📊 AI summary generated (${response.usage?.totalTokens || 'unknown'} tokens)`);

      return response.content;
    } catch (error) {
      console.error(`❌ AI generation failed with ${this.providerType}:`, error);
      throw error;
    }
  }

  private buildSummaryPrompt(notes: AdminNote[]): string {
    // Sort notes chronologically (oldest first)
    const sortedNotes = notes.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const dateRange = {
      start: new Date(sortedNotes[0].createdAt).toLocaleDateString(),
      end: new Date(sortedNotes[sortedNotes.length - 1].createdAt).toLocaleDateString()
    };

    return `Please analyze and summarize these ${notes.length} admin notes for a student (${dateRange.start} - ${dateRange.end}):

${sortedNotes.map((note, index) => `
--- Note ${index + 1} (${new Date(note.createdAt).toLocaleDateString()}) ---
${note.content}
`).join('\n')}

Be strict about a concise, 3 sentence max, summary. Any information an admin must know at a glance.`;
  }

  /**
   * Get AI provider information and health status
   */
  async getProviderStatus() {
    try {
      if (!this.aiProvider) {
        return {
          provider: this.providerType,
          model: this.model,
          status: 'not_initialized',
          healthy: false
        };
      }

      const healthy = await this.aiProvider.healthCheck();
      const info = this.aiProvider.getProviderInfo();

      return {
        provider: this.providerType,
        model: this.model,
        status: 'initialized',
        healthy,
        info
      };
    } catch (error) {
      return {
        provider: this.providerType,
        model: this.model,
        status: 'error',
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Switch to a different AI provider at runtime
   */
  async switchProvider(providerType: AiProviderType, apiKey: string, model?: string): Promise<void> {
    console.log(`🔄 Switching AI provider from ${this.providerType} to ${providerType}...`);

    try {
      const newProvider = await AiProviderFactory.createProvider(providerType, {
        apiKey,
        baseUrl: process.env.AI_BASE_URL,
        timeout: parseInt(process.env.AI_TIMEOUT || '30000'),
        maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3')
      });

      // Test the new provider
      const healthy = await newProvider.healthCheck();
      if (!healthy) {
        throw new Error('New provider failed health check');
      }

      // Switch to new provider
      this.aiProvider = newProvider;
      (this as any).providerType = providerType;
      (this as any).model = model || AiProviderFactory.getDefaultModel(providerType);

      console.log(`✅ Successfully switched to ${providerType} provider`);
    } catch (error) {
      console.error(`❌ Failed to switch to ${providerType} provider:`, error);
      throw error;
    }
  }
}