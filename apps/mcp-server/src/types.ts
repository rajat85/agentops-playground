export type FailureType = 'retrieval_noise' | 'context_truncation' | 'agent_loop';

export interface ToolResult {
  [key: string]: unknown;
}
