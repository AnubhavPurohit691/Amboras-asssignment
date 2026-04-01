'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LiveVisitorsBadge } from './live-visitors-badge';

interface KPICardsProps {
  revenue: { today: number; this_week: number; this_month: number } | null;
  conversionRate: number | null;
  liveVisitors: number;
  loading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function KPICards({ revenue, conversionRate, liveVisitors, loading }: KPICardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="col-span-2">
          <CardContent className="pt-2">
            <Skeleton className="h-3 w-28 mb-5" />
            <Skeleton className="h-14 w-52" />
          </CardContent>
        </Card>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-2">
              <Skeleton className="h-3 w-20 mb-4" />
              <Skeleton className="h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Hero — Today's Revenue (dominant) */}
      <Card className="col-span-2 py-8">
        <CardContent>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Today&apos;s Revenue</p>
          <p className="font-mono text-5xl sm:text-6xl font-bold text-foreground tracking-tighter">
            {revenue ? formatCurrency(revenue.today) : '—'}
          </p>
        </CardContent>
      </Card>

      {/* Week */}
      <Card>
        <CardContent className="pt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">This Week</p>
          <p className="font-mono text-2xl font-semibold text-foreground tracking-tight">
            {revenue ? formatCurrency(revenue.this_week) : '—'}
          </p>
        </CardContent>
      </Card>

      {/* Month */}
      <Card>
        <CardContent className="pt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">This Month</p>
          <p className="font-mono text-2xl font-semibold text-foreground tracking-tight">
            {revenue ? formatCurrency(revenue.this_month) : '—'}
          </p>
        </CardContent>
      </Card>

      {/* Conversion */}
      <Card>
        <CardContent className="pt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">Conversion</p>
          <p className="font-mono text-2xl font-semibold text-foreground tracking-tight">
            {conversionRate !== null ? `${conversionRate}%` : '—'}
          </p>
        </CardContent>
      </Card>

      {/* Live Visitors */}
      <Card>
        <CardContent className="pt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">Live Now</p>
          <LiveVisitorsBadge count={liveVisitors} />
        </CardContent>
      </Card>
    </div>
  );
}
