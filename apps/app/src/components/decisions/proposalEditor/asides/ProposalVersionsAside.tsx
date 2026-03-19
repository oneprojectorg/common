'use client';

import { DATE_TIME_UTC_FORMAT, formatDate } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import { useRelativeTime } from '@op/hooks';
import { useLocale } from 'next-intl';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  ProposalEditorAside,
  ProposalEditorAsideSkeleton,
} from '../../ProposalEditorAside';

const RELATIVE_TIME_THRESHOLD_MS = 24 * 60 * 60 * 1000;

interface ProposalVersionsAsideProps {
  proposalId: string;
  onClose: () => void;
}

/**
 * Aside panel for proposal version history.
 */
export function ProposalVersionsAside({
  proposalId,
  onClose,
}: ProposalVersionsAsideProps) {
  return (
    <Suspense fallback={<ProposalVersionsAsideSkeleton />}>
      <ProposalVersionsAsideContent proposalId={proposalId} onClose={onClose} />
    </Suspense>
  );
}

function ProposalVersionsAsideContent({
  proposalId,
  onClose,
}: ProposalVersionsAsideProps) {
  const locale = useLocale();
  const t = useTranslations();

  const [{ versions }] = trpc.decision.listProposalVersions.useSuspenseQuery({
    proposalId,
  });

  return (
    <ProposalEditorAside
      title={t('Version history')}
      onClose={onClose}
      bodyClassName="pt-4"
    >
      <div className="mx-4 rounded bg-primary-tealWhite p-2">
        <p className="text-base text-neutral-black">{t('Current version')}</p>
        <p className="text-base text-neutral-charcoal">{t('Latest')}</p>
      </div>

      <div>
        {versions.map((version) => {
          const createdAt = new Date(version.createdAt);
          const isRecent =
            Date.now() - createdAt.getTime() < RELATIVE_TIME_THRESHOLD_MS;

          return (
            <VersionItemWithTime
              key={version.version}
              createdAt={version.createdAt}
              isRecent={isRecent}
              locale={locale}
            />
          );
        })}
      </div>
    </ProposalEditorAside>
  );
}

function VersionItem({ label, subtitle }: { label: string; subtitle: string }) {
  return (
    <div className="mx-4 p-2">
      <p className="text-base text-neutral-black">{label}</p>
      <p className="text-sm text-neutral-charcoal">{subtitle}</p>
    </div>
  );
}

function VersionItemWithTime({
  createdAt,
  isRecent,
  locale,
}: {
  createdAt: string;
  isRecent: boolean;
  locale: string;
}) {
  const t = useTranslations();
  const relativeTime = useRelativeTime(createdAt, { style: 'long' });

  const label = isRecent
    ? relativeTime
    : formatDate(createdAt, locale, DATE_TIME_UTC_FORMAT);

  return <VersionItem label={label} subtitle={t('Auto-saved')} />;
}

function ProposalVersionsAsideSkeleton() {
  return (
    <ProposalEditorAsideSkeleton>
      <div className="mx-4 rounded bg-primary-tealWhite p-2">
        <div className="h-4 w-32 animate-pulse rounded bg-neutral-gray1" />
        <div className="mt-1 h-3 w-16 animate-pulse rounded bg-neutral-gray1" />
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="mx-4 p-2">
          <div className="h-4 w-36 animate-pulse rounded bg-neutral-gray1" />
          <div className="mt-1 h-3 w-20 animate-pulse rounded bg-neutral-gray1" />
        </div>
      ))}
    </ProposalEditorAsideSkeleton>
  );
}
