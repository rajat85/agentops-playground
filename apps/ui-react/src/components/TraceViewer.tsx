import { CircleCheck, Cpu } from 'lucide-react';
import { StepCard } from './StepCard';
import { StatusPill } from './StatusPill';
import type { TraceStep } from '../types';

interface TraceViewerProps {
  steps: TraceStep[];
  finalAnswer: string;
  running: boolean;
  currentStatus: string;
  error: string;
}

export function TraceViewer({ steps, finalAnswer, running, currentStatus, error }: Readonly<TraceViewerProps>) {
  return (
    <div data-testid="trace-viewer" className="flex flex-col gap-4">
      {running && (
        <div className="sticky top-0 z-40 bg-background pb-2 pt-1">
          <StatusPill status={currentStatus || 'Running…'} />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {steps.length === 0 && !running && !error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card py-16 text-center">
          <Cpu size={32} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Waiting for run_id…</p>
        </div>
      )}

      {steps.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Execution Trace</h2>
            <span className="inline-flex items-center rounded-full bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-semibold">
              {steps.length} steps
            </span>
          </div>

          {steps.map((step, i) => (
            <StepCard key={step.step} step={step} running={running && i === steps.length - 1} />
          ))}
        </>
      )}

      {finalAnswer && (
        <div className="rounded-lg border border-l-4 border-l-green-500 bg-card shadow-sm">
          <div className="p-4 pb-2 flex items-center gap-2">
            <CircleCheck size={16} className="text-green-500" />
            <h3 className="text-base font-semibold">Final Answer</h3>
          </div>
          <div data-testid="final-answer" className="px-4 pb-4 text-sm leading-relaxed whitespace-pre-wrap">
            {finalAnswer}
          </div>
        </div>
      )}
    </div>
  );
}
