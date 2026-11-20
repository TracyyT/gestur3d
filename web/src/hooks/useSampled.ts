import { useEffect, useState } from 'react';

/** Re-samples `read` every `ms` milliseconds and returns the latest value. */
export function useSampled<T>(read: () => T, ms: number): T {
  const [value, setValue] = useState(read);
  useEffect(() => {
    const id = window.setInterval(() => setValue(read()), ms);
    return () => window.clearInterval(id);
  }, [read, ms]);
  return value;
}
