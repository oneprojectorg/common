'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { notFound, useParams } from 'next/navigation';
import { Suspense } from 'react';
import { LuCircleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalView } from '@/components/decisions/ProposalView';
import PageNotFound from '@/components/screens/PageNotFound';

function ProposalViewPageContent({
  profileId,
  orgSlug,
  instanceId,
}: {
  profileId: string;
  orgSlug: string;
  instanceId: string;
}) {
  const [proposal] = trpc.decision.getProposal.useSuspenseQuery({
    profileId,
  });

  if (!proposal) {
    notFound();
  }

  const backHref = `/profile/${orgSlug}/decisions/${instanceId}/`;

  return <ProposalView proposal={proposal} backHref={backHref} />;
}

function ProposalViewPageSkeleton() {
  return (
    <>
      {/* Header loading */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
        <div className="flex items-center gap-3">
          <div className="h-10 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>

      {/* Content loading */}
      <div className="flex-1 bg-white px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-12 w-96 animate-pulse rounded bg-gray-200" />
          <div className="flex gap-4">
            <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-28 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
            <div className="space-y-1">
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
          <div className="flex gap-6 border-b pb-4">
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-18 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="mt-6 space-y-4">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    </>
  );
}

function ProposalErrorFallback() {
  const t = useTranslations();
  return (
    <div className="flex flex-1 items-center justify-center">
      <EmptyState icon={<LuCircleAlert className="size-6" />}>
        <Header3 className="font-serif !text-title-base font-light text-neutral-black">
          {t('Something went wrong')}
        </Header3>
        <p className="text-base text-neutral-charcoal">
          {t('Please try again later.')}
        </p>
      </EmptyState>
    </div>
  );
}

const ProposalViewPage = () => {
  const { profileId, slug, id } = useParams<{
    profileId: string;
    slug: string;
    id: string;
  }>();

  return (
    <div className="flex min-h-screen flex-col">
      <APIErrorBoundary
        fallbacks={{
          404: () => <PageNotFound />,
          default: () => <ProposalErrorFallback />,
        }}
      >
        <Suspense fallback={<ProposalViewPageSkeleton />}>
          <ProposalViewPageContent
            profileId={profileId}
            orgSlug={slug}
            instanceId={id}
          />
        </Suspense>
      </APIErrorBoundary>
    </div>
  );
};

export default ProposalViewPage;
