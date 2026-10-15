export type FeedbackType = 'idea' | 'bug' | 'balance' | 'other';

export interface FeedbackDraft {
  type: FeedbackType;
  message: string;
  context: string | null;
}

export type FeedbackOutcome = { status: 'opened'; truncated: boolean } | { status: 'failed' };

export interface FeedbackTransport {
  send(draft: FeedbackDraft): Promise<FeedbackOutcome>;
}
