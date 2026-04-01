'use client';

import { useEffect, useRef } from 'react';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { isAuthenticated } from '@/lib/auth';

interface UseSocketOptions {
  onNewEvent?: (event: any) => void;
  onLiveVisitors?: (data: { count: number }) => void;
  onMetricsUpdate?: (data: any) => void;
}

export function useSocket({ onNewEvent, onLiveVisitors, onMetricsUpdate }: UseSocketOptions) {
  const callbacksRef = useRef({ onNewEvent, onLiveVisitors, onMetricsUpdate });
  callbacksRef.current = { onNewEvent, onLiveVisitors, onMetricsUpdate };

  useEffect(() => {
    if (!isAuthenticated()) return;

    const socket = getSocket();
    socket.connect();

    socket.on('new-event', (data) => callbacksRef.current.onNewEvent?.(data));
    socket.on('live-visitors', (data) => callbacksRef.current.onLiveVisitors?.(data));
    socket.on('metrics-update', (data) => callbacksRef.current.onMetricsUpdate?.(data));

    return () => {
      disconnectSocket();
    };
  }, []);
}
