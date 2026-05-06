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
