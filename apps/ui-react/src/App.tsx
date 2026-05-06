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
