export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TraceStep {
  step: number;
  llm_input: string;
  llm_output: string;
  tool_called: string | null;
  tool_result: unknown;
  latency_ms: number;
}

export interface RunOptions {
  failureModes: string[];
}

export interface RunResult {
  run_id: string;
  task: string;
  failure_modes: string[];
  steps: TraceStep[];
  current_status: string;
  running: boolean;
  final_answer: string;
  completed_at: string;
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}
