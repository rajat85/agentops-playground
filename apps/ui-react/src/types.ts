export interface TraceStep {
  step: number;
  kind?: 'mcp_init' | 'agent' | 'mcp_call';
  llm_input: string;
  llm_output: string;
  tool_called: string | null;
  tool_result: string | null;
  latency_ms: number;
  annotations?: string[];
}

export interface RunResult {
  run_id: string;
  task: string;
  failure_modes: string[];
  steps: TraceStep[];
  current_status: string;
  running: boolean;
  final_answer: string;
  completed_at: string | null;
}
