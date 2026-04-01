'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface RecentEvent {
  id: string;
  event_type: string;
  product_name: string | null;
  revenue: number | null;
  session_id: string;
  created_at: string;
}

interface RecentActivityProps {
  events: RecentEvent[];
  loading: boolean;
}

const EVENT_COLORS: Record<string, string> = {
  page_view: 'bg-zinc-500',
  add_to_cart: 'bg-zinc-300',
  remove_from_cart: 'bg-zinc-600',
  checkout_started: 'bg-zinc-400',
  purchase: 'bg-white',
};

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function RecentActivity({ events, loading }: RecentActivityProps) {
  if (loading) {
    return (
      <Card className="border border-border/70">
        <CardHeader>
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/70">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Live event stream — last 20 events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 max-h-96 overflow-y-auto dark-scrollbar">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors duration-150"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${EVENT_COLORS[event.event_type] || 'bg-muted-foreground'}`} />
                <Badge variant="secondary" className="text-xs">
                  {event.event_type.replace(/_/g, ' ')}
                </Badge>
                <span className="text-sm text-muted-foreground truncate max-w-[80px] sm:max-w-none">
                  {event.product_name || 'Page visit'}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                {event.revenue && (
                  <span className="text-sm font-mono font-semibold text-foreground">
                    {formatCurrency(event.revenue)}
                  </span>
                )}
                <span className="text-xs font-mono text-muted-foreground">{formatTime(event.created_at)}</span>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-muted-foreground text-sm">No recent events</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
