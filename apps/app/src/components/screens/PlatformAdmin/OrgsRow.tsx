'use client';

import { DATE_TIME_UTC_FORMAT } from '@/utils/formatting';
import type { RouterOutput } from '@op/api/client';
import { cn } from '@op/ui/utils';
import { useFormatter } from 'next-intl';
import { Button } from 'react-aria-components';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';

import { useTranslations } from '@/lib/i18n';

const ORGS_TABLE_GRID =
  'grid grid-cols-[minmax(200px,2fr)_minmax(100px,1fr)_minmax(150px,1.5fr)_minmax(100px,0.8fr)_minmax(120px,1fr)] gap-4';

type ListAllOrgsOutput = RouterOutput['platform']['admin']['listAllOrganizations'];
type Org = ListAllOrgsOutput['items'][number];

export const OrgsRow = ({ org }: { org: Org }) => {
  const format = useFormatter();
  const t = useTranslations();
  const createdAt = org.createdAt ? new Date(org.createdAt) : null;

  return (
    <div
      className={cn(
        'hover:bg-neutral-gray0 py-4 transition-colors',
        ORGS_TABLE_GRID,
      )}
    >
      <div className="flex items-center text-sm font-normal text-neutral-black">
        {org.profile?.name ?? '—'}
      </div>
      <div className="flex items-center text-sm font-normal text-neutral-charcoal capitalize">
        {org.orgType ?? '—'}
      </div>
      <div className="flex items-center text-sm font-normal text-neutral-charcoal">
        {org.domain ?? '—'}
      </div>
      <div className="flex items-center text-sm font-normal text-neutral-charcoal">
        {org.networkOrganization ? t('Yes') : t('No')}
      </div>
      <div className="flex items-center text-sm font-normal text-neutral-charcoal">
        {createdAt ? (
          <TooltipTrigger>
            <Button className="cursor-default text-sm font-normal underline decoration-dotted underline-offset-2 outline-hidden">
              {format.dateTime(createdAt, { dateStyle: 'medium' })}
            </Button>
            <Tooltip>{format.dateTime(createdAt, DATE_TIME_UTC_FORMAT)}</Tooltip>
          </TooltipTrigger>
        ) : (
          '—'
        )}
      </div>
    </div>
  );
};
