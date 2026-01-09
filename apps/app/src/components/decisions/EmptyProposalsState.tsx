'use client';

import { ReactNode } from 'react';
import { LuLeaf } from 'react-icons/lu';

export function EmptyProposalsState({ children }: { children: ReactNode }) {
  return (
    <div className="gap-4 px-0 py-8 flex h-full flex-col items-center justify-center">
      <div className="size-10 flex items-center justify-center rounded-full bg-neutral-gray1">
        <LuLeaf className="size-6 text-neutral-gray4" />
      </div>
      <div className="gap-6 flex flex-col items-center justify-start">
        <div className="gap-2 flex flex-col items-center justify-start text-center">
          {children}
        </div>
      </div>
    </div>
  );
}
