import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);
export const useSession = () => useContext(Ctx);

export function SessionProvider({ children }) {
  const [data, setData] = useState(null); // null = signed out
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // bumps on every realtime event so admin views can refetch
  const userId = data?.user.id;

  const refresh = useCallback(async () => {
    try {
      setData(await api('/state'));
    } catch (e) {
      if (e.status === 401) setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: the server streams a version number whenever anything changes.
  const lastV = useRef(null);
  useEffect(() => {
    if (!userId) return;
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      if (e.data !== lastV.current) {
        const first = lastV.current === null;
        lastV.current = e.data;
        if (!first) { refresh(); setTick((t) => t + 1); }
      }
    };
    const poll = setInterval(refresh, 20000); // safety net if the stream is blocked
    return () => { es.close(); clearInterval(poll); lastV.current = null; };
  }, [userId, refresh]);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setData(null);
  };

  return <Ctx.Provider value={{ data, loading, refresh, tick, logout }}>{children}</Ctx.Provider>;
}
