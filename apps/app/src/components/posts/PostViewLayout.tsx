'use client';

import { ReactNode } from 'react';

export function PostViewLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-white">{children}</div>;
}
