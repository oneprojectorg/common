'use client';

import { Search } from 'lucide-react';

export function EmptyProposalsState() {
  return (
    <div className="rounded-lg bg-neutral-gray1 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-gray2">
        <Search className="h-6 w-6 text-neutral-gray3" />
      </div>
      <h3 className="text-base font-medium text-neutral-charcoal">
        No proposals yet.
      </h3>
      <p className="mt-1 text-sm text-neutral-gray3">
        You could be the first one to submit a proposal! 💡
      </p>
    </div>
  );
}