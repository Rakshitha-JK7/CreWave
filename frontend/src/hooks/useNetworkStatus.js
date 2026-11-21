import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useNetworkStatus Hook
 * Monitors network conditions over unreliable rural links:
 * - Browser online/offline events
 * - Network Information API (effectiveType: 2g, 3g, 4g, downlink, rtt)
 * - Periodic non-blocking health check ping to backend
 * 
 * Returns status: 'online' | 'slow' | 'unstable' | 'offline'
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [effectiveType, setEffectiveType] = useState('4g');
  const [pingLatency, setPingLatency] = useState(null);
  const [lastOnline, setLastOnline] = useState(new Date());
  const [status, setStatus] = useState('online'); // 'online' | 'slow' | 'unstable' | 'offline'
  const isCheckingRef = useRef(false);

  // Read Network Information API if supported
  const getConnInfo = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.connection) {
      const conn = navigator.connection;
      const type = conn.effectiveType || '4g';
      setEffectiveType(type);
      return {
        type,
        rtt: conn.rtt,
        downlink: conn.downlink,
        saveData: conn.saveData,
      };
    }
    return { type: '4g', rtt: 100, downlink: 10 };
  }, []);

  // Ping API base URL to verify actual server reachability (not just local network card)
  const pingServer = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus('offline');
      setIsOnline(false);
      return;
    }

    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    const start = Date.now();
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      // Use short timeout for responsive ping
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // Attempt non-blocking fetch to health or root
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      }).catch(() => null);

      clearTimeout(timeoutId);
      const latency = Date.now() - start;
      setPingLatency(latency);

      const connInfo = getConnInfo();

      if (!response || !response.ok) {
        // Backend might be starting or simulated 2G environment
        if (connInfo.type === '2g' || connInfo.type === 'slow-2g') {
          setStatus('slow');
        } else {
          // If browser reports online but backend is not responding yet, classify as online or slow
          setStatus(navigator.onLine ? 'online' : 'offline');
        }
      } else {
        setIsOnline(true);
        setLastOnline(new Date());
        if (connInfo.type === '2g' || connInfo.type === 'slow-2g' || latency > 1500) {
          setStatus('slow');
        } else {
          setStatus('online');
        }
      }
    } catch (err) {
      if (navigator.onLine) {
        setStatus('unstable');
      } else {
        setStatus('offline');
      }
    } finally {
      isCheckingRef.current = false;
    }
  }, [getConnInfo]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnline(new Date());
      setStatus('online');
      pingServer();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.connection) {
      navigator.connection.addEventListener('change', getConnInfo);
    }

    // Initial check
    getConnInfo();
    pingServer();

    // Ping periodically every 30s
    const interval = setInterval(pingServer, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (navigator.connection) {
        navigator.connection.removeEventListener('change', getConnInfo);
      }
      clearInterval(interval);
    };
  }, [getConnInfo, pingServer]);

  return {
    isOnline,
    status,
    effectiveType,
    isSlowConnection: status === 'slow' || effectiveType === '2g' || effectiveType === 'slow-2g',
    lastOnline,
    pingLatency,
    checkNow: pingServer,
  };
}

export default useNetworkStatus;
