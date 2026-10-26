'use client';

import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { getPublicUrl } from '@/utils';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { GradientHeader, Header1, Header3 } from '@op/sense/Header';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { StatusBadge } from '@op/sense/StatusBadge';
import { cn } from '@op/sense/lib/utils';
import he from 'he';
import { Suspense, type ReactNode } from 'react';
import { LuArrowLeft, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { ButtonLink } from '@/components/ButtonLink';

import { DecisionHeroBanner } from '../DecisionHeroBanner';
import { DecisionPhaseTimeline } from '../DecisionPhaseTimeline';
import {
  OverviewPinnedResourcesSuspense,
  PinnedResourcesError,
  PinnedResourcesSection,
  PinnedResourcesSkeleton,
} from '../OverviewPinnedResources';
import { toProcessPhases } from '../toProcessPhases';
import { ProcessAdminOverviewSkeleton } from './ProcessAdminOverviewSkeleton';
import {
  type ProcessAdminStatus,
  STATUS_BADGE_VARIANT,
  getProcessAdminStatus,
} from './processAdminStatus';

interface ProcessAdminOverviewProps {
  slug: string;
  /**
   * Whether the first phase has started. Computed on the server, because the
   * check reads the clock and would otherwise differ between server and client.
   */
  hasStarted: boolean;
  /**
   * The About body, server-rendered by the page (RichTextRenderer), so it
   * ships as HTML. Null when the stored body holds nothing to show.
   */
  aboutSlot: ReactNode;
}

/** Read-only admin home for one process, at /decisions/[slug]/manage. */
export function ProcessAdminOverview({
  slug,
  hasStarted,
  aboutSlot,
}: ProcessAdminOverviewProps) {
  const t = useTranslations('decisions');

  return (
    <APIErrorBoundary
      fallbacks={{
        default: () => (
          <div className="flex min-h-dvh flex-col bg-background">
            <ProcessAdminTopBar slug={slug} />
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LuTriangleAlert className="size-6" aria-hidden />
                </EmptyMedia>
                <EmptyTitle>{t('overviewLoadError')}</EmptyTitle>
                <EmptyDescription>{t('refreshPageHint')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ),
      }}
    >
      <Suspense fallback={<ProcessAdminOverviewSkeleton />}>
        <ProcessAdminOverviewSuspense
          slug={slug}
          hasStarted={hasStarted}
          aboutSlot={aboutSlot}
        />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ProcessAdminOverviewSuspense({
  slug,
  hasStarted,
  aboutSlot,
}: ProcessAdminOverviewProps) {
  const [decisionProfile] = trpc.decision.getDecisionBySlug.useSuspenseQuery({
    slug,
  });
  const instance = decisionProfile.processInstance;
  const status = getProcessAdminStatus(instance.status);
  // A draft is never open, whatever its dates say: the timeline and the
  // proposals CTA read the same gate so they cannot disagree.
  const isOpen = hasStarted && status !== 'draft';

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <ProcessAdminTopBar slug={slug} status={status} />
      <main className="flex flex-col">
        <ProcessAdminHero
          slug={slug}
          name={decisionProfile.name}
          instance={instance}
          showBrowseProposals={isOpen}
        />
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-4 py-6 md:grid-cols-12 md:gap-x-12 md:px-6 md:py-12">
          <aside className="flex flex-col gap-10 md:col-span-6">
            <ProcessAdminPhaseRail
              slug={slug}
              instance={instance}
              isOpen={isOpen}
            />
            {instance.profileId ? (
              <APIErrorBoundary
                fallbacks={{ default: () => <PinnedResourcesError /> }}
              >
                <Suspense fallback={<PinnedResourcesSkeleton />}>
                  <ProcessAdminPinnedResourcesSuspense
                    profileId={instance.profileId}
                  />
                </Suspense>
              </APIErrorBoundary>
            ) : null}
          </aside>
          <ProcessAdminAbout
            description={instance.description}
            aboutSlot={aboutSlot}
          />
        </div>
      </main>
    </div>
  );
}

function ProcessAdminTopBar({
  slug,
  status,
}: {
  slug: string;
  /** Omitted when the process failed to load: the bar then shows no badge. */
  status?: ProcessAdminStatus;
}) {
  const t = useTranslations('decisions.processAdmin');
  const statusLabels: Record<ProcessAdminStatus, string> = {
    draft: t('statusDraft'),
    live: t('statusLive'),
    completed: t('statusCompleted'),
    cancelled: t('statusCancelled'),
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-accent">
      <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
        <ButtonLink href={`/decisions/${slug}/edit`} variant="link">
          <LuArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t('backToEditor')}
        </ButtonLink>
        {status ? (
          <StatusBadge variant={STATUS_BADGE_VARIANT[status]} icon={false}>
            {statusLabels[status]}
          </StatusBadge>
        ) : null}
        <ButtonLink href={`/decisions/${slug}`} variant="link">
          {t('viewProcess')}
        </ButtonLink>
      </div>
    </header>
  );
}

// Forked from DecisionOverview's OverviewHero, which also carries translation,
// proposal CTAs, the banner editor and the owner fallback that this page omits.
function ProcessAdminHero({
  slug,
  name,
  instance,
  showBrowseProposals,
}: {
  slug: string;
  name: string;
  instance: ProcessInstance;
  showBrowseProposals: boolean;
}) {
  const t = useTranslations('decisions');
  const canLinkToProfile = useCanLinkToProfile();
  const overview = instance.instanceData.overview;
  const hasImage = Boolean(getPublicUrl(overview?.heroImage));
  const steward = instance.steward;
  const stewardSlug = canLinkToProfile ? steward?.slug : undefined;

  return (
    <DecisionHeroBanner heroImagePath={overview?.heroImage}>
      <div
        className={cn(
          'mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 pt-16 pb-8 text-center md:px-6 md:pb-16',
          hasImage ? 'text-white' : 'text-foreground',
        )}
      >
        <div className="flex flex-col items-center gap-3">
          {hasImage ? (
            <Header1 className="text-white">
              <bdi>{name}</bdi>
            </Header1>
          ) : (
            <GradientHeader>
              <Header1>
                <bdi>{name}</bdi>
              </Header1>
            </GradientHeader>
          )}
          {steward ? (
            <p className="flex items-center gap-1.5">
              <ProfileAvatar
                name={steward.name}
                src={getPublicUrl(steward.avatarImage?.name)}
                alt=""
                size="sm"
              />
              <span>
                {t.rich('processAdmin.stewardedBy', {
                  name: steward.name,
                  steward: (chunks) =>
                    stewardSlug ? (
                      <Link
                        href={`/profile/${stewardSlug}`}
                        className={cn('underline', hasImage && 'text-white')}
                      >
                        <bdi>{chunks}</bdi>
                      </Link>
                    ) : (
                      <bdi>{chunks}</bdi>
                    ),
                })}
              </span>
            </p>
          ) : null}
          {overview?.headline ? (
            <p dir="auto" className="text-title text-balance">
              {overview.headline}
            </p>
          ) : null}
          {overview?.description ? (
            <p dir="auto" className="text-balance">
              {overview.description}
            </p>
          ) : null}
        </div>
        {showBrowseProposals ? (
          <ButtonLink href={`/decisions/${slug}/current`} variant="outline">
            {t('browseProposalsAction')}
          </ButtonLink>
        ) : null}
      </div>
    </DecisionHeroBanner>
  );
}

function ProcessAdminPhaseRail({
  slug,
  instance,
  isOpen,
}: {
  slug: string;
  instance: ProcessInstance;
  isOpen: boolean;
}) {
  const t = useTranslations('decisions');
  const phases = toProcessPhases(instance.instanceData.phases);

  return (
    <section className="flex flex-col gap-4">
      <Header3 className="text-label">{t('processOverviewHeading')}</Header3>
      {phases.length > 0 ? (
        <DecisionPhaseTimeline
          phases={phases}
          currentPhaseId={instance.currentStateId ?? ''}
          hasStarted={isOpen}
          instanceId={instance.id}
          isAdmin={false}
          decisionSlug={slug}
        />
      ) : (
        <AdminEmptyState
          title={t('processAdmin.noPhasesTitle')}
          description={t('processAdmin.noPhasesDescription')}
        />
      )}
    </section>
  );
}

function ProcessAdminPinnedResourcesSuspense({
  profileId,
}: {
  profileId: string;
}) {
  const t = useTranslations('decisions.processAdmin');
  // Same query key as OverviewPinnedResourcesSuspense, so the list is read once.
  const [{ items }] = trpc.resources.list.useSuspenseQuery({ profileId });

  if (items.length > 0) {
    return <OverviewPinnedResourcesSuspense profileId={profileId} />;
  }

  return (
    <PinnedResourcesSection>
      <AdminEmptyState
        title={t('noResourcesTitle')}
        description={t('noResourcesDescription')}
      />
    </PinnedResourcesSection>
  );
}

function ProcessAdminAbout({
  description,
  aboutSlot,
}: {
  description: string | null | undefined;
  aboutSlot: ReactNode;
}) {
  const t = useTranslations('decisions.processAdmin');

  let content: ReactNode;
  if (aboutSlot) {
    content = aboutSlot;
  } else if (description) {
    content = <p dir="auto">{he.decode(description)}</p>;
  } else {
    content = (
      <AdminEmptyState
        title={t('noAboutTitle')}
        description={t('noAboutDescription')}
      />
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-4 md:col-span-6">
      <Header3 className="text-label">{t('aboutHeading')}</Header3>
      {content}
    </section>
  );
}

function AdminEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
