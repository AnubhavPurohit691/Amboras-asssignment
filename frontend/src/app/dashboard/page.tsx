'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { DashboardHeader } from '@/components/dashboard-header';
import { KPICards } from '@/components/kpi-cards';
import { EventsChart } from '@/components/events-chart';
import { TopProductsTable } from '@/components/top-products-table';
import { RecentActivity } from '@/components/recent-activity';
import { useOverview, useTopProducts, useRecentActivity } from '@/hooks/use-analytics';
import { useSocket } from '@/hooks/use-socket';
import { DateRangePicker } from '@/components/date-range-picker';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const {
    data: overview,
    setData: setOverview,
    loading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useOverview(dateRange.from, dateRange.to);
  const { data: topProducts, loading: productsLoading, error: productsError, refetch: refetchProducts } = useTopProducts(dateRange.from, dateRange.to);
  const { data: recentEvents, setData: setRecentEvents, loading: activityLoading, error: activityError, refetch: refetchActivity } = useRecentActivity();

  const [liveVisitors, setLiveVisitors] = useState(0);
  const pendingEventsRef = useRef<typeof recentEvents>([]);

  useSocket({
    onNewEvent: (event) => {
      pendingEventsRef.current = [event, ...pendingEventsRef.current].slice(0, 40);
    },
    onLiveVisitors: ({ count }) => {
      setLiveVisitors(count);
    },
    onMetricsUpdate: (data) => {
      if (!dateRange.from && !dateRange.to) {
        setOverview(data);
      }
    },
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextEvent = pendingEventsRef.current.at(0);
      if (!nextEvent) return;

      pendingEventsRef.current = pendingEventsRef.current.slice(1);
      setRecentEvents((prev) => [nextEvent, ...prev.slice(0, 19)]);
    }, 1200);

    return () => window.clearInterval(interval);
  }, [setRecentEvents]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DashboardHeader />

        {/* Page title */}
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Overview</h2>
          <DateRangePicker onRangeChange={(from, to) => setDateRange({ from, to })} />
        </div>

        <div className="space-y-3 pb-12">
          {/* Error Banner */}
          {(overviewError || productsError || activityError) && (
            <div className="flex items-center justify-between bg-destructive/10 rounded-2xl px-5 py-3">
              <p className="text-sm text-destructive">
                Failed to load some data. {overviewError || productsError || activityError}
              </p>
              <Button
                variant="link"
                size="sm"
                className="text-destructive"
                onClick={() => { refetchOverview(); refetchProducts(); refetchActivity(); }}
              >
                Retry
              </Button>
            </div>
          )}

          {/* KPI Cards */}
          <KPICards
            revenue={overview?.revenue || null}
            conversionRate={overview?.conversion_rate ?? null}
            liveVisitors={liveVisitors || overview?.live_visitors || 0}
            loading={overviewLoading}
          />

          {/* Chart */}
          <EventsChart events={overview?.events || {}} loading={overviewLoading} />

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <TopProductsTable products={topProducts} loading={productsLoading} />
            <RecentActivity events={recentEvents} loading={activityLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}
