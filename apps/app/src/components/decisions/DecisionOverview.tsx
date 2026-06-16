'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { ButtonLink } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { Header2, Header3 } from '@op/ui/Header';
import he from 'he';
import { LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalHtmlContent } from './ProposalHtmlContent';

interface DecisionOverviewProps {
  instanceId: string;
  decisionSlug: string;
}

/**
 * Overview tab for a decision process (/decisions/[slug]/overview). The shared
 * header + view toggle come from the (decision-view) layout; this renders the
 * hero, the phases sidebar slot, and the About body.
 *
 * Overview content (headline, description, body HTML) comes from
 * `instanceData.overview`, authored in the process builder's Overview tab.
 * Falls back to the instance name/description for processes authored before
 * that tab was filled in.
 */
export function DecisionOverviewSuspense({
  instanceId,
  decisionSlug,
}: DecisionOverviewProps) {
  const t = useTranslations();

  return (
    <APIErrorBoundary
      fallbacks={{
        default: () => (
          <EmptyState icon={<LuTriangleAlert className="size-6" />}>
            <Header3 className="font-serif font-light">
              {t("Couldn't load the overview")}
            </Header3>
            <p className="text-base text-neutral-charcoal">
              {t('Refresh the page to try again.')}
            </p>
          </EmptyState>
        ),
      }}
    >
      <DecisionOverviewContent
        instanceId={instanceId}
        decisionSlug={decisionSlug}
      />
    </APIErrorBoundary>
  );
}

function DecisionOverviewContent({
  instanceId,
  decisionSlug,
}: DecisionOverviewProps) {
  const t = useTranslations();
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  const overview = instance.instanceData?.overview;
  const headline = overview?.headline ?? instance.name;

  // Same gate as StandardDecisionPage: the phase must accept proposals and
  // the viewer must have submit access.
  const currentPhase = instance.instanceData?.phases?.find(
    (p) => p.phaseId === instance.currentStateId,
  );
  const canSubmitProposal =
    currentPhase?.rules?.proposals?.submit === true &&
    instance.access?.submitProposals === true;

  return (
    <div className="flex w-full flex-col">
      <OverviewHero
        headline={headline}
        subhead={overview?.description}
        decisionSlug={decisionSlug}
        canSubmitProposal={canSubmitProposal}
      />
      {/* 12-col grid mirroring the Figma layout grid: sidebar spans 4 cols,
          body spans 7 starting at col 6. Stacks to one column below md. */}
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-12 px-4 py-6 md:grid-cols-12 md:gap-x-6 md:px-6 md:py-12">
        {/* TODO: phases timeline lands here in a follow-up PR */}
        <div className="flex flex-col gap-4 md:col-span-4">
          <Header3 className="text-sm text-neutral-gray4">
            {t('Process Overview')}
          </Header3>
          <div className="flex flex-col gap-6">
            <div className="h-24 rounded border bg-neutral-offWhite" />
            <div className="h-24 rounded border bg-neutral-offWhite" />
            <div className="h-24 rounded border bg-neutral-offWhite" />
          </div>
        </div>
        <div className="min-w-0 md:col-span-7 md:col-start-6">
          <OverviewAbout
            html={overview?.body}
            fallbackText={instance.description ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}

const OverviewHero = ({
  headline,
  subhead,
  decisionSlug,
  canSubmitProposal,
}: {
  headline: string;
  subhead?: string;
  decisionSlug: string;
  canSubmitProposal: boolean;
}) => {
  const t = useTranslations();
  const currentPhaseHref = `/decisions/${decisionSlug}/current`;

  return (
    // Gradient stands in until overview header images exist — same radial
    // gradient as the results page hero.
    <section className="grid w-full grid-cols-1 justify-center gap-12 bg-redPurple md:grid-cols-12">
      <div className="mx-auto flex flex-col items-center gap-4 px-4 pt-16 pb-8 text-center text-neutral-offWhite sm:py-24 md:col-span-6 md:col-start-4 md:px-6">
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-serif text-title-xl font-light sm:text-title-xxl">
            <bdi>{headline}</bdi>
          </h1>
          {subhead ? (
            <p dir="auto" className="text-base">
              {subhead}
            </p>
          ) : null}
        </div>
        <div className="align-stretch flex w-full flex-col gap-4 md:flex-row md:justify-center">
          <ButtonLink
            color="secondary"
            href={currentPhaseHref}
            className="w-auto"
          >
            {t('Browse proposals')}
          </ButtonLink>
          {canSubmitProposal ? (
            <ButtonLink
              color="primary"
              href={currentPhaseHref}
              className="w-auto"
            >
              {t('Submit a proposal')}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </section>
  );
};

const OverviewAbout = ({
  html,
  fallbackText,
}: {
  /** TipTap-generated HTML from the overview content. */
  html?: string;
  /** Plain-text process description shown when no overview content exists. */
  fallbackText?: string;
}) => {
  const t = useTranslations();

  if (!html && !fallbackText) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <Header2 className="font-serif">{t('About the process')}</Header2>
      {html ? (
        <ProposalHtmlContent html={html} />
      ) : fallbackText ? (
        // The description is plain text (entity-encoded for some orgs, same as
        // DecisionActionBar) — decode and render as text, not HTML.
        <p dir="auto" className="text-base">
          {he.decode(fallbackText)}
        </p>
      ) : null}
    </section>
  );
};
