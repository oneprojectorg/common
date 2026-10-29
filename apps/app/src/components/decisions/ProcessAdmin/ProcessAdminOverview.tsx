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
import { Header2 } from '@op/sense/Header';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { StatusBadge } from '@op/sense/StatusBadge';
import { cn } from '@op/sense/lib/utils';
import { Suspense, type ReactNode } from 'react';
import { LuArrowLeft, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { ButtonLink } from '@/components/ButtonLink';

import { DecisionHero } from '../DecisionHero';
import { DecisionHeroBanner } from '../DecisionHeroBanner';
import { DecisionPhaseTimeline } from '../DecisionPhaseTimeline';
import {
  OverviewPinnedResourcesSuspense,
  PinnedResourcesError,
  PinnedResourcesSkeleton,
} from '../OverviewPinnedResources';
import { toProcessPhases } from '../toProcessPhases';
import { AdminEmptyState } from './AdminEmptyState';
import { ProcessAdminAbout } from './ProcessAdminAbout';
import { ProcessAdminBanner } from './ProcessAdminBanner';
import { ProcessAdminLaunchButton } from './ProcessAdminLaunchButton';
import { ProcessAdminOverviewSkeleton } from './ProcessAdminOverviewSkeleton';
import { ProcessAdminSettingsDialog } from './ProcessAdminSettingsDialog';
import { ProcessAdminStewardMenu } from './ProcessAdminSteward';
import { ProcessAdminTitle } from './ProcessAdminTitle';
import { ProcessAdminsDialog } from './ProcessAdminsDialog';
import {
  type ProcessAdminStatus,
  STATUS_BADGE_VARIANT,
  getProcessAdminStatus,
} from './processAdminStatus';

interface ProcessAdminOverviewProps {
  slug: string;
  /**
   * Whether participants can act on the process (`isProcessOpen`). Computed on
   * the server, because the check reads the clock and would otherwise differ
   * between server and client.
   */
  isOpen: boolean;
  /**
   * The About body, server-rendered by the page (RichTextRenderer), so it
   * ships as HTML. Null when the stored body holds nothing to show.
   */
  aboutSlot: ReactNode;
}

/** Read-only admin home for one process, at /decisions/[slug]/manage. */
export function ProcessAdminOverview({
  slug,
  isOpen,
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
          isOpen={isOpen}
          aboutSlot={aboutSlot}
        />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ProcessAdminOverviewSuspense({
  slug,
  isOpen,
  aboutSlot,
}: ProcessAdminOverviewProps) {
  const [decisionProfile] = trpc.decision.getDecisionBySlug.useSuspenseQuery({
    slug,
  });
  const instance = decisionProfile.processInstance;
  const status = getProcessAdminStatus(instance.status);
  const t = useTranslations('decisions.processAdmin');

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <ProcessAdminTopBar
        slug={slug}
        status={status}
        name={decisionProfile.name}
        instance={instance}
      />
      <main className="flex flex-col">
        <ProcessAdminHero
          slug={slug}
          name={decisionProfile.name}
          instance={instance}
          status={status}
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
                  <OverviewPinnedResourcesSuspense
                    profileId={instance.profileId}
                    emptyState={
                      <AdminEmptyState
                        title={t('noResourcesTitle')}
                        description={t('noResourcesDescription')}
                      />
                    }
                  />
                </Suspense>
              </APIErrorBoundary>
            ) : null}
          </aside>
          <ProcessAdminAbout
            slug={slug}
            instanceId={instance.id}
            isDraft={status === 'draft'}
            body={instance.instanceData.overview?.body}
            description={instance.description}
            aboutSlot={aboutSlot}
          />
        </div>
      </main>
    </div>
  );
}

// A draft manages its admins from the bar and cannot launch from here yet; a
// live process gets Settings and a link to what participants see.
function ProcessAdminTopBar({
  slug,
  status,
  name,
  instance,
}: {
  slug: string;
  /** Omitted when the process failed to load: the bar then shows no badge and no actions. */
  status?: ProcessAdminStatus;
  name?: string;
  instance?: ProcessInstance;
}) {
  const t = useTranslations('decisions.processAdmin');
  const statusLabels: Record<ProcessAdminStatus, string> = {
    draft: t('statusDraft'),
    live: t('statusLive'),
    completed: t('statusCompleted'),
    cancelled: t('statusCancelled'),
  };

  let actions: ReactNode = null;
  if (status === 'draft' && instance) {
    actions = (
      <>
        {instance.profileId ? (
          <ProcessAdminsDialog profileId={instance.profileId} />
        ) : null}
        <ProcessAdminLaunchButton />
      </>
    );
  } else if (status && instance && name !== undefined) {
    actions = (
      <>
        <ProcessAdminSettingsDialog
          slug={slug}
          name={name}
          instance={instance}
        />
        <ButtonLink href={`/decisions/${slug}`} variant="link">
          {t('viewProcess')}
        </ButtonLink>
      </>
    );
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-accent">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <div className="flex flex-1 justify-start">
          <ButtonLink href={`/decisions/${slug}/edit`} variant="link">
            <LuArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
            {t('backToEditor')}
          </ButtonLink>
        </div>
        {status ? (
          <StatusBadge variant={STATUS_BADGE_VARIANT[status]} icon={false}>
            {statusLabels[status]}
          </StatusBadge>
        ) : null}
        <div className="flex flex-1 items-center justify-end gap-3">
          {actions}
        </div>
      </div>
    </header>
  );
}

// A draft's title is edited in place; a live title is read-only and changes
// from Settings. The steward line and the banner control are shared.
function ProcessAdminHero({
  slug,
  name,
  instance,
  status,
  showBrowseProposals,
}: {
  slug: string;
  name: string;
  instance: ProcessInstance;
  status: ProcessAdminStatus;
  showBrowseProposals: boolean;
}) {
  const t = useTranslations('decisions');
  const canLinkToProfile = useCanLinkToProfile();
  const overview = instance.instanceData.overview;
  const hasImage = Boolean(getPublicUrl(overview?.heroImage));
  const steward = instance.steward;
  const stewardSlug = canLinkToProfile ? steward?.slug : undefined;

  // A draft changes its steward in place, from the profiles the admin
  // administers; the static name stands in until that list has loaded.
  const renderStewardName = (chunks: ReactNode) => {
    const plain = stewardSlug ? (
      <Link href={`/profile/${stewardSlug}`} className="underline">
        <bdi>{chunks}</bdi>
      </Link>
    ) : (
      <bdi>{chunks}</bdi>
    );
    if (status !== 'draft' || !steward) {
      return plain;
    }
    return (
      <APIErrorBoundary fallbacks={{ default: () => plain }}>
        <Suspense fallback={plain}>
          <ProcessAdminStewardMenu
            slug={slug}
            instance={instance}
            name={steward.name}
            fallback={plain}
          />
        </Suspense>
      </APIErrorBoundary>
    );
  };

  const stewardLine = steward ? (
    <p className="flex items-center justify-center gap-1.5">
      <ProfileAvatar
        name={steward.name}
        src={getPublicUrl(steward.avatarImage?.name)}
        alt=""
        size="sm"
      />
      <span className="flex items-center gap-1">
        {t.rich('processAdmin.stewardedBy', {
          name: steward.name,
          steward: renderStewardName,
        })}
      </span>
    </p>
  ) : undefined;

  // The design shows the title and the steward only; the summary belongs to
  // the About section.
  return (
    <DecisionHeroBanner heroImagePath={overview?.heroImage}>
      <ProcessAdminBanner
        slug={slug}
        instanceId={instance.id}
        heroImagePath={overview?.heroImage}
      />
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 pt-16 pb-8 md:px-6 md:pb-16">
        {status === 'draft' ? (
          <div className="flex w-full flex-col gap-2 text-center">
            <ProcessAdminTitle
              slug={slug}
              instanceId={instance.id}
              name={name}
              hasImage={hasImage}
            />
            {stewardLine ? (
              <div
                className={cn(
                  'flex flex-col gap-2 text-base',
                  hasImage ? 'text-white' : 'text-foreground',
                )}
              >
                {stewardLine}
              </div>
            ) : null}
          </div>
        ) : (
          <DecisionHero
            title={name}
            hasImage={hasImage}
            showTranslateLink={false}
            description={stewardLine}
          >
            {showBrowseProposals ? (
              <ButtonLink
                href={`/decisions/${slug}/current`}
                variant="outline"
                className="mt-6 self-center"
              >
                {t('browseProposalsAction')}
              </ButtonLink>
            ) : null}
          </DecisionHero>
        )}
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
      <Header2 className="text-label">{t('processOverviewHeading')}</Header2>
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
