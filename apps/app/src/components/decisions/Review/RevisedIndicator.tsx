import { LuRefreshCw } from 'react-icons/lu';

import { TranslatedText } from '@/components/TranslatedText';

import { Bullet } from '../../Bullet';

export function RevisedIndicator() {
  return (
    <>
      <Bullet />
      <div className="flex items-center gap-1">
        <LuRefreshCw className="size-4 text-primary-orange2" />
        <span className="text-sm text-neutral-charcoal">
          <TranslatedText text="Revised" />
        </span>
      </div>
    </>
  );
}
