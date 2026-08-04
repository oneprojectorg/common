'use client';

import { Button } from '@op/sense/Button';
import { LuLayoutGrid, LuMap } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { ProposalView } from './ProposalViewToggle';

// Mobile-only view switch, sticky at the bottom of the screen. Reads "Map"
// while listing, "List" while showing the map.
export const MobileViewSwitch = ({
  view,
  onChange,
}: {
  view: ProposalView;
  onChange: (next: ProposalView) => void;
}) => {
  const t = useTranslations();

  return (
    <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center sm:hidden">
      <Button
        variant="outline"
        onClick={() => onChange(view === 'map' ? 'grid' : 'map')}
        className="shadow-lg"
      >
        {view === 'map' ? (
          <>
            <LuLayoutGrid className="size-4" />
            {t('List')}
          </>
        ) : (
          <>
            <LuMap className="size-4" />
            {t('Map')}
          </>
        )}
      </Button>
    </div>
  );
};
