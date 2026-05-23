// React hook bridging encrypted IDB storage with component state.
// Loads asynchronously, debounces writes so typing in the journal stays smooth.

import { useEffect, useRef, useState } from "react";
import { getEncrypted, setEncrypted, initStorage } from "./storage";

export const useEncrypted = <T,>(key: string, initial: T, debounceMs = 300):
  [T, (next: T | ((prev: T) => T)) => void, boolean] => {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<T>(initial);

  useEffect(() => {
    let alive = true;
    (async () => {
      await initStorage();
      const stored = await getEncrypted<T>(key, initial);
      if (!alive) return;
      latest.current = stored;
      setValue(stored);
      setReady(true);
    })();
    return () => { alive = false; };
  // initial only matters for the first load; intentionally not in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = (next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      latest.current = v;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { void setEncrypted(key, latest.current); }, debounceMs);
      return v;
    });
  };

  return [value, update, ready];
};
