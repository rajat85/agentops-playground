# React UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hybrid micro-frontend — prefab_ui owns the config panel, React owns the trace viewer. Eliminates full re-renders during polling via React's keyed list diffing.

**Architecture:**
- `apps/ui` (prefab_ui, port 5175) — config panel only: task input, failure modes, Run button. After a run starts it embeds the React trace viewer via `Embed(url="http://localhost:5176?run_id={{ run_id }}")`.
- `apps/ui-react` (React + Vite, port 5176) — trace viewer only. Reads `run_id` from `?run_id=` URL param, polls orchestrator at `localhost:3000/trace/:runId` directly, appends steps incrementally with `key={step.step}`.
- `apps/orchestrator` (Express, port 3000) — unchanged.
- `apps/mcp-server` — unchanged.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS v3, Lucide React icons.

---

## File Map

| Path | Responsibility |
|------|----------------|
| `apps/ui-react/tailwind.config.ts` | ✅ Done — Tailwind theme |
| `apps/ui-react/postcss.config.js` | ✅ Done — PostCSS |
| `apps/ui-react/src/index.css` | ✅ Done — CSS vars + Tailwind |
| `apps/ui-react/src/lib/utils.ts` | ✅ Done — cn() helper |
| `apps/ui-react/vite.config.ts` | Modify — change port to 5176, add CORS origin |
| `apps/ui-react/src/types.ts` | Create — TraceStep, RunResult types |
| `apps/ui-react/src/api.ts` | Create — fetchTrace() only |
| `apps/ui-react/src/hooks/usePolling.ts` | Create — usePolling(runId) incremental append |
| `apps/ui-react/src/components/StepCard.tsx` | Create — single step card |
| `apps/ui-react/src/components/StatusPill.tsx` | Create — live status indicator |
| `apps/ui-react/src/components/TraceViewer.tsx` | Create — step list + final answer |
| `apps/ui-react/src/App.tsx` | Create — reads run_id from URL, renders TraceViewer |
| `apps/ui-react/src/main.tsx` | Create — React root mount |
| `apps/ui/app.py` | Modify — strip to config panel + Embed |

---

## Task 3: Update vite.config and define types + API layer

**Files:**
- Modify: `apps/ui-react/vite.config.ts`
- Create: `apps/ui-react/src/types.ts`
- Create: `apps/ui-react/src/api.ts`

- [ ] **Step 1: Update `apps/ui-react/vite.config.ts`** — change port to 5176

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
  },
});
```

- [ ] **Step 2: Create `apps/ui-react/src/types.ts`**

```typescript
export interface TraceStep {
  step: number;
  llm_input: string;
  llm_output: string;
  tool_called: string | null;
  tool_result: string | null;
  latency_ms: number;
}

export interface RunResult {
  run_id: string;
  task: string;
  failure_modes: string[];
  steps: TraceStep[];
  current_status: string;
  running: boolean;
  final_answer: string;
  completed_at: string | null;
}
```

- [ ] **Step 3: Create `apps/ui-react/src/api.ts`**

```typescript
import type { RunResult } from './types';

const BASE = 'http://localhost:3000';

export async function fetchTrace(runId: string): Promise<RunResult> {
  const res = await fetch(`${BASE}/trace/${runId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<RunResult>;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/ui-react/vite.config.ts apps/ui-react/src/types.ts apps/ui-react/src/api.ts
git commit -m "feat(ui-react): update port to 5176 and add types + API layer"
```

---

## Task 4: Build `usePolling` hook

**Files:**
- Create: `apps/ui-react/src/hooks/usePolling.ts`

This hook polls `/trace/:runId` every second. It appends **only new steps** by comparing the current step count via a ref, so React only mounts new `StepCard` components — existing ones never re-render.

- [ ] **Step 1: Create `apps/ui-react/src/hooks/` directory and `usePolling.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui-react/src/hooks/usePolling.ts
git commit -m "feat(ui-react): add usePolling hook with incremental step append"
```

---

## Task 5: Build `StepCard` component

**Files:**
- Create: `apps/ui-react/src/components/StepCard.tsx`

- [ ] **Step 1: Create `apps/ui-react/src/components/` directory and `StepCard.tsx`**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui-react/src/components/StepCard.tsx
git commit -m "feat(ui-react): add StepCard component"
```

---

## Task 6: Build `StatusPill`, `TraceViewer`, `App.tsx`, and `main.tsx`

**Files:**
- Create: `apps/ui-react/src/components/StatusPill.tsx`
- Create: `apps/ui-react/src/components/TraceViewer.tsx`
- Create: `apps/ui-react/src/App.tsx`
- Create: `apps/ui-react/src/main.tsx`

- [ ] **Step 1: Create `apps/ui-react/src/components/StatusPill.tsx`**

```tsx
interface StatusPillProps {
  status: string;
}

export function StatusPill({ status }: StatusPillProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm">
      <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
      <span className="text-sm italic text-muted-foreground">{status}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/ui-react/src/components/TraceViewer.tsx`**

```tsx
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

export function TraceViewer({ steps, finalAnswer, running, currentStatus, error }: TraceViewerProps) {
  if (steps.length === 0 && !running && !error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card py-16 text-center">
        <Cpu size={32} className="text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Waiting for run_id…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {running && currentStatus && <StatusPill status={currentStatus} />}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
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

          {steps.map((step) => (
            <StepCard key={step.step} step={step} />
          ))}
        </>
      )}

      {finalAnswer && (
        <div className="rounded-lg border border-l-4 border-l-green-500 bg-card shadow-sm">
          <div className="p-4 pb-2 flex items-center gap-2">
            <CircleCheck size={16} className="text-green-500" />
            <h3 className="text-base font-semibold">Final Answer</h3>
          </div>
          <div className="px-4 pb-4 text-sm leading-relaxed whitespace-pre-wrap">
            {finalAnswer}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/ui-react/src/App.tsx`**

App reads `run_id` from the URL query string (`?run_id=...`) — set by prefab_ui when embedding.

```tsx
import { usePolling } from './hooks/usePolling';
import { TraceViewer } from './components/TraceViewer';

export default function App() {
  const runId = new URLSearchParams(window.location.search).get('run_id') ?? '';
  const { steps, currentStatus, finalAnswer, running, error } = usePolling(runId);

  return (
    <div className="p-4">
      <TraceViewer
        steps={steps}
        finalAnswer={finalAnswer}
        running={running}
        currentStatus={currentStatus}
        error={error}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create `apps/ui-react/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 5: Commit**

```bash
git add apps/ui-react/src/
git commit -m "feat(ui-react): add TraceViewer, StatusPill, App and entry point"
```

---

## Task 7: Update prefab_ui to config panel + Embed

**Files:**
- Modify: `apps/ui/app.py`

Strip prefab_ui down to just the config panel. After a run starts, embed the React trace viewer pointing at port 5176 with `run_id` as a query param.

The orchestrator runs at `localhost:3000`. The React trace viewer runs at `localhost:5176`.

- [ ] **Step 1: Rewrite `apps/ui/app.py`**

```python
"""AgentOps Playground — config panel.

Serves at http://127.0.0.1:5175 via:
    uv run prefab serve app.py
"""

from prefab_ui import PrefabApp
from prefab_ui.components import (
    Card, CardContent, CardDescription, CardHeader, CardTitle,
    Checkbox, Column, Div, Embed,
    Icon, If, Row, Text, Muted, Textarea, Button,
)
from prefab_ui.actions import Fetch, SetState, ShowToast
from prefab_ui.rx import RESULT

ORCHESTRATOR_URL = "http://localhost:3000"
TRACE_VIEWER_URL = "http://localhost:5176"

with PrefabApp(
    title="AgentOps Playground",
    state={
        "task_input": "What is RAG and how does it reduce hallucination?",
        "retrieval_noise": False,
        "context_truncation": False,
        "agent_loop": False,
        "run_id": "",
    },
    connect_domains=[ORCHESTRATOR_URL],
) as app:
    with Column(gap=0, css_class="min-h-screen bg-muted/30"):

        # ── Top nav ──────────────────────────────────────────────────────
        with Div(css_class="border-b bg-background px-6 py-3"):
            with Row(justify="between", css_class="items-center max-w-5xl mx-auto"):
                with Row(gap=2, css_class="items-center"):
                    Icon("bot", size="default")
                    Text("AgentOps Playground", bold=True)
                Muted("AI diagnostic platform")

        # ── Page body ────────────────────────────────────────────────────
        with Column(gap=6, css_class="max-w-5xl mx-auto w-full px-6 py-8"):

            # ── Config panel ─────────────────────────────────────────────
            with Card():
                with CardHeader():
                    CardTitle("Configure Task")
                    CardDescription("Enter a task and optionally inject failure modes to stress-test the agent pipeline.")
                with CardContent():
                    with Column(gap=5):

                        Textarea(
                            name="task_input",
                            placeholder="e.g. What is RAG and how does it reduce hallucination?",
                            rows=3,
                            value="{{ task_input }}",
                        )

                        with Div(css_class="rounded-md border p-4 bg-muted/40"):
                            with Column(gap=3):
                                with Row(gap=2, css_class="items-center"):
                                    Icon("flask-conical", size="sm")
                                    Text("Failure Modes", bold=True)
                                Muted("Enable faults to observe how each layer degrades output.")
                                with Row(gap=6, css_class="pt-1"):
                                    Checkbox(name="retrieval_noise",    label="Retrieval Noise")
                                    Checkbox(name="context_truncation", label="Context Truncation")
                                    Checkbox(name="agent_loop",         label="Agent Loop")

                        Button(
                            "Run Agent",
                            icon="play",
                            variant="default",
                            size="lg",
                            css_class="w-full",
                            onClick=[
                                SetState("run_id", ""),
                                Fetch.post(
                                    f"{ORCHESTRATOR_URL}/run/start",
                                    body={
                                        "task": "{{ task_input }}",
                                        "failureModes": {
                                            "retrieval_noise": "{{ retrieval_noise }}",
                                            "context_truncation": "{{ context_truncation }}",
                                            "agent_loop": "{{ agent_loop }}",
                                        },
                                    },
                                    onSuccess=SetState("run_id", RESULT["run_id"]),
                                    onError=ShowToast("Failed to start: {{ $error }}", variant="error"),
                                ),
                            ],
                        )

            # ── Trace viewer (React) ─────────────────────────────────────
            with If("run_id"):
                Embed(
                    url=f"{TRACE_VIEWER_URL}?run_id={{{{ run_id }}}}",
                    width="100%",
                    height="800px",
                )
```

- [ ] **Step 2: Validate prefab_ui parses cleanly**

```bash
cd apps/ui && uv run python3 -c "import app"
```

Expected: no errors, no output.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/app.py
git commit -m "feat(ui): strip to config panel, embed React trace viewer"
```

---

## Task 8: Verify end-to-end

- [ ] **Step 1: Start mcp-server** (separate terminal)

```bash
cd apps/mcp-server && npm start
```

Expected: MCP server running.

- [ ] **Step 2: Start orchestrator** (separate terminal)

```bash
cd apps/orchestrator && npm start
```

Expected: `Orchestrator running on http://localhost:3000`

- [ ] **Step 3: Start React trace viewer** (separate terminal)

```bash
cd apps/ui-react && npm run dev
```

Expected: `Local: http://localhost:5176/`

- [ ] **Step 4: Start prefab_ui config panel** (separate terminal)

```bash
cd apps/ui && uv run prefab serve app.py
```

Expected: serving at `http://127.0.0.1:5175`

- [ ] **Step 5: Add `.gitignore` for ui-react**

Create `apps/ui-react/.gitignore`:
```
node_modules/
dist/
```

- [ ] **Step 6: Final commit**

```bash
git add apps/ui-react/.gitignore
git commit -m "feat(ui-react): add gitignore"
```

---

## Self-Review

**Spec coverage:**
- ✅ prefab_ui config panel — Task 7
- ✅ React trace viewer on port 5176 — Task 3 (vite.config)
- ✅ run_id passed via URL query param — Task 6 App.tsx
- ✅ Incremental step append, no full re-render — Task 4 usePolling + key={step.step}
- ✅ Collapsible model input — Task 5 StepCard
- ✅ Model output, tool result — Task 5 StepCard
- ✅ Final answer — Task 6 TraceViewer
- ✅ Live status pill — Task 6 StatusPill + TraceViewer
- ✅ Error display — Task 6 TraceViewer
- ✅ prefab_ui embeds React via Embed — Task 7
- ✅ 4 apps: mcp-server, orchestrator, ui (prefab_ui), ui-react — Task 8

**Type consistency:**
- `TraceStep.step` (number) → `key={step.step}` ✅
- `usePolling` returns `{ steps, currentStatus, finalAnswer, running, error }` → all consumed in App.tsx ✅
- `TraceViewerProps` matches App.tsx usage ✅
