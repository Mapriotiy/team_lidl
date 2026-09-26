import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** True only for the very first load, so refreshes do not blank the screen. */
  firstLoad: boolean;
  reload: () => void;
  setData: (updater: T | ((prev: T | null) => T | null) | null) => void;
}

/**
 * Small fetch-on-deps hook. Keeps stale data visible while refetching, ignores
 * responses from superseded requests, and never throws into render.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], enabled = true): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [firstLoad, setFirstLoad] = useState(true);
  const [nonce, setNonce] = useState(0);
  const reqId = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    let alive = true;
    setLoading(true);
    fnRef
      .current()
      .then((res) => {
        if (!alive || id !== reqId.current) return;
        setData(res);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive || id !== reqId.current) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!alive || id !== reqId.current) return;
        setLoading(false);
        setFirstLoad(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const update = useCallback((updater: T | ((prev: T | null) => T | null) | null) => {
    setData((prev) => (typeof updater === "function" ? (updater as (p: T | null) => T | null)(prev) : updater));
  }, []);

  return { data, error, loading, firstLoad, reload, setData: update };
}
