import { usePolling } from './hooks/usePolling';
import { TraceViewer } from './components/TraceViewer';
import { Bot } from 'lucide-react';

export default function App() {
  const runId = new URLSearchParams(globalThis.location.search).get('run_id') ?? '';
  const { steps, currentStatus, finalAnswer, running, error } = usePolling(runId);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">

      {/* Fixed header */}
      <header className="fixed top-0 inset-x-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-violet-500" />
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-tight leading-tight">AgentOps Playground</span>
              <span className="text-xs text-muted-foreground leading-tight">Ollama · MCP</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {runId ? (
              <>
                <span className="font-mono bg-muted px-2 py-0.5 rounded">{runId}</span>
                {running && (
                  <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    running
                  </span>
                )}
                {!running && steps.length > 0 && (
                  <span className="text-emerald-500 font-medium">complete</span>
                )}
              </>
            ) : (
              <span>No run selected</span>
            )}
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 mt-14 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <TraceViewer
            steps={steps}
            finalAnswer={finalAnswer}
            running={running}
            currentStatus={currentStatus}
            error={error}
          />
        </div>
      </main>

    </div>
  );
}
