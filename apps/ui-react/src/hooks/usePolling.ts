import { useState, useEffect } from 'react';
import { fetchTrace } from '../api';
import type { TraceStep } from '../types';

function mergeSteps(prev: TraceStep[], server: TraceStep[]): TraceStep[] {
  return server.map((s, i) => (prev[i]?.tool_result === s.tool_result ? (prev[i] ?? s) : s));
}

interface PollingState {
  steps: TraceStep[];
  currentStatus: string;
  finalAnswer: string;
  running: boolean;
  error: string;
}

export function usePolling(runId: string): PollingState {
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [currentStatus, setCurrentStatus] = useState('');
  const [finalAnswer, setFinalAnswer] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!runId) return;

    setSteps([]);
    setCurrentStatus('');
    setFinalAnswer('');
    setRunning(true);
    setError('');

    const id = setInterval(async () => {
      try {
        const trace = await fetchTrace(runId);

        // Always sync full step list so tool_result updates on existing steps are picked up
        setSteps((prev) => mergeSteps(prev, trace.steps));

        setCurrentStatus(trace.current_status);
        setFinalAnswer(trace.final_answer ?? '');
        setRunning(trace.running);

        if (!trace.running) clearInterval(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Polling failed');
        setRunning(false);
        clearInterval(id);
      }
    }, 500);

    return () => clearInterval(id);
  }, [runId]);

  return { steps, currentStatus, finalAnswer, running, error };
}
