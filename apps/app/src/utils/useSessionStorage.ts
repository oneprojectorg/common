import { type Dispatch, type SetStateAction, useState } from 'react';

export function useSessionStorage<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setStoredValue: Dispatch<SetStateAction<T>> = (action) => {
    setValue((prev) => {
      const next =
        typeof action === 'function'
          ? (action as (p: T) => T)(prev)
          : action;
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* quota / disabled — ignore */
        }
      }
      return next;
    });
  };

  return [value, setStoredValue];
}
