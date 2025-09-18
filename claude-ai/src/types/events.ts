export interface AdminNoteCreatedEvent {
  id: string;
  student_id: string;
  author_id: string;
  created_at: string;
  event_type: 'admin_note_created';
}

export interface SummaryCompletedEvent {
  id: string;
  student_id: string;
  note_count: number;
  created_at: string;
  event_type: 'summary_completed';
}

export interface SummaryFailedEvent {
  student_id: string;
  note_id: string;
  error: string;
  created_at: string;
  event_type: 'summary_failed';
}

export type PostgresEvent = AdminNoteCreatedEvent | SummaryCompletedEvent | SummaryFailedEvent;