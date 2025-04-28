'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export const ClientOnly = ({ children }: { children: ReactNode }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div />;
  }

  return <>{children}</>;
};
