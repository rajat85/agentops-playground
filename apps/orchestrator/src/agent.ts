import type { OllamaMessage, OllamaTool, OllamaResponse, TraceStep, RunOptions, RunResult } from './types.js';
import { generateRunId, initTrace, appendTraceStep, updateLastTraceStep, setStatus, logTrace } from './trace.js';
import { MCPClient } from './mcp-client.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL = 'gemma4';
const MAX_STEPS = 10;

const SYSTEM_PROMPT = `You are a research assistant. Use the available tools to look up information before answering. Do not invent information.`;

export function mcpToolToOllama(tool: Tool): OllamaTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: (tool.inputSchema as Record<string, unknown>) ?? { type: 'object', properties: {} },
    },
  };
}

export async function callLLM(
  messages: OllamaMessage[],
  tools: OllamaTool[],
  failureModes: string[]
): Promise<OllamaResponse> {
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
      tools,
      stream: false,
      ...(failureModes.includes('agent_loop') ? { options: { temperature: 1.5 } } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { message: { content: string; tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[] } };
  return {
    content: data.message.content ?? '',
    tool_calls: data.message.tool_calls ?? [],
  };
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

  const mcpTools = await mcpClient.listTools();
  const ollamaTools = mcpTools.map(mcpToolToOllama);

  const mcpInitStep: TraceStep = {
    step: -1,
    kind: 'mcp_init',
    llm_input: '',
    llm_output: '',
    tool_called: null,
    tool_result: mcpTools.map((t) => ({ name: t.name, description: t.description ?? '' })),
    latency_ms: 0,
  };
  appendTraceStep(runId, mcpInitStep);

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
      const llmResponse = await callLLM(messages, ollamaTools, options.failureModes);
      const latency_ms = Date.now() - t0;

      const toolCall = llmResponse.tool_calls[0] ?? null;

      // Step A: LLM decision
      const llmStep: TraceStep = {
        step: steps.length,
        kind: 'agent',
        llm_input: llmInput,
        llm_output: llmResponse.content || (toolCall ? JSON.stringify(toolCall) : ''),
        tool_called: null,
        tool_result: null,
        latency_ms,
      };
      steps.push(llmStep);
      appendTraceStep(runId, llmStep);

      if (toolCall) {
        // Step B: MCP invocation — appended before the call so UI shows it immediately
        const mcpStep: TraceStep = {
          step: steps.length,
          kind: 'mcp_call',
          llm_input: '',
          llm_output: '',
          tool_called: toolCall.function.name,
          tool_result: null,
          latency_ms: 0,
        };
        steps.push(mcpStep);
        appendTraceStep(runId, mcpStep);

        setStatus(runId, `Calling MCP tool ${toolCall.function.name}…`);
        const t1 = Date.now();
        const toolResult = await mcpClient.callTool(toolCall.function.name, toolCall.function.arguments);
        mcpStep.tool_result = toolResult;
        mcpStep.latency_ms = Date.now() - t1;
        updateLastTraceStep(runId, { tool_result: toolResult, latency_ms: mcpStep.latency_ms });

        messages.push(
          { role: 'assistant', content: llmResponse.content, tool_calls: llmResponse.tool_calls },
          { role: 'tool', content: JSON.stringify(toolResult) }
        );
      }

      if (!toolCall && !options.failureModes.includes('agent_loop')) {
        const result: RunResult = {
          run_id: runId,
          task,
          failure_modes: options.failureModes,
          steps,
          current_status: 'Done',
          running: false,
          final_answer: llmResponse.content,
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
