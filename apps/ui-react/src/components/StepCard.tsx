import { useState } from 'react';
import { ChevronDown, ChevronRight, Plug, Loader, CircleCheck, BrainCircuit, TriangleAlert } from 'lucide-react';
import type { TraceStep } from '../types';

interface StepCardProps {
  step: Readonly<TraceStep>;
  running?: boolean;
}

interface McpTool {
  name: string;
  description: string;
}

function Annotations({ annotations }: Readonly<{ annotations?: string[] }>) {
  if (!annotations?.length) return null;
  return (
    <div className="flex flex-col gap-1">
      {annotations.map((a) => (
        <div key={a} className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-400/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />
          <span>{a}</span>
        </div>
      ))}
    </div>
  );
}

function McpInitCard({ step }: Readonly<{ step: TraceStep }>) {
  const tools = step.tool_result ? (JSON.parse(step.tool_result) as McpTool[]) : [];
  return (
    <div data-testid="mcp-init-step" className="rounded-lg border border-l-4 border-l-emerald-500 bg-card">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Plug size={14} className="text-emerald-500" />
          <span className="text-sm font-semibold">MCP Tool Registration</span>
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-xs font-semibold">
            {tools.length} tools
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {tools.map((t) => (
            <div key={t.name} className="flex items-start gap-2 text-xs">
              <span className="font-mono font-semibold text-emerald-600 shrink-0">{t.name}</span>
              <span className="text-muted-foreground">{t.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function McpCallCard({ step, running }: Readonly<StepCardProps>) {
  const done = !!step.tool_result;
  return (
    <div data-testid="mcp-call-step" className="rounded-lg border border-l-4 border-l-amber-400 bg-card">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono font-semibold">
              Step {step.step + 1}
            </span>
            {done ? (
              <CircleCheck size={14} className="text-emerald-500" />
            ) : (
              <Loader size={14} className="animate-spin text-amber-500" />
            )}
            <span className="text-sm font-semibold">
              MCP Call — <span className="font-mono">{step.tool_called}</span>
            </span>
            {!done && running && (
              <span className="text-xs text-amber-500">invoking…</span>
            )}
          </div>
          {done && (
            <span className="text-xs tabular-nums text-muted-foreground">{step.latency_ms} ms</span>
          )}
        </div>

        {step.tool_result && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tool Result
            </span>
            <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words bg-muted/60 rounded-md p-3 max-h-40 overflow-y-auto">
              {step.tool_result}
            </pre>
          </div>
        )}
        <Annotations annotations={step.annotations} />
      </div>
    </div>
  );
}

export function StepCard({ step, running }: Readonly<StepCardProps>) {
  const [inputOpen, setInputOpen] = useState(false);

  if (step.kind === 'mcp_init') return <McpInitCard step={step} />;
  if (step.kind === 'mcp_call') return <McpCallCard step={step} running={running} />;

  return (
    <div data-testid="agent-step" className="rounded-lg border border-l-4 border-l-blue-500/40 bg-card">
      <div className="p-4 flex flex-col gap-4">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono font-semibold">
              Step {step.step + 1}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/10 text-violet-600 px-2.5 py-0.5 text-xs font-semibold">
              <BrainCircuit size={10} />
              LLM
            </span>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{step.latency_ms} ms</span>
        </div>

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

        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Model Output
          </span>
          <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words bg-muted/60 rounded-md p-3 max-h-40 overflow-y-auto">
            {step.llm_output}
          </pre>
        </div>
        <Annotations annotations={step.annotations} />
      </div>
    </div>
  );
}
