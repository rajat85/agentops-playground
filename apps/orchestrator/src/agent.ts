import type { OllamaMessage, TraceStep, RunOptions, RunResult, ToolCall } from './types.js';
import { generateRunId, initTrace, appendTraceStep, setStatus, logTrace } from './trace.js';
import { MCPClient } from './mcp-client.js';

const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL = 'gemma4';
const MAX_STEPS = 10;

const SYSTEM_PROMPT = `You are a research assistant with access to tools.

When you need to look up information, emit a tool call as a JSON block on its own line, exactly like this:
{"tool": "retrieve_docs", "args": {"query": "your search query"}}

Available tools:
- retrieve_docs: search local documents. Args: { "query": string }
- inject_failure: acknowledge a failure mode. Args: { "type": "retrieval_noise" | "context_truncation" | "agent_loop" }
- get_trace: read a past execution trace. Args: { "run_id": string }

Rules:
1. Only emit ONE tool call per response.
2. After receiving tool results, use them to answer the user.
3. When you have enough information, answer directly without a tool call.
4. Do not invent information. Use only what is retrieved.`;

export function parseToolCall(text: string): ToolCall | null {
  const match = /\{(?:[^{}]|\{[^{}]*\})*"tool"\s*:(?:[^{}]|\{[^{}]*\})*\}/s.exec(text);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    if (typeof parsed['tool'] === 'string' && typeof parsed['args'] === 'object' && parsed['args'] !== null) {
      return parsed as unknown as ToolCall;
    }
  } catch {
    // not valid JSON
  }
  return null;
}

export async function callLLM(
  messages: OllamaMessage[],
  failureModes: string[]
): Promise<string> {
  let messagesToSend = messages;

  if (failureModes.includes('context_truncation')) {
    messagesToSend = messages.slice(-2);
  }

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: messagesToSend,
      stream: false,
      ...(failureModes.includes('agent_loop') ? { options: { temperature: 1.5 } } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { message: { content: string } };
  return data.message.content;
}

export function runAgentBackground(task: string, failureModes: string[]): { run_id: string } {
  const runId = generateRunId();
  initTrace(runId, task, failureModes);
  runAgent(task, { failureModes }, runId).catch((err) => {
    console.error(`Agent run ${runId} failed:`, err);
  });
  return { run_id: runId };
}

export async function runAgent(task: string, options: RunOptions, existingRunId?: string): Promise<RunResult> {
  const runId = existingRunId ?? generateRunId();
  if (!existingRunId) initTrace(runId, task, options.failureModes);

  const mcpClient = new MCPClient();
  const messages: OllamaMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: task },
  ];
  const steps: TraceStep[] = [];

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      setStatus(runId, `Step ${step + 1} — thinking…`);
      const t0 = Date.now();
      const llmInput = messages.map((m) => `[${m.role}]: ${m.content}`).join('\n');
      const llmOutput = await callLLM(messages, options.failureModes);
      const latency_ms = Date.now() - t0;

      const toolCall = parseToolCall(llmOutput);

      const traceStep: TraceStep = {
        step,
        llm_input: llmInput,
        llm_output: llmOutput,
        tool_called: toolCall ? toolCall.tool : null,
        tool_result: null,
        latency_ms,
      };

      if (toolCall) {
        setStatus(runId, `Step ${step + 1} — calling ${toolCall.tool}…`);
        const toolResult = await mcpClient.callTool(toolCall.tool, toolCall.args);
        traceStep.tool_result = toolResult;
        messages.push(
          { role: 'assistant', content: llmOutput },
          { role: 'user', content: `Tool result for ${toolCall.tool}:\n${JSON.stringify(toolResult)}` }
        );
      }

      steps.push(traceStep);
      appendTraceStep(runId, traceStep);

      // agent_loop failure mode: skip the exit condition so the loop runs to MAX_STEPS
      if (!toolCall && !options.failureModes.includes('agent_loop')) {
        const result: RunResult = {
          run_id: runId,
          task,
          failure_modes: options.failureModes,
          steps,
          current_status: 'Done',
          running: false,
          final_answer: llmOutput,
          completed_at: new Date().toISOString(),
        };
        logTrace(result);
        return result;
      }
    }
  } finally {
    await mcpClient.disconnect();
  }

  const result: RunResult = {
    run_id: runId,
    task,
    failure_modes: options.failureModes,
    steps,
    current_status: 'Done',
    running: false,
    final_answer: 'Max steps reached without a final answer.',
    completed_at: new Date().toISOString(),
  };
  logTrace(result);
  return result;
}
