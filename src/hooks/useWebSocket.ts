'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { WS_URL } from '@/lib/api';

interface PlateResult {
  bbox: number[];
  text: string;
  conf: number;
}

interface UseWebSocketOptions {
  onResults: (results: PlateResult[]) => void;
  onError?: (message: string) => void;
  onFirstResult?: () => void;
}

export function useWebSocket({ onResults, onError, onFirstResult }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const isConnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const firstResultFiredRef = useRef(false);

  const connect = useCallback(() => {
    // Connect directly to FastAPI backend (bypass Next.js proxy which doesn't support WS)
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    firstResultFiredRef.current = false;

    ws.onopen = () => {
      console.log('Mở cổng WebSocket thành công. Bắt đầu truyền dữ liệu.');
      isConnectedRef.current = true;
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === 'success') {
        if (!firstResultFiredRef.current) {
          firstResultFiredRef.current = true;
          onFirstResult?.();
        }
        onResults(data.results);
      } else {
        console.error('WebSocket server trả về lỗi:', data.message);
        onError?.(data.message);
      }
    };

    ws.onerror = (err) => {
      console.error('Lỗi WebSocket: Không thể kết nối đến backend tại', WS_URL);
      onError?.(`Không thể kết nối đến backend. Hãy chắc chắn backend đang chạy tại ${WS_URL}`);
    };

    ws.onclose = (event) => {
      console.log('Cổng kết nối WebSocket đã đóng.', event.code, event.reason);
      isConnectedRef.current = false;
      setIsConnected(false);
    };

    return ws;
  }, [onResults, onError, onFirstResult]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    isConnectedRef.current = false;
    setIsConnected(false);
  }, []);

  const sendFrame = useCallback((base64Data: string, conf1 = 0.5, conf2 = 0.5, conf3 = 0.3, regionId: number | null = null) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    let userId: number | null = null;
    if (typeof window !== 'undefined') {
      const savedUserId = localStorage.getItem('userId');
      if (savedUserId) {
        userId = parseInt(savedUserId, 10);
      }
    }

    wsRef.current.send(JSON.stringify({
      image: base64Data,
      conf1,
      conf2,
      conf3,
      user_id: userId,
      region_id: regionId,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    sendFrame,
    isConnected,
    wsRef,
  };
}
