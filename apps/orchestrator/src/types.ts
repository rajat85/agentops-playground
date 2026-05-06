export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OllamaToolCall[];
}

export interface OllamaResponse {
  content: string;
  tool_calls: OllamaToolCall[];
  sentMessages: OllamaMessage[];
}

export interface TraceStep {
  step: number;
  kind?: 'mcp_init' | 'agent' | 'mcp_call';
  llm_input: string;
  llm_output: string;
  tool_called: string | null;
  tool_result: unknown;
  latency_ms: number;
  annotations?: string[];
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
