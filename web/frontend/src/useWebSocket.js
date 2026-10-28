import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'ws://localhost:8080';
const MAX_PACKETS = 500;

export function useWebSocket() {
  const [packets, setPackets] = useState([]);
  const [status, setStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected'
  const [stats, setStats] = useState({ total: 0, tcp: 0, udp: 0, other: 0 });
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const packetIdRef = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        packet.id = ++packetIdRef.current;
        packet.timestamp = new Date().toISOString();

        setPackets((prev) => {
          const next = [packet, ...prev];
          return next.length > MAX_PACKETS ? next.slice(0, MAX_PACKETS) : next;
        });

        setStats((prev) => ({
          total: prev.total + 1,
          tcp: prev.tcp + (packet.protocol === 'TCP' ? 1 : 0),
          udp: prev.udp + (packet.protocol === 'UDP' ? 1 : 0),
          other: prev.other + (packet.protocol === 'OTHER' ? 1 : 0),
        }));
      } catch (err) {
        console.warn('Failed to parse packet:', err);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      console.log('WebSocket disconnected, retrying in 3s...');
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      ws.close();
    };
  }, []);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    setStatus('disconnected');
  }, []);

  const clearPackets = useCallback(() => {
    setPackets([]);
    setStats({ total: 0, tcp: 0, udp: 0, other: 0 });
    packetIdRef.current = 0;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { packets, status, stats, connect, disconnect, clearPackets };
}
