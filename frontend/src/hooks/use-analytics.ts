'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
//fixing
interface OverviewData {
  revenue: { today: number; this_week: number; this_month: number };
  events: Record<string, number>;
  conversion_rate: number;
  live_visitors: number;
}

interface TopProduct {
  id: string;
  name: string;
  image_url: string | null;
  revenue: number;
  units_sold: number;
}

interface RecentEvent {
  id: string;
  event_type: string;
  product_name: string | null;
  revenue: number | null;
  session_id: string;
  created_at: string;
}

export function useOverview(from?: string, to?: string) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const query = params.toString() ? `?${params.toString()}` : '';
      const result = await apiFetch<OverviewData>(`/analytics/overview${query}`);
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, setData, loading, error, refetch: fetchData };
}

export function useTopProducts(from?: string, to?: string) {
  const [data, setData] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (data.length === 0) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const query = params.toString() ? `?${params.toString()}` : '';
      const result = await apiFetch<{ products: TopProduct[] }>(`/analytics/top-products${query}`);
      setData(result.products);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useRecentActivity() {
  const [data, setData] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ events: RecentEvent[] }>('/analytics/recent-activity');
      setData(result.events);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, setData, loading, error, refetch: fetchData };
}
