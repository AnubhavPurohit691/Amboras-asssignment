'use client';

import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface EventsChartProps {
  events: Record<string, number>;
  loading: boolean;
}

type ChartView = 'distribution' | 'types';

const EVENT_ORDER = ['page_view', 'add_to_cart', 'remove_from_cart', 'checkout_started', 'purchase'];

const SHORT_LABELS: Record<string, string> = {
  page_view: 'Page View',
  add_to_cart: 'Add To Cart',
  remove_from_cart: 'Remove From Cart',
  checkout_started: 'Checkout Started',
  purchase: 'Purchase',
};

const VIEW_COPY: Record<ChartView, { title: string; description: string }> = {
  distribution: {
    title: 'Event Distribution',
    description: 'Events by type across the selected range',
  },
  types: {
    title: 'Events by Type',
    description: 'Volume breakdown per event category',
  },
};

const chartConfig = {
  count: {
    label: 'Events',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

const formatValue = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v));

const buildChartData = (events: Record<string, number>) => {
  const knownEntries = EVENT_ORDER.map((type) => [type, events[type] ?? 0] as const);
  const extraEntries = Object.entries(events).filter(([type]) => !EVENT_ORDER.includes(type));

  return [...knownEntries, ...extraEntries].map(([type, count]) => ({
    key: type,
    name: SHORT_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    count,
  }));
};

export function EventsChart({ events, loading }: EventsChartProps) {
  const [view, setView] = useState<ChartView>('distribution');

  if (loading) {
    return (
      <Card className="border border-border/70 bg-linear-to-b from-card to-card/80 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <CardHeader>
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  const chartData = buildChartData(events);
  const totalEvents = chartData.reduce((sum, item) => sum + item.count, 0);
  const leadingEvent = chartData.reduce(
    (current, item) => (item.count > current.count ? item : current),
    chartData[0] ?? { key: 'none', name: 'No Events', count: 0 },
  );
  const averageVolume = chartData.length > 0 ? Math.round(totalEvents / chartData.length) : 0;

  const sharedAxisProps = {
    tickLine: false as const,
    axisLine: false as const,
    tick: { fill: 'var(--muted-foreground)', fontSize: 12 },
  };

  return (
    <Card className="border border-border/70 bg-linear-to-b from-card via-card to-background shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <Tabs value={view} onValueChange={(value) => setView(value as ChartView)}>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle className="text-base">{VIEW_COPY[view].title}</CardTitle>
            <CardDescription>{VIEW_COPY[view].description}</CardDescription>
          </div>
          <CardAction className="row-span-1">
            <TabsList className="h-auto gap-1 rounded-full border border-border/80 bg-background/70 p-1">
              <TabsTrigger
                value="distribution"
                className="rounded-full px-3 py-1.5 text-xs data-active:bg-primary data-active:text-primary-foreground"
              >
                Distribution
              </TabsTrigger>
              <TabsTrigger
                value="types"
                className="rounded-full px-3 py-1.5 text-xs data-active:bg-primary data-active:text-primary-foreground"
              >
                Types
              </TabsTrigger>
            </TabsList>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/45 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Total Events</p>
              <p className="mt-3 font-mono text-2xl font-semibold text-foreground">{totalEvents.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/45 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Top Signal</p>
              <p className="mt-3 text-base font-semibold text-foreground">{leadingEvent.name}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{leadingEvent.count.toLocaleString()} events</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/45 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Average Volume</p>
              <p className="mt-3 font-mono text-2xl font-semibold text-foreground">{averageVolume.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">Per event category</p>
            </div>
          </div>
          <TabsContent value="distribution" className="mt-0">
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <AreaChart data={chartData} accessibilityLayer margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tickMargin={10} {...sharedAxisProps} />
                <YAxis width={70} tickFormatter={formatValue} {...sharedAxisProps} />
                <ChartTooltip
                  cursor={{ stroke: 'var(--border-emphasis)', strokeWidth: 1 }}
                  content={<ChartTooltipContent labelFormatter={(value) => String(value)} />}
                />
                <defs>
                  <linearGradient id="distributionFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <Area
                  dataKey="count"
                  type="monotone"
                  fill="url(#distributionFill)"
                  stroke="var(--color-count)"
                  strokeWidth={2}
                  activeDot={{ r: 4, fill: 'var(--color-count)', stroke: 'var(--background)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ChartContainer>
          </TabsContent>
          <TabsContent value="types" className="mt-0">
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart data={chartData} accessibilityLayer margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tickMargin={10} {...sharedAxisProps} />
                <YAxis width={70} tickFormatter={formatValue} {...sharedAxisProps} />
                <ChartTooltip
                  cursor={{ fill: 'var(--muted)' }}
                  content={<ChartTooltipContent labelFormatter={(value) => String(value)} />}
                />
                <Bar dataKey="count" fill="var(--color-count)" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
