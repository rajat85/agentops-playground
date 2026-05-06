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

function applyContextTruncation(messages: OllamaMessage[]): { messages: OllamaMessage[]; annotation: string | null } {
  const dropped = messages.length - 2;
  if (dropped <= 0) return { messages, annotation: null };
  const droppedRoles = messages.slice(0, dropped).map((m) => `[${m.role}]`).join(', ');
  return {
    messages: messages.slice(-2),
    annotation: `⚠️ context_truncation: dropped ${dropped} message${dropped > 1 ? 's' : ''} (${droppedRoles}) — only the last 2 were sent to the model`,
  };
}

function buildLLMAnnotations(failureModes: string[], messages: OllamaMessage[]): { messagesToSend: OllamaMessage[]; annotations: string[] } {
  let messagesToSend = messages;
  const annotations: string[] = [];

  if (failureModes.includes('context_truncation')) {
    const { messages: truncated, annotation } = applyContextTruncation(messages);
    messagesToSend = truncated;
    if (annotation) annotations.push(annotation);
  }

  if (failureModes.includes('agent_loop')) {
    annotations.push('⚠️ agent_loop: temperature raised to 1.5 — model output is deliberately erratic; early-exit on no tool call is suppressed');
  }

  return { messagesToSend, annotations };
}

function buildRetrievalNoiseAnnotation(toolResult: unknown): string | null {
  const docs = (toolResult as { documents?: string[] }).documents ?? [];
  const noiseMarkers = ['French Revolution', 'Photosynthesis', 'speed of light'];
  const noiseDocs = docs.filter((d) => noiseMarkers.some((m) => d.includes(m)));
  if (noiseDocs.length === 0) return null;
  return `⚠️ retrieval_noise: ${noiseDocs.length} noise document${noiseDocs.length > 1 ? 's' : ''} injected into results — "${noiseDocs.join('" · "')}"`;
}

export async function callLLM(
  messages: OllamaMessage[],
  tools: OllamaTool[],
  failureModes: string[]
): Promise<OllamaResponse> {
  const { messagesToSend, annotations } = buildLLMAnnotations(failureModes, messages);

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
    sentMessages: messagesToSend,
    annotations,
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

function buildFinalResult(runId: string, task: string, failureModes: string[], steps: TraceStep[], finalAnswer: string): RunResult {
  return {
    run_id: runId,
    task,
    failure_modes: failureModes,
    steps,
    current_status: 'Done',
    running: false,
    final_answer: finalAnswer,
    completed_at: new Date().toISOString(),
  };
}

async function executeMcpCall(
  runId: string,
  steps: TraceStep[],
  messages: OllamaMessage[],
  llmResponse: OllamaResponse,
  toolCall: OllamaToolCall,
  mcpClient: MCPClient,
  failureModes: string[],
): Promise<void> {
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

  if (failureModes.includes('retrieval_noise') && toolCall.function.name === 'retrieve_docs') {
    const annotation = buildRetrievalNoiseAnnotation(toolResult);
    if (annotation) mcpStep.annotations = [annotation];
  }

  updateLastTraceStep(runId, { tool_result: toolResult, latency_ms: mcpStep.latency_ms, annotations: mcpStep.annotations });

  messages.push(
    { role: 'assistant', content: llmResponse.content, tool_calls: llmResponse.tool_calls },
    { role: 'tool', content: JSON.stringify(toolResult) },
  );
}

export async function runAgent(task: string, options: RunOptions, existingRunId?: string): Promise<RunResult> {
  const runId = existingRunId ?? generateRunId();
  if (!existingRunId) initTrace(runId, task, options.failureModes);

  const mcpClient = new MCPClient();
  const mcpTools = await mcpClient.listTools();
  const ollamaTools = mcpTools.map(mcpToolToOllama);

  // retrieval_noise lives in MCP server in-memory state (failure-flags.ts).
  // Each run spawns a fresh MCP process, so we must prime it via inject_failure
  // before the agent loop starts — the orchestrator flag alone has no effect.
  if (options.failureModes.includes('retrieval_noise')) {
    await mcpClient.callTool('inject_failure', { type: 'retrieval_noise' });
  }

  appendTraceStep(runId, {
    step: -1, kind: 'mcp_init', llm_input: '', llm_output: '', tool_called: null,
    tool_result: mcpTools.map((t) => ({ name: t.name, description: t.description ?? '' })),
    latency_ms: 0,
  });

  const messages: OllamaMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: task },
  ];
  const steps: TraceStep[] = [];

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      setStatus(runId, `Step ${step + 1} — thinking…`);
      const t0 = Date.now();
      const llmResponse = await callLLM(messages, ollamaTools, options.failureModes);
      const toolCall = llmResponse.tool_calls[0] ?? null;

      const llmStep: TraceStep = {
        step: steps.length, kind: 'agent',
        llm_input: llmResponse.sentMessages.map((m) => `[${m.role}]: ${m.content}`).join('\n'),
        llm_output: llmResponse.content || (toolCall ? JSON.stringify(toolCall) : ''),
        tool_called: null, tool_result: null,
        latency_ms: Date.now() - t0,
        annotations: llmResponse.annotations.length > 0 ? llmResponse.annotations : undefined,
      };
      steps.push(llmStep);
      appendTraceStep(runId, llmStep);

      if (toolCall) {
        await executeMcpCall(runId, steps, messages, llmResponse, toolCall, mcpClient, options.failureModes);
      }

      if (!toolCall && !options.failureModes.includes('agent_loop')) {
        const result = buildFinalResult(runId, task, options.failureModes, steps, llmResponse.content);
        logTrace(result);
        return result;
      }
    }
  } finally {
    await mcpClient.disconnect();
  }

  const result = buildFinalResult(runId, task, options.failureModes, steps, 'Max steps reached without a final answer.');
  logTrace(result);
  return result;
}
