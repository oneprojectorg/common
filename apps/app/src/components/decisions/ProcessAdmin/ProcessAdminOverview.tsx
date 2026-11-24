'use client';

import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { getPublicUrl } from '@/utils';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { getAvatarImageProps } from '@/utils/getAvatarImageProps';
import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
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
import { useRouter } from 'next/navigation';
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { LuArrowLeft, LuPencil, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { ButtonLink } from '@/components/ButtonLink';

import { DecisionHero } from '../DecisionHero';
import { DecisionHeroBanner } from '../DecisionHeroBanner';
import { OverviewAbout } from '../DecisionOverview';
import {
  OverviewPinnedResourcesSuspense,
  PinnedResourcesError,
  PinnedResourcesSkeleton,
} from '../OverviewPinnedResources';
import { ProcessAdminBanner } from './ProcessAdminBanner';
import { ProcessAdminLaunchButton } from './ProcessAdminLaunchButton';
import { ProcessAdminOverviewSkeleton } from './ProcessAdminOverviewSkeleton';
import { ProcessAdminPhaseTimeline } from './ProcessAdminPhaseTimeline';
import { ProcessAdminTitle } from './ProcessAdminTitle';
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
   * between server and client. The overview refreshes the page when a refetch
   * changes what it depends on.
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
  useRefreshWhenOpenInputsChange(instance);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <ProcessAdminTopBar
        slug={slug}
        process={{ name: decisionProfile.name, instance }}
      />
      <main className="flex flex-col">
        <ProcessAdminHero
          slug={slug}
          name={decisionProfile.name}
          instance={instance}
          status={status}
          showBrowseProposals={isOpen}
        />
        <div className="mx-auto flex w-full max-w-272 flex-col gap-12 px-4 py-6 md:flex-row md:px-6 md:py-12 lg:gap-24">
          <div className="flex min-w-0 flex-1 flex-col gap-10">
            <ProcessAdminPhaseRail
              slug={slug}
              phases={instance.phases}
              currentStateId={instance.currentStateId}
              templates={instance.instanceData}
              isOpen={isOpen}
              isDraft={status === 'draft'}
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
          </div>
          <ProcessAdminAbout
            description={instance.description}
            aboutSlot={aboutSlot}
          />
        </div>
      </main>
    </div>
  );
}

// A draft cannot launch from here yet; a live process links to what participants see.
function ProcessAdminTopBar({
  slug,
  process,
}: {
  slug: string;
  /** Omitted when the process failed to load: the bar then shows no badge and no actions. */
  process?: { name: string; instance: ProcessInstance };
}) {
  const t = useTranslations('decisions.processAdmin');
  const statusLabels: Record<ProcessAdminStatus, string> = {
    draft: t('statusDraft'),
    live: t('statusLive'),
    completed: t('statusCompleted'),
    cancelled: t('statusCancelled'),
  };
  const status = process
    ? getProcessAdminStatus(process.instance.status)
    : undefined;

  let actions: ReactNode = null;
  if (process && status === 'draft') {
    actions = <ProcessAdminLaunchButton />;
  } else if (process) {
    actions = (
      <ButtonLink href={`/decisions/${slug}`} variant="link">
        {t('viewProcess')}
      </ButtonLink>
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

  const stewardLine = steward ? (
    <p className="flex items-center justify-center gap-1.5">
      <ProfileAvatar
        name={steward.name}
        {...getAvatarImageProps(getPublicUrl(steward.avatarImage?.name))}
        alt=""
        size="sm"
      />
      <span>
        {t.rich('processAdmin.stewardedBy', {
          name: steward.name,
          steward: (chunks) =>
            stewardSlug ? (
              <Link href={`/profile/${stewardSlug}`} className="underline">
                <bdi>{chunks}</bdi>
              </Link>
            ) : (
              <bdi>{chunks}</bdi>
            ),
        })}
      </span>
    </p>
  ) : undefined;

  return (
    <DecisionHeroBanner heroImagePath={overview?.heroImage}>
      <ProcessAdminBanner
        slug={slug}
        instanceId={instance.id}
        heroImagePath={overview?.heroImage}
      />
      <div className="mx-auto flex w-full flex-col items-center px-4 pt-16 pb-8 md:w-1/2 md:px-6 md:pb-16">
        <DecisionHero
          title={name}
          titleSlot={
            status === 'draft' ? (
              <ProcessAdminTitle
                slug={slug}
                instanceId={instance.id}
                name={name}
                hasImage={hasImage}
              />
            ) : undefined
          }
          hasImage={hasImage}
          showTranslateLink={false}
          className="gap-3"
          description={stewardLine}
        >
          {showBrowseProposals ? (
            <ButtonLink
              href={`/decisions/${slug}/current`}
              variant="outline"
              className="mt-8 self-center"
            >
              {t('browseProposalsAction')}
            </ButtonLink>
          ) : null}
        </DecisionHero>
      </div>
    </DecisionHeroBanner>
  );
}

function ProcessAdminPhaseRail({
  slug,
  phases,
  currentStateId,
  templates,
  isOpen,
  isDraft,
}: Pick<
  ComponentProps<typeof ProcessAdminPhaseTimeline>,
  'slug' | 'phases' | 'currentStateId' | 'templates'
> & { isOpen: boolean; isDraft: boolean }) {
  const t = useTranslations('decisions');
  const tShared = useTranslations();
  const [isEditingLaunched, setIsEditingLaunched] = useState(false);
  const isEditing = isDraft || isEditingLaunched;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Header2 className="text-label">{t('processOverviewHeading')}</Header2>
        {!isDraft && phases.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditingLaunched((editing) => !editing)}
            aria-label={
              isEditingLaunched ? undefined : t('processAdmin.editPhases')
            }
          >
            {isEditingLaunched ? (
              tShared('Done')
            ) : (
              <>
                <LuPencil data-icon="inline-start" aria-hidden />
                {tShared('Edit')}
              </>
            )}
          </Button>
        ) : null}
      </div>
      {phases.length > 0 ? (
        <ProcessAdminPhaseTimeline
          slug={slug}
          phases={phases}
          currentStateId={currentStateId}
          templates={templates}
          hasStarted={isOpen}
          isEditing={isEditing}
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

function ProcessAdminAbout({
  description,
  aboutSlot,
}: {
  description: string | null | undefined;
  aboutSlot: ReactNode;
}) {
  const t = useTranslations('decisions.processAdmin');

  return (
    <section className="flex min-w-0 flex-col gap-3 md:w-80 md:shrink-0 lg:w-140">
      <Header2 className="text-label">{t('aboutHeading')}</Header2>
      {aboutSlot || description ? (
        <OverviewAbout
          bodySlot={aboutSlot}
          fallbackText={description ?? undefined}
        />
      ) : (
        <AdminEmptyState
          title={t('noAboutTitle')}
          description={t('noAboutDescription')}
        />
      )}
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

/** Re-renders the page on the server when a refetch changes the status or first phase, so `isOpen` reads the clock again. */
function useRefreshWhenOpenInputsChange(instance: ProcessInstance) {
  const router = useRouter();
  const phases = instance.instanceData.phases;
  const openInputs = JSON.stringify([
    instance.status,
    phases?.length ?? 0,
    phases?.[0]?.startDate,
  ]);
  const renderedInputs = useRef(openInputs);

  useEffect(() => {
    if (renderedInputs.current === openInputs) {
      return;
    }
    renderedInputs.current = openInputs;
    router.refresh();
  }, [openInputs, router]);
}
