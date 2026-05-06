import cors from 'cors';
import express from 'express';
import { runAgent, runAgentBackground } from './agent.js';
import { readTrace } from './trace.js';
import type { RunResult } from './types.js';

const app = express();
app.use(cors());
app.use(express.json());

function resolveFailureModes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, boolean>)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }
  return [];
}

function formatToolResult(tool: string | null, result: unknown): string {
  if (result === null || result === undefined) return '';
  if (typeof result === 'string') return result;

  if (tool === 'retrieve_docs') {
    const docs = (result as { documents?: string[] }).documents ?? [];
    if (docs.length === 0) return 'No documents found.';
    return `Found ${docs.length} document${docs.length > 1 ? 's' : ''}:\n\n` +
      docs.map((d, i) => `${i + 1}. ${d}`).join('\n');
  }

  return JSON.stringify(result, null, 2);
}

function withActiveRunId(result: RunResult): RunResult & { active_run_id: string } {
  return { ...result, running: !result.completed_at, active_run_id: result.completed_at ? '' : result.run_id };
}

function stringifyToolResults(result: RunResult): RunResult {
  return {
    ...result,
    steps: result.steps.map((s) => ({
      ...s,
      tool_result: formatToolResult(s.tool_called, s.tool_result),
    })),
  };
}

app.post('/run', async (req, res) => {
  const { task, failureModes, failure_modes } = req.body as {
    task: string;
    failureModes?: unknown;
    failure_modes?: unknown;
  };
  if (!task || typeof task !== 'string') {
    res.status(400).json({ error: 'task is required and must be a string' });
    return;
  }
  try {
    const modes = resolveFailureModes(failureModes ?? failure_modes);
    const result = await runAgent(task, { failureModes: modes });
    res.json(stringifyToolResults(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

app.post('/run/start', (req, res) => {
  const { task, failureModes, failure_modes } = req.body as {
    task: string;
    failureModes?: unknown;
    failure_modes?: unknown;
  };
  if (!task || typeof task !== 'string') {
    res.status(400).json({ error: 'task is required and must be a string' });
    return;
  }
  const modes = resolveFailureModes(failureModes ?? failure_modes);
  const { run_id } = runAgentBackground(task, modes);
  res.json({ run_id });
});

app.get('/trace/:runId', (req, res) => {
  const trace = readTrace(req.params['runId'] ?? '');
  if (!trace) {
    res.status(404).json({ error: 'Trace not found' });
    return;
  }
  res.json(withActiveRunId(stringifyToolResults(trace)));
});

// Returns the single next step at index `from`, or null if not yet available.
app.get('/trace/:runId/steps', (req, res) => {
  const trace = readTrace(req.params['runId'] ?? '');
  if (!trace) {
    res.status(404).json({ error: 'Trace not found' });
    return;
  }
  const from = Number.parseInt((req.query['from'] as string) ?? '0', 10);
  const stringified = stringifyToolResults(trace);
  const step = stringified.steps[from] ?? null;
  res.json({
    step,
    running: !trace.completed_at,
    current_status: trace.current_status,
    final_answer: trace.final_answer ?? '',
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Orchestrator running on http://localhost:${PORT}`);
});
