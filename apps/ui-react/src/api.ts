import type { RunResult } from './types';

const BASE = 'http://localhost:3000';

export async function fetchTrace(runId: string): Promise<RunResult> {
  const res = await fetch(`${BASE}/trace/${runId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<RunResult>;
}
