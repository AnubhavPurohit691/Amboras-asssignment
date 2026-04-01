'use client';

export function LiveVisitorsBadge({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-35" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-foreground" />
      </span>
      <span className="font-mono text-2xl font-semibold text-foreground tracking-tight">{count}</span>
    </div>
  );
}
