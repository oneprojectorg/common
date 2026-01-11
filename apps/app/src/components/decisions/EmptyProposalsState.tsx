'use client';

import { ReactNode } from 'react';
import { LuLeaf } from 'react-icons/lu';

export function EmptyProposalsState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-0 py-8">
      <div className="bg-neutral-gray1 flex size-10 items-center justify-center rounded-full">
        <LuLeaf className="text-neutral-gray4 size-6" />
      </div>
      <div className="flex flex-col items-center justify-start gap-6">
        <div className="flex flex-col items-center justify-start gap-2 text-center">
          {children}
        </div>
      </div>
    </div>
  );
}
