import { useState } from 'react';
import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import type { TraceStep } from '../types';

interface StepCardProps {
  step: TraceStep;
}

export function StepCard({ step }: StepCardProps) {
  const [inputOpen, setInputOpen] = useState(false);

  return (
    <div className="rounded-lg border border-l-4 border-l-blue-500/40 bg-card">
      <div className="p-4 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono font-semibold">
              Step {step.step + 1}
            </span>
            {step.tool_called ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-mono font-semibold">
                <Settings size={10} />
                {step.tool_called}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-violet-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                + Reasoning
              </span>
            )}
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {step.latency_ms} ms
          </span>
        </div>

        {/* Collapsible model input */}
        <div className="rounded-md border border-dashed border-muted-foreground/30">
          <button
            onClick={() => setInputOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
          >
            {inputOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Model Input
          </button>
          {inputOpen && (
            <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words bg-muted/60 rounded-b-md p-3 max-h-60 overflow-y-auto">
              {step.llm_input}
            </pre>
          )}
        </div>

        {/* Model output */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Model Output
          </span>
          <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words bg-muted/60 rounded-md p-3 max-h-40 overflow-y-auto">
            {step.llm_output}
          </pre>
        </div>

        {/* Tool result */}
        {step.tool_called && step.tool_result && (
          <>
            <hr className="border-border" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tool Result
              </span>
              <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words bg-muted/60 rounded-md p-3 max-h-40 overflow-y-auto">
                {step.tool_result}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
