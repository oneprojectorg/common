'use client';

import { useState } from 'react';

/** Held past the close so a panel animates out with its content still in it. */
export function useLastOpenId(id: string | null): string | null {
  const [shown, setShown] = useState(id);

  if (id !== null && id !== shown) {
    setShown(id);
  }

  return shown;
}
