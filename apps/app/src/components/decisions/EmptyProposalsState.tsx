import { Header3 } from '@op/ui/Header';
import { LuLeaf } from 'react-icons/lu';

export function EmptyProposalsState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-0 py-8">
      <div className="flex size-10 items-center justify-center rounded-full bg-neutral-gray1">
        <LuLeaf className="size-6 text-neutral-gray4" />
      </div>
      <div className="flex flex-col items-center justify-start gap-6">
        <div className="flex flex-col items-center justify-start gap-2 text-center">
          <Header3 className="font-serif !text-title-base font-light text-neutral-black">
            No proposals yet.
          </Header3>
          <p className="text-base text-neutral-charcoal">
            You could be the first one to submit a proposal! 😉
          </p>
        </div>
      </div>
    </div>
  );
}
