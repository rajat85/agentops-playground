import express from 'express';
import { runAgent } from './agent.js';
import { readTrace } from './trace.js';

const app = express();
app.use(express.json());

app.post('/run', async (req, res) => {
  const { task, failureModes = [] } = req.body as { task: string; failureModes: string[] };
  if (!task || typeof task !== 'string') {
    res.status(400).json({ error: 'task is required and must be a string' });
    return;
  }
  try {
    const result = await runAgent(task, { failureModes });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

app.get('/trace/:runId', (req, res) => {
  const trace = readTrace(req.params['runId'] ?? '');
  if (!trace) {
    res.status(404).json({ error: 'Trace not found' });
    return;
  }
  res.json(trace);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Orchestrator running on http://localhost:${PORT}`);
});
