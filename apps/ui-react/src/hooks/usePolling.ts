import { useState, useEffect, useRef } from 'react';
import { fetchTrace } from '../api';
import type { TraceStep } from '../types';

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
  const knownCountRef = useRef(0);

  useEffect(() => {
    if (!runId) return;

    setSteps([]);
    setCurrentStatus('');
    setFinalAnswer('');
    setRunning(true);
    setError('');
    knownCountRef.current = 0;

    const id = setInterval(async () => {
      try {
        const trace = await fetchTrace(runId);

        const newSteps = trace.steps.slice(knownCountRef.current);
        if (newSteps.length > 0) {
          knownCountRef.current = trace.steps.length;
          setSteps((prev) => [...prev, ...newSteps]);
        }

        setCurrentStatus(trace.current_status);
        setFinalAnswer(trace.final_answer ?? '');
        setRunning(trace.running);

        if (!trace.running) clearInterval(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Polling failed');
        setRunning(false);
        clearInterval(id);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [runId]);

  return { steps, currentStatus, finalAnswer, running, error };
}
